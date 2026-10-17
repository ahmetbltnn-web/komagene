import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../server/app.js";

const PASSWORD = "guvenli-parola-2026";

async function fixture(t, { initialize = true } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "komagene-test-"));
  const dbPath = join(directory, "test.sqlite");
  let app;
  let server;
  let baseUrl;
  let cookie = "";

  async function stop() {
    if (server) {
      const current = server;
      server = undefined;
      await new Promise((resolve, reject) => {
        current.close((error) => (error ? reject(error) : resolve()));
        current.closeAllConnections();
      });
    }
    if (app) {
      await app.locals.close();
      app = undefined;
    }
  }

  async function start() {
    app = createApp({ dbPath });
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    cookie = "";
  }

  async function request(
    path,
    { method = "GET", body, authenticated = true, headers = {} } = {},
  ) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(authenticated && cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const setCookies = response.headers.getSetCookie();
    if (setCookies.length && authenticated) {
      cookie = setCookies.map((value) => value.split(";", 1)[0]).join("; ");
    }
    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    return {
      status: response.status,
      ok: response.ok,
      data,
      headers: response.headers,
    };
  }

  async function setup(extra = {}) {
    return request("/api/setup", {
      method: "POST",
      body: {
        name: "Ahmet",
        password: PASSWORD,
        branchName: "Merkez Şube",
        withDemo: false,
        ...extra,
      },
    });
  }

  async function state() {
    const result = await request("/api/state");
    assert.equal(result.status, 200, JSON.stringify(result.data));
    return result.data;
  }

  async function product(extra = {}) {
    const existingIds = new Set(
      (await state()).products.map((item) => item.id),
    );
    const result = await request("/api/products", {
      method: "POST",
      body: {
        name: "Dürüm",
        category: "Yiyecek",
        price: 90,
        cost: 35,
        stock: 10,
        minStock: 3,
        unit: "adet",
        ...extra,
      },
    });
    assert.ok(result.ok, JSON.stringify(result.data));
    return (await state()).products.find((item) => !existingIds.has(item.id));
  }

  t.after(async () => {
    await stop();
    await rm(directory, { recursive: true, force: true });
  });
  await start();
  const client = {
    request,
    setup,
    state,
    product,
    stop,
    start,
    get origin() {
      return baseUrl;
    },
  };
  if (initialize) {
    const result = await setup();
    assert.ok(result.ok, JSON.stringify(result.data));
  }
  return client;
}

function expectRejected(result) {
  assert.ok(
    result.status >= 400 && result.status < 500,
    JSON.stringify(result),
  );
  assert.equal(typeof result.data?.error, "string");
}

function orderBody(productId, quantity, extra = {}) {
  return {
    customer: "Ayşe",
    channel: "Şube",
    payment: "Kart",
    items: [{ productId, quantity }],
    ...extra,
  };
}

test("initial setup, private state, session login and logout", async (t) => {
  const client = await fixture(t, { initialize: false });
  const health = await client.request("/api/health", { authenticated: false });
  assert.equal(health.status, 200);
  const initialAuth = await client.request("/api/auth");
  assert.equal(initialAuth.status, 200);
  assert.equal(initialAuth.data.initialized, false);
  assert.equal(initialAuth.data.user, null);
  assert.equal((await client.request("/api/state")).status, 401);

  expectRejected(await client.setup({ password: "short" }));
  const setup = await client.setup();
  assert.ok(setup.ok, JSON.stringify(setup.data));
  const cookie = setup.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=/i);
  const auth = await client.request("/api/auth");
  assert.equal(auth.data.initialized, true);
  assert.equal(auth.data.user.name, "Ahmet");
  const state = await client.state();
  for (const key of [
    "products",
    "orders",
    "expenses",
    "employees",
    "movements",
  ]) {
    assert.ok(Array.isArray(state[key]), `${key} should be an array`);
    assert.equal(state[key].length, 0, `empty setup should not seed ${key}`);
  }
  assert.ok(!JSON.stringify(state).includes(PASSWORD));
  assert.equal((await client.setup()).status, 409);
  assert.ok((await client.request("/api/logout", { method: "POST" })).ok);
  assert.equal((await client.request("/api/state")).status, 401);
  expectRejected(
    await client.request("/api/login", {
      method: "POST",
      body: { password: "wrong" },
    }),
  );
  assert.equal((await client.request("/api/state")).status, 401);
  assert.ok(
    (
      await client.request("/api/login", {
        method: "POST",
        body: { password: PASSWORD },
      })
    ).ok,
  );
  assert.equal((await client.request("/api/auth")).data.user.name, "Ahmet");
});

