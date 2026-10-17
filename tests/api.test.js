import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import { createApp } from "../server/app.js";
const password = randomBytes(20).toString("hex");
async function fixture(t, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), "finance-api-"));
  const dbPath = join(dir, "finance.sqlite");
  let app = createApp({ dbPath });
  let server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  let cookie = "";
  let base = `http://127.0.0.1:${server.address().port}`;
  async function request(path, method = "GET", body, headers = {}) {
    const response = await fetch(base + "/api" + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(cookie ? { cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const next = response.headers.get("set-cookie");
    if (next) cookie = next.split(";")[0];
    return {
      status: response.status,
      body: await response.json(),
      headers: response.headers,
    };
  }
  t.after(async () => {
    await new Promise((r) => server.close(r));
    app.locals.close();
    await rm(dir, { recursive: true, force: true });
  });
  if (options.setup !== false) {
    assert.equal(
      (
        await request("/setup", "POST", {
          name: "Test Yönetici",
          branchName: "Test Finans",
          password,
          withDemo: options.demo || false,
        })
      ).status,
      201,
    );
  }
  return {
    request,
    unauth: () => {
      cookie = "";
    },
    async state() {
      return (await request("/state")).body;
    },
    async reopen() {
      await new Promise((r) => server.close(r));
      app.locals.close();
      app = createApp({ dbPath });
      server = app.listen(0, "127.0.0.1");
      await new Promise((r) => server.once("listening", r));
      base = `http://127.0.0.1:${server.address().port}`;
    },
  };
}
async function entry(f, type = "income", overrides = {}) {
  const s = await f.state();
  const body = {
    type,
    categoryId: s.categories.find((c) => c.type === type).id,
    amount: 100.25,
    date: "2026-10-17",
    account: "Nakit",
    status: "paid",
    description: "Test finans kaydı",
    counterparty: "",
    reference: "",
    notes: "",
    ...overrides,
  };
  return f.request("/entries", "POST", body);
}

test("first setup is private, one-time, and requires a strong password", async (t) => {
  const f = await fixture(t, { setup: false });
  assert.equal((await f.request("/state")).status, 401);
  assert.equal((await f.request("/auth")).body.initialized, false);
  assert.equal(
    (
      await f.request("/setup", "POST", {
        name: "Test",
        branchName: "Şube",
        password: "short",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.request("/setup", "POST", {
        name: "Test",
        branchName: "Şube",
        password,
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await f.request("/setup", "POST", {
        name: "Test",
        branchName: "Şube",
        password,
      })
    ).status,
    409,
  );
  assert.equal((await f.request("/state")).body.entries.length, 0);
  f.unauth();
  assert.equal((await f.request("/export")).status, 401);
});
test("foreign origins are rejected and normal login/logout works", async (t) => {
  const f = await fixture(t);
  assert.equal(
    (await f.request("/logout", "POST", {}, { origin: "https://evil.example" }))
      .status,
    403,
  );
  await f.request("/logout", "POST");
  assert.equal((await f.request("/state")).status, 401);
  assert.equal(
    (await f.request("/login", "POST", { password: "wrong" })).status,
    401,
  );
  assert.equal((await f.request("/login", "POST", { password })).status, 200);
  assert.equal((await f.request("/auth")).body.user.name, "Test Yönetici");
});
test("entry CRUD stores exact cents, validates dates and category type", async (t) => {
  const f = await fixture(t);
  const saved = await entry(f);
  assert.equal(saved.status, 201);
  assert.equal((await f.state()).entries[0].amount, 100.25);
  assert.equal((await entry(f, "income", { amount: 0.001 })).status, 400);
  assert.equal((await entry(f, "income", { amount: -1 })).status, 400);
  assert.equal((await entry(f, "income", { date: "2026-02-30" })).status, 400);
  assert.equal((await entry(f, "income", { account: "unknown" })).status, 400);
  assert.equal(
    (
      await entry(f, "income", {
        categoryId: (await f.state()).categories.find(
          (c) => c.type === "expense",
        ).id,
      })
    ).status,
    400,
  );
  assert.equal((await entry(f, "income", { unexpected: true })).status, 400);
  assert.equal(
    (
      await f.request("/entries/" + saved.body.id, "PATCH", {
        amount: 450.12,
        status: "pending",
      })
    ).status,
    200,
  );
  assert.equal((await f.state()).entries[0].status, "pending");
  assert.equal(
    (await f.request("/entries/" + saved.body.id, "DELETE")).status,
    200,
  );
  assert.equal((await f.state()).entries.length, 0);
  assert.equal(
    (await f.request("/entries/" + saved.body.id, "PATCH", { amount: 1 }))
      .status,
    404,
  );
});
test("reports distinguish pending amounts and sum decimal amounts exactly", async (t) => {
  const f = await fixture(t);
  await entry(f, "income", { amount: 0.1 });
  await entry(f, "income", { amount: 0.2 });
  await entry(f, "expense", { amount: 0.12 });
  await entry(f, "income", { amount: 900, status: "pending" });
  await entry(f, "expense", { amount: 700, status: "pending" });
  const r = await f.request("/reports?from=2026-10-01&to=2026-10-31");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.summary, {
    income: 0.3,
    expense: 0.12,
    balance: 0.18,
    pendingIncome: 900,
    pendingExpense: 700,
    count: 5,
    paidCount: 3,
  });
  assert.equal(r.body.months[0].income, 0.3);
  assert.equal(r.body.accounts.find((a) => a.name === "Nakit").balance, 0.18);
  assert.equal(
    r.body.categories.reduce((s, c) => s + c.count, 0),
    3,
  );
});
test("reports honor inclusive ranges, prior months, leap years and yearly boundaries", async (t) => {
  const f = await fixture(t);
  for (const [date, amount] of [
    ["2024-02-29", 10],
    ["2025-12-31", 20],
    ["2026-01-01", 30],
    ["2026-10-31", 40],
    ["2026-11-01", 50],
  ])
    await entry(f, "income", { date, amount });
  const month = (await f.request("/reports?from=2026-10-01&to=2026-10-31"))
    .body;
  assert.equal(month.summary.income, 40);
  assert.equal(month.previous.from, "2026-09-01");
  assert.equal(month.previous.to, "2026-09-30");
  const leap = (await f.request("/reports?from=2024-03-01&to=2024-03-31")).body;
  assert.equal(leap.previous.to, "2024-02-29");
  assert.equal(leap.previous.summary.income, 10);
  const year = (await f.request("/reports?from=2026-01-01&to=2026-12-31")).body;
  assert.equal(year.summary.income, 120);
  assert.equal(year.previous.summary.income, 20);
  assert.equal(year.years.length, 3);
  assert.equal(
    (await f.request("/reports?from=2026-12-31&to=2026-01-01")).status,
    400,
  );
  assert.equal(
    (await f.request("/reports?from=invalid&to=2026-01-01")).status,
    400,
  );
});
test("category rename updates entries; used categories cannot be removed", async (t) => {
  const f = await fixture(t);
  const item = await entry(f);
  const c = (await f.state()).entries.find(
    (e) => e.id === item.body.id,
  ).categoryId;
  assert.equal(
    (
      await f.request("/categories/" + c, "PATCH", {
        name: "Yeni gelir kategorisi",
        color: "#123456",
      })
    ).status,
    200,
  );
  assert.equal((await f.state()).entries[0].category, "Yeni gelir kategorisi");
  assert.equal((await f.request("/categories/" + c, "DELETE")).status, 409);
  const extra = await f.request("/categories", "POST", {
    type: "expense",
    name: "Yeni kategori",
    color: "#ab1234",
  });
  assert.equal(extra.status, 201);
  assert.equal(
    (
      await f.request("/categories", "POST", {
        type: "expense",
        name: "Yeni kategori",
        color: "#ab1234",
      })
    ).status,
    409,
  );
  assert.equal(
    (await f.request("/categories/" + extra.body.id, "DELETE")).status,
    200,
  );
});
test("JSON backup restores into a fresh account, preview is non-mutating and repeats skip duplicates", async (t) => {
  const f = await fixture(t);
  await entry(f, "income", { amount: 34.56 });
  await entry(f, "expense", { amount: 12.34, status: "pending" });
  const cat = (await f.state()).categories.find((c) => c.type === "income");
  await f.request("/categories/" + cat.id, "PATCH", {
    name: "Özel gelir",
    color: "#123456",
  });
  const backup = await f.request("/export");
  assert.equal(backup.body.format, "komagene-finance");
  assert.ok(backup.headers.get("content-disposition").includes(".json"));
  assert.ok(!JSON.stringify(backup.body).includes("password"));
  const target = await fixture(t);
  const preview = await target.request("/import/preview", "POST", backup.body);
  assert.equal(preview.status, 200);
  assert.equal(preview.body.added, 2);
  assert.equal((await target.state()).entries.length, 0);
  assert.ok(
    !(await target.state()).categories.some((c) => c.name === "Özel gelir"),
  );
  assert.equal(
    (await target.request("/import", "POST", backup.body)).status,
    200,
  );
  assert.equal((await target.state()).entries.length, 2);
  assert.deepEqual(
    (await target.request("/import", "POST", backup.body)).body,
    { ok: true, added: 0, skipped: 2, categoriesAdded: 0 },
  );
});
test("invalid or conflicting import is atomic and preserves existing entries", async (t) => {
  const f = await fixture(t);
  await entry(f);
  const backup = (await f.request("/export")).body;
  const copy = structuredClone(backup);
  copy.entries.push({ ...copy.entries[0], id: randomUUID(), amount: 50 });
  copy.entries.push({ ...copy.entries[0], id: randomUUID(), amount: -2 });
  assert.equal((await f.request("/import", "POST", copy)).status, 400);
  assert.equal((await f.state()).entries.length, 1);
  backup.entries[0].amount = 200;
  assert.equal((await f.request("/import", "POST", backup)).status, 409);
  assert.equal((await f.state()).entries[0].amount, 100.25);
  assert.equal(
    (
      await f.request("/import", "POST", {
        format: "wrong",
        version: 1,
        categories: [],
        entries: [],
      })
    ).status,
    400,
  );
});
test("password rotation invalidates other sessions and retains business records", async (t) => {
  const f = await fixture(t);
  await entry(f);
  const original = (await f.request("/login", "POST", { password })).headers
    .get("set-cookie")
    .split(";")[0];
  const next = randomBytes(18).toString("hex");
  assert.equal(
    (
      await f.request("/password", "POST", {
        currentPassword: "wrong",
        newPassword: next,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await f.request("/password", "POST", {
        currentPassword: password,
        newPassword: next,
      })
    ).status,
    200,
  );
  assert.equal(
    (await f.request("/state", "GET", undefined, { cookie: original })).status,
    401,
  );
  assert.equal((await f.state()).entries.length, 1);
  await f.request("/logout", "POST");
  assert.equal((await f.request("/login", "POST", { password })).status, 401);
  assert.equal(
    (await f.request("/login", "POST", { password: next })).status,
    200,
  );
});
test("settings and finances persist after database reopening", async (t) => {
  const f = await fixture(t);
  await entry(f, "expense", { amount: 456.78, notes: "Kalıcı not" });
  await f.request("/settings", "PATCH", {
    branchName: "Yeni Şube",
    ownerName: "Yeni Yönetici",
  });
  await f.reopen();
  const s = await f.state();
  assert.equal(s.settings.branchName, "Yeni Şube");
  assert.equal(s.entries[0].amount, 456.78);
  assert.equal(s.entries[0].notes, "Kalıcı not");
});
test("sample data spans two years, is marked, and has no future settled transactions", async (t) => {
  const f = await fixture(t, { demo: true });
  const s = await f.state();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  assert.equal(s.settings.demoData, true);
  assert.ok(s.entries.length > 20);
  assert.ok(new Set(s.entries.map((e) => e.date.slice(0, 4))).size >= 2);
  assert.ok(
    s.entries.filter((e) => e.status === "paid").every((e) => e.date <= today),
  );
  assert.equal(s.entries.filter((e) => e.status === "pending").length, 2);
});