test("concurrent setup creates only one owner", async (t) => {
  const client = await fixture(t, { initialize: false });
  const results = await Promise.all([
    client.setup({ name: "Birinci" }),
    client.setup({ name: "İkinci" }),
  ]);
  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => result.status === 409).length, 1);
  assert.equal((await client.request("/api/auth")).data.initialized, true);
});

test("foreign origins cannot initialize, sign in or mutate business data", async (t) => {
  const client = await fixture(t, { initialize: false });
  const headers = { Origin: "https://attacker.invalid" };
  assert.equal(
    (
      await client.request("/api/setup", {
        method: "POST",
        headers,
        body: {
          name: "Attacker",
          password: PASSWORD,
          branchName: "Merkez",
          withDemo: false,
        },
      })
    ).status,
    403,
  );
  assert.equal((await client.request("/api/auth")).data.initialized, false);
  assert.ok((await client.setup()).ok);
  assert.equal(
    (
      await client.request("/api/login", {
        method: "POST",
        headers,
        body: { password: PASSWORD },
      })
    ).status,
    403,
  );
  const product = await client.product();
  assert.equal(
    (
      await client.request("/api/stock", {
        method: "POST",
        headers,
        body: { productId: product.id, quantity: 99, reason: "İzinsiz" },
      })
    ).status,
    403,
  );
  assert.equal((await client.state()).products[0].stock, 10);
  const sameOrigin = await client.request("/api/stock", {
    method: "POST",
    headers: { Origin: client.origin },
    body: { productId: product.id, quantity: 1, reason: "Sayım" },
  });
  assert.ok(sameOrigin.ok, JSON.stringify(sameOrigin.data));
});

test("products preserve decimal prices, reject excess precision and require stock adjustments", async (t) => {
  const client = await fixture(t);
  const product = await client.product({
    price: 12.35,
    cost: 3.46,
    stock: 4.125,
  });
  assert.equal(product.price, 12.35);
  assert.equal(product.cost, 3.46);
  assert.equal(product.stock, 4.125);
  const update = await client.request(`/api/products/${product.id}`, {
    method: "PATCH",
    body: { name: "Mega Dürüm", price: 15.5, stock: 500 },
  });
  // An API can reject the stock field or ignore it; neither may change stock.
  assert.ok(update.ok || (update.status >= 400 && update.status < 500));
  assert.equal((await client.state()).products[0].stock, 4.125);
  assert.ok(
    (
      await client.request(`/api/products/${product.id}`, {
        method: "PATCH",
        body: { name: "Mega Dürüm", price: 15.5, active: false },
      })
    ).ok,
  );
  const updated = (await client.state()).products[0];
  assert.equal(updated.name, "Mega Dürüm");
  assert.equal(updated.price, 15.5);
  assert.equal(updated.active, false);
  expectRejected(
    await client.request("/api/orders", {
      method: "POST",
      body: orderBody(product.id, 1),
    }),
  );
  for (const body of [
    { price: -1 },
    { cost: -1 },
    { stock: -1 },
    { price: "90" },
    { name: "" },
    { price: 12.345 },
    { cost: 3.456 },
  ]) {
    expectRejected(
      await client.request("/api/products", {
        method: "POST",
        body: {
          name: "Geçersiz",
          category: "Yiyecek",
          price: 90,
          cost: 35,
          stock: 1,
          minStock: 1,
          unit: "adet",
          ...body,
        },
      }),
    );
  }
  assert.equal((await client.state()).products.length, 1);
});

test("stock adjustments are recorded and cannot make stock negative", async (t) => {
  const client = await fixture(t);
  const product = await client.product({ stock: 2 });
  assert.ok(
    (
      await client.request("/api/stock", {
        method: "POST",
        body: { productId: product.id, quantity: 1.25, reason: "Mal kabul" },
      })
    ).ok,
  );
  assert.ok(
    (
      await client.request("/api/stock", {
        method: "POST",
        body: { productId: product.id, quantity: -0.25, reason: "Fire" },
      })
    ).ok,
  );
  const state = await client.state();
  assert.equal(state.products[0].stock, 3);
  assert.ok(state.movements.length >= 2);
  for (const quantity of [-4, 0, "5", null]) {
    expectRejected(
      await client.request("/api/stock", {
        method: "POST",
        body: { productId: product.id, quantity, reason: "Geçersiz" },
      }),
    );
  }
  assert.equal((await client.state()).products[0].stock, 3);
});

test("orders calculate prices on the server and consume aggregated stock", async (t) => {
  const client = await fixture(t);
  const product = await client.product({ price: 12.35, cost: 3.25, stock: 5 });
  const injectedPrice = await client.request("/api/orders", {
    method: "POST",
    body: orderBody(product.id, 1, {
      total: 0.01,
      items: [
        { productId: product.id, quantity: 1, unitPrice: 0.01 },
        { productId: product.id, quantity: 2, unitPrice: 0.01 },
      ],
    }),
  });
  expectRejected(injectedPrice);
  expectRejected(
    await client.request("/api/orders", {
      method: "POST",
      body: orderBody(product.id, 1, {
        items: [{ productId: product.id, quantity: 1, unitPrice: 0.01 }],
      }),
    }),
  );
  assert.equal((await client.state()).products[0].stock, 5);
  const result = await client.request("/api/orders", {
    method: "POST",
    body: orderBody(product.id, 1, {
      items: [
        { productId: product.id, quantity: 1 },
        { productId: product.id, quantity: 2 },
      ],
    }),
  });
  assert.ok(result.ok, JSON.stringify(result.data));
  const state = await client.state();
  assert.equal(state.products[0].stock, 2);
  assert.equal(state.orders.length, 1);
  assert.equal(state.orders[0].total, 37.05);
  assert.equal(state.orders[0].status, "Hazırlanıyor");
  assert.equal(
    state.orders[0].items.reduce((sum, item) => sum + item.quantity, 0),
    3,
  );
  for (const item of state.orders[0].items) assert.equal(item.unitPrice, 12.35);
  assert.ok(
    (
      await client.request(`/api/products/${product.id}`, {
        method: "PATCH",
        body: { name: "Yeni Ürün Adı", price: 50, cost: 20 },
      })
    ).ok,
  );
  const historicalOrder = (await client.state()).orders[0];
  assert.equal(historicalOrder.total, 37.05);
  for (const item of historicalOrder.items) {
    assert.equal(item.unitPrice, 12.35);
    assert.equal(item.unitCost, 3.25);
    assert.equal(item.name, "Dürüm");
  }
});

test("invalid orders do not partially consume stock or create orders", async (t) => {
  const client = await fixture(t);
  const product = await client.product({ stock: 4 });
  const other = await client.product({ name: "Ayran", stock: 1 });
  const invalidItems = [
    [],
    [{ productId: product.id, quantity: 0 }],
    [{ productId: product.id, quantity: -1 }],
    [{ productId: product.id, quantity: 1.5 }],
    [{ productId: product.id, quantity: "1" }],
    [{ productId: "missing", quantity: 1 }],
    [
      { productId: product.id, quantity: 2 },
      { productId: product.id, quantity: 3 },
    ],
    [
      { productId: product.id, quantity: 1 },
      { productId: other.id, quantity: 2 },
    ],
  ];
  for (const items of invalidItems) {
    expectRejected(
      await client.request("/api/orders", {
        method: "POST",
        body: orderBody(product.id, 1, { items }),
      }),
    );
  }
  const state = await client.state();
  assert.equal(state.orders.length, 0);
  assert.equal(state.products.find((item) => item.id === product.id).stock, 4);
  assert.equal(state.products.find((item) => item.id === other.id).stock, 1);
});

test("concurrent orders cannot oversell", async (t) => {
  const client = await fixture(t);
  const product = await client.product({ stock: 5 });
  const results = await Promise.all(
    [1, 2].map(() =>
      client.request("/api/orders", {
        method: "POST",
        body: orderBody(product.id, 4),
      }),
    ),
  );
  assert.equal(results.filter((result) => result.ok).length, 1);
  expectRejected(results.find((result) => !result.ok));
  const state = await client.state();
  assert.equal(state.products[0].stock, 1);
  assert.equal(state.orders.length, 1);
});

test("cancellation restores stock once and completed orders cannot be cancelled", async (t) => {
  const client = await fixture(t);
  const product = await client.product({ stock: 10 });
  assert.ok(
    (
      await client.request("/api/orders", {
        method: "POST",
        body: orderBody(product.id, 3),
      })
    ).ok,
  );
  const order = (await client.state()).orders[0];
  assert.ok(
    (
      await client.request(`/api/orders/${order.id}`, {
        method: "PATCH",
        body: { status: "Hazır" },
      })
    ).ok,
  );
  assert.ok(
    (
      await client.request(`/api/orders/${order.id}`, {
        method: "PATCH",
        body: { status: "İptal" },
      })
    ).ok,
  );
  await client.request(`/api/orders/${order.id}`, {
    method: "PATCH",
    body: { status: "İptal" },
  });
  assert.equal((await client.state()).products[0].stock, 10);
  expectRejected(
    await client.request(`/api/orders/${order.id}`, {
      method: "PATCH",
      body: { status: "Hazır" },
    }),
  );

  assert.ok(
    (
      await client.request("/api/orders", {
        method: "POST",
        body: orderBody(product.id, 2),
      })
    ).ok,
  );
  const nextOrder = (await client.state()).orders.find(
    (item) => item.id !== order.id,
  );
  expectRejected(
    await client.request(`/api/orders/${nextOrder.id}`, {
      method: "PATCH",
      body: { status: "Tamamlandı" },
    }),
  );
  assert.ok(
    (
      await client.request(`/api/orders/${nextOrder.id}`, {
        method: "PATCH",
        body: { status: "Hazır" },
      })
    ).ok,
  );
  assert.ok(
    (
      await client.request(`/api/orders/${nextOrder.id}`, {
        method: "PATCH",
        body: { status: "Tamamlandı" },
      })
    ).ok,
  );
  expectRejected(
    await client.request(`/api/orders/${nextOrder.id}`, {
      method: "PATCH",
      body: { status: "İptal" },
    }),
  );
  assert.equal((await client.state()).products[0].stock, 8);
});

test("expenses validate real calendar dates and cent precision", async (t) => {
  const client = await fixture(t);
  const base = {
    description: "Elektrik",
    category: "Fatura",
    amount: 123.46,
    date: "2026-10-17",
  };
  const result = await client.request("/api/expenses", {
    method: "POST",
    body: base,
  });
  assert.ok(result.ok, JSON.stringify(result.data));
  let state = await client.state();
  assert.equal(state.expenses[0].amount, 123.46);
  for (const overrides of [
    { amount: -1 },
    { amount: 0 },
    { amount: "100" },
    { amount: 123.456 },
    { description: "" },
    { date: "2026-02-30" },
    { date: "2025-02-29" },
    { date: "2026-13-01" },
    { date: "17.10.2026" },
  ]) {
    expectRejected(
      await client.request("/api/expenses", {
        method: "POST",
        body: { ...base, ...overrides },
      }),
    );
  }
  assert.ok(
    (
      await client.request("/api/expenses", {
        method: "POST",
        body: { ...base, description: "Artık yıl", date: "2024-02-29" },
      })
    ).ok,
  );
  state = await client.state();
  assert.equal(state.expenses.length, 2);
  assert.ok(
    (
      await client.request(`/api/expenses/${state.expenses[0].id}`, {
        method: "DELETE",
      })
    ).ok,
  );
  assert.equal((await client.state()).expenses.length, 1);
});

test("employee and branch updates validate fields and persist after restart", async (t) => {
  const client = await fixture(t);
  const employee = {
    name: "Deniz",
    role: "Kasiyer",
    phone: "0555 000 00 00",
    salary: 28000.25,
  };
  assert.ok(
    (await client.request("/api/employees", { method: "POST", body: employee }))
      .ok,
  );
  let state = await client.state();
  const employeeId = state.employees[0].id;
  assert.equal(state.employees[0].salary, 28000.25);
  assert.equal(state.employees[0].active, true);
  for (const salary of [-1, "28000", 28000.123]) {
    expectRejected(
      await client.request(`/api/employees/${employeeId}`, {
        method: "PATCH",
        body: { salary },
      }),
    );
  }
  expectRejected(
    await client.request(`/api/employees/${employeeId}`, {
      method: "PATCH",
      body: { active: "false" },
    }),
  );
  assert.ok(
    (
      await client.request(`/api/employees/${employeeId}`, {
        method: "PATCH",
        body: { role: "Şube sorumlusu", salary: 32000.5, active: false },
      })
    ).ok,
  );
  expectRejected(
    await client.request("/api/settings", {
      method: "PATCH",
      body: { branchName: "Kaydedilmemeli", ownerName: "" },
    }),
  );
  assert.equal((await client.state()).settings.branchName, "Merkez Şube");
  assert.ok(
    (
      await client.request("/api/settings", {
        method: "PATCH",
        body: { branchName: "Kadıköy Şubesi", ownerName: "Ahmet B." },
      })
    ).ok,
  );
  await client.stop();
  await client.start();
  assert.ok(
    (
      await client.request("/api/login", {
        method: "POST",
        body: { password: PASSWORD },
      })
    ).ok,
  );
  state = await client.state();
  assert.equal(state.settings.branchName, "Kadıköy Şubesi");
  assert.equal(state.settings.ownerName, "Ahmet B.");
  assert.equal((await client.request("/api/auth")).data.user.name, "Ahmet B.");
  assert.equal(state.employees[0].id, employeeId);
  assert.equal(state.employees[0].role, "Şube sorumlusu");
  assert.equal(state.employees[0].salary, 32000.5);
  assert.equal(state.employees[0].active, false);
});

test("sample setup is explicitly marked and its stock movements reconcile", async (t) => {
  const client = await fixture(t, { initialize: false });
  assert.ok((await client.setup({ withDemo: true })).ok);
  const state = await client.state();
  assert.equal(state.settings.demoData, true);
  for (const key of [
    "products",
    "orders",
    "expenses",
    "employees",
    "movements",
  ]) {
    assert.ok(state[key].length > 0, `demo should include ${key}`);
  }
  for (const order of state.orders) assert.match(order.customer, /Örnek/i);
  for (const employee of state.employees) assert.match(employee.name, /Örnek/i);
  for (const expense of state.expenses)
    assert.match(expense.description, /Örnek/i);
  for (const product of state.products) {
    const movementTotal = state.movements
      .filter((movement) => movement.productId === product.id)
      .reduce((total, movement) => total + movement.quantity, 0);
    assert.equal(product.stock, movementTotal);
    assert.ok(product.stock >= 0);
  }
});

test("owner credentials and business records persist after reopening the database", async (t) => {
  const client = await fixture(t);
  const product = await client.product({ name: "Kalıcı Dürüm", stock: 7 });
  assert.ok(
    (
      await client.request("/api/orders", {
        method: "POST",
        body: orderBody(product.id, 2),
      })
    ).ok,
  );
  const before = await client.state();
  await client.stop();
  await client.start();
  assert.equal((await client.request("/api/auth")).data.initialized, true);
  assert.equal((await client.request("/api/state")).status, 401);
  assert.equal((await client.setup()).status, 409);
  assert.ok(
    (
      await client.request("/api/login", {
        method: "POST",
        body: { password: PASSWORD },
      })
    ).ok,
  );
  const after = await client.state();
  assert.equal(after.products[0].id, product.id);
  assert.equal(after.products[0].stock, 5);
  assert.equal(after.orders[0].id, before.orders[0].id);
  assert.equal(after.orders[0].total, 180);
});
