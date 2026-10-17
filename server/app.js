import express from "express";
import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const SESSION_SECONDS = 7 * 24 * 60 * 60;
const COOKIE = "kmg_finance_session";
const TYPES = ["income", "expense"];
const ACCOUNTS = ["Nakit", "Banka", "Kart"];
const STATUSES = ["paid", "pending"];

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (message, status = 400) => {
  throw new ApiError(status, message);
};
const has = (object, key) => Object.hasOwn(object, key);
function text(value, label, maximum = 100, optional = false) {
  if (value === undefined && optional) return "";
  if (
    typeof value !== "string" ||
    (!optional && !value.trim()) ||
    value.trim().length > maximum
  )
    fail(`${label} geçerli olmalı (en fazla ${maximum} karakter).`);
  return value.trim();
}
function number(value, label, min = 0, max = 10_000_000, scale = 100) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    fail(`${label} geçerli bir sayı olmalı.`);
  const scaled = Math.round(value * scale);
  if (Math.abs(value * scale - scaled) > 0.00001)
    fail(
      `${label} en fazla ${scale === 100 ? "iki" : "üç"} ondalık basamak içerebilir.`,
    );
  return scaled;
}
function boolean(value, label) {
  if (typeof value !== "boolean") fail(`${label} geçerli olmalı.`);
  return value ? 1 : 0;
}
function choice(value, values, label) {
  if (!values.includes(value)) fail(`${label} geçerli olmalı.`);
  return value;
}
function date(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    fail("Tarih YYYY-AA-GG biçiminde olmalı.");
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value ||
    value < "2000-01-01" ||
    value > "2100-12-31"
  )
    fail("Geçerli bir tarih girin.");
  return value;
}
function objectBody(req) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body))
    fail("Geçerli bir istek gönderin.");
  return req.body;
}
function rejectUnknown(body, allowed) {
  if (Object.keys(body).some((key) => !allowed.includes(key)))
    fail("Desteklenmeyen bir alan gönderildi.");
}
function secret(password) {
  if (
    typeof password !== "string" ||
    password.length < 10 ||
    password.length > 200
  )
    fail("Parola 10 ile 200 karakter arasında olmalı.");
  return password;
}
const tokenHash = (token) => createHash("sha256").update(token).digest("hex");

export function createApp({
  dbPath = resolve(
    process.env.DATA_DIR || "data-finans",
    "komagene-finans.sqlite",
  ),
  staticDir,
} = {}) {
  if (dbPath !== ":memory:")
    mkdirSync(dirname(resolve(dbPath)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA foreign_keys=ON;
    PRAGMA journal_mode=WAL;
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS owners (id INTEGER PRIMARY KEY CHECK(id=1), name TEXT NOT NULL, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), branch_name TEXT NOT NULL, demo_data INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, type TEXT NOT NULL CHECK(type IN ('income','expense')), name TEXT NOT NULL, color TEXT NOT NULL, UNIQUE(type,name));
    CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, type TEXT NOT NULL CHECK(type IN ('income','expense')), category_id TEXT NOT NULL REFERENCES categories(id), amount_cents INTEGER NOT NULL CHECK(amount_cents>0), date TEXT NOT NULL, account TEXT NOT NULL CHECK(account IN ('Nakit','Banka','Kart')), status TEXT NOT NULL CHECK(status IN ('paid','pending')), description TEXT NOT NULL, counterparty TEXT NOT NULL DEFAULT '', reference TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS entries_date ON entries(date);
    CREATE INDEX IF NOT EXISTS entries_category ON entries(category_id);
  `);
  function transaction(action) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = action();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  let configuredOrigin;
  if (process.env.APP_ORIGIN) {
    const url = new URL(process.env.APP_ORIGIN);
    if (!["http:", "https:"].includes(url.protocol))
      throw new Error("APP_ORIGIN http veya https adresi olmalı.");
    configuredOrigin = url.origin;
  }
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    if (req.path === "/api" || req.path.startsWith("/api/"))
      res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(
    ["/api/import", "/api/import/preview"],
    express.json({ limit: "8mb", strict: true }),
  );
  app.use(express.json({ limit: "64kb", strict: true }));
  app.use("/api", (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("origin")) {
      try {
        const origin = new URL(req.get("origin"));
        const expected = `${req.protocol}://${req.get("host")}`;
        if (origin.origin !== expected && origin.origin !== configuredOrigin)
          return next(
            new ApiError(
              403,
              "Bu kaynaktan işlem yapılamaz. Sayfayı yeniden açın.",
            ),
          );
      } catch {
        return next(new ApiError(403, "İstek kaynağı doğrulanamadı."));
      }
    }
    next();
  });
  function getUser(req) {
    const cookie = (req.get("cookie") || "")
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE}=`));
    if (!cookie) return null;
    const token = cookie.slice(COOKIE.length + 1);
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const session = db
      .prepare("SELECT expires_at FROM sessions WHERE token_hash=?")
      .get(tokenHash(token));
    if (!session || session.expires_at <= Date.now()) return null;
    return db.prepare("SELECT name FROM owners WHERE id=1").get() || null;
  }
  function setSession(req, res) {
    const token = randomBytes(32).toString("hex");
    db.prepare("DELETE FROM sessions WHERE expires_at<=?").run(Date.now());
    db.prepare("INSERT INTO sessions(token_hash,expires_at) VALUES(?,?)").run(
      tokenHash(token),
      Date.now() + SESSION_SECONDS * 1000,
    );
    res.cookie(COOKIE, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: req.secure || process.env.COOKIE_SECURE === "true",
      path: "/",
      maxAge: SESSION_SECONDS * 1000,
    });
  }
  app.get("/api/health", (req, res) => res.json({ ok: true }));
  app.get("/api/auth", (req, res) =>
    res.json({
      initialized: Boolean(
        db.prepare("SELECT id FROM owners WHERE id=1").get(),
      ),
      user: getUser(req),
    }),
  );
  app.post("/api/setup", (req, res) => {
    const body = objectBody(req);
    rejectUnknown(body, ["name", "password", "branchName", "withDemo"]);
    const name = text(body.name, "İsim");
    const branchName = text(body.branchName, "Şube adı");
    const password = secret(body.password);
    const withDemo =
      body.withDemo === undefined
        ? false
        : Boolean(boolean(body.withDemo, "Örnek veri seçimi"));
    if (db.prepare("SELECT id FROM owners WHERE id=1").get())
      fail("İlk kurulum daha önce tamamlandı.", 409);
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync(password, salt, 64).toString("hex");
    transaction(() => {
      if (db.prepare("SELECT id FROM owners WHERE id=1").get())
        fail("İlk kurulum daha önce tamamlandı.", 409);
      db.prepare(
        "INSERT INTO owners(id,name,password_salt,password_hash) VALUES(1,?,?,?)",
      ).run(name, salt, hash);
      db.prepare(
        "INSERT INTO settings(id,branch_name,demo_data) VALUES(1,?,?)",
      ).run(branchName, Number(withDemo));
      seedCategories();
      if (withDemo) seedDemo();
    });
    setSession(req, res);
    res.status(201).json({ ok: true });
  });
  const attempts = new Map();
  app.post("/api/login", (req, res) => {
    const body = objectBody(req);
    const key = req.ip || "unknown";
    const now = Date.now();
    let attempt = attempts.get(key);
    if (attempt && now - attempt.start >= 15 * 60 * 1000) {
      attempts.delete(key);
      attempt = undefined;
    }
    if (attempt && attempt.count >= 8) {
      res.setHeader("Retry-After", "900");
      fail("Çok fazla başarısız deneme. 15 dakika sonra tekrar deneyin.", 429);
    }
    const owner = db.prepare("SELECT * FROM owners WHERE id=1").get();
    if (!owner) fail("Önce ilk kurulumu tamamlayın.", 409);
    const password =
      typeof body.password === "string" && body.password.length <= 200
        ? body.password
        : "";
    const actual = scryptSync(password, owner.password_salt, 64);
    if (!timingSafeEqual(actual, Buffer.from(owner.password_hash, "hex"))) {
      if (attempts.size > 1000) attempts.delete(attempts.keys().next().value);
      attempts.set(key, {
        start: attempt?.start || now,
        count: (attempt?.count || 0) + 1,
      });
      fail("Parola hatalı.", 401);
    }
    attempts.delete(key);
    setSession(req, res);
    res.json({ ok: true });
  });
  app.post("/api/logout", (req, res) => {
    const cookie = (req.get("cookie") || "")
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${COOKIE}=`));
    if (cookie)
      db.prepare("DELETE FROM sessions WHERE token_hash=?").run(
        tokenHash(cookie.slice(COOKIE.length + 1)),
      );
    res.clearCookie(COOKIE, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      secure: req.secure || process.env.COOKIE_SECURE === "true",
    });
    res.json({ ok: true });
  });
  app.use("/api", (req, res, next) => {
    if (!getUser(req))
      return next(new ApiError(401, "Devam etmek için giriş yapın."));
    next();
  });

  const entryFields = [
    "type",
    "categoryId",
    "amount",
    "date",
    "account",
    "status",
    "description",
    "counterparty",
    "reference",
    "notes",
  ];
  const uuid = (value) =>
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    );
  function color(value) {
    if (typeof value !== "string" || !/^#[0-9a-f]{6}$/i.test(value))
      fail("Kategori rengi geçerli olmalı.");
    return value;
  }
  function categoryData(body) {
    rejectUnknown(body, ["id", "type", "name", "color"]);
    return {
      type: choice(body.type, TYPES, "Kategori türü"),
      name: text(body.name, "Kategori adı", 60),
      color: color(body.color),
    };
  }
  function validateEntry(body) {
    const type = choice(body.type, TYPES, "İşlem türü");
    const categoryId = text(body.categoryId, "Kategori", 100);
    const category = db
      .prepare("SELECT * FROM categories WHERE id=?")
      .get(categoryId);
    if (!category || category.type !== type)
      fail("İşlem türüne uygun bir kategori seçin.");
    return {
      type,
      categoryId,
      amount: number(body.amount, "Tutar", 0.01, 100_000_000),
      date: date(body.date),
      account: choice(body.account, ACCOUNTS, "Hesap"),
      status: choice(body.status, STATUSES, "Ödeme durumu"),
      description: text(body.description, "Açıklama", 200),
      counterparty: text(body.counterparty, "Kişi / firma", 100, true),
      reference: text(body.reference, "Belge numarası", 100, true),
      notes: text(body.notes, "Not", 2000, true),
    };
  }
  function insertEntry(
    id,
    entry,
    createdAt = new Date().toISOString(),
    updatedAt = createdAt,
  ) {
    db.prepare(
      "INSERT INTO entries(id,type,category_id,amount_cents,date,account,status,description,counterparty,reference,notes,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      entry.type,
      entry.categoryId,
      entry.amount,
      entry.date,
      entry.account,
      entry.status,
      entry.description,
      entry.counterparty,
      entry.reference,
      entry.notes,
      createdAt,
      updatedAt,
    );
  }
  function state() {
    const settings = db.prepare("SELECT * FROM settings WHERE id=1").get();
    const owner = db.prepare("SELECT name FROM owners WHERE id=1").get();
    const categories = db
      .prepare("SELECT * FROM categories ORDER BY type,name COLLATE NOCASE")
      .all();
    const entries = db
      .prepare(
        "SELECT e.*,c.name AS category FROM entries e JOIN categories c ON c.id=e.category_id ORDER BY e.date DESC,e.created_at DESC,e.rowid DESC",
      )
      .all()
      .map((e) => ({
        id: e.id,
        type: e.type,
        categoryId: e.category_id,
        category: e.category,
        amount: e.amount_cents / 100,
        date: e.date,
        account: e.account,
        status: e.status,
        description: e.description,
        counterparty: e.counterparty,
        reference: e.reference,
        notes: e.notes,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
      }));
    return {
      settings: {
        branchName: settings.branch_name,
        ownerName: owner.name,
        demoData: Boolean(settings.demo_data),
      },
      categories,
      entries,
      generatedAt: new Date().toISOString(),
    };
  }
  app.get("/api/state", (req, res) => res.json(state()));
  app.post("/api/entries", (req, res) => {
    const body = objectBody(req);
    rejectUnknown(body, entryFields);
    const id = randomUUID();
    const entry = validateEntry(body);
    insertEntry(id, entry);
    res.status(201).json({ ok: true, id });
  });
  app.patch("/api/entries/:id", (req, res) => {
    const body = objectBody(req);
    rejectUnknown(body, entryFields);
    const current = db
      .prepare("SELECT * FROM entries WHERE id=?")
      .get(req.params.id);
    if (!current) fail("Kayıt bulunamadı.", 404);
    const entry = validateEntry({
      type: current.type,
      categoryId: current.category_id,
      amount: current.amount_cents / 100,
      date: current.date,
      account: current.account,
      status: current.status,
      description: current.description,
      counterparty: current.counterparty,
      reference: current.reference,
      notes: current.notes,
      ...body,
    });
    db.prepare(
      "UPDATE entries SET type=?,category_id=?,amount_cents=?,date=?,account=?,status=?,description=?,counterparty=?,reference=?,notes=?,updated_at=? WHERE id=?",
    ).run(
      entry.type,
      entry.categoryId,
      entry.amount,
      entry.date,
      entry.account,
      entry.status,
      entry.description,
      entry.counterparty,
      entry.reference,
      entry.notes,
      new Date().toISOString(),
      current.id,
    );
    res.json({ ok: true });
  });
  app.delete("/api/entries/:id", (req, res) => {
    if (
      !db.prepare("DELETE FROM entries WHERE id=?").run(req.params.id).changes
    )
      fail("Kayıt bulunamadı.", 404);
    res.json({ ok: true });
  });
  app.post("/api/categories", (req, res) => {
    const body = objectBody(req);
    rejectUnknown(body, ["type", "name", "color"]);
    const value = categoryData(body);
    const id = randomUUID();
    if (
      db
        .prepare("SELECT id FROM categories WHERE type=? AND name=?")
        .get(value.type, value.name)
    )
      fail("Bu türde aynı isimli kategori zaten var.", 409);
    db.prepare(
      "INSERT INTO categories(id,type,name,color) VALUES(?,?,?,?)",
    ).run(id, value.type, value.name, value.color);
    res.status(201).json({ ok: true, id });
  });
  app.patch("/api/categories/:id", (req, res) => {
    const body = objectBody(req);
    rejectUnknown(body, ["name", "color"]);
    const current = db
      .prepare("SELECT * FROM categories WHERE id=?")
      .get(req.params.id);
    if (!current) fail("Kategori bulunamadı.", 404);
    const value = categoryData({ ...current, ...body });
    if (
      db
        .prepare("SELECT id FROM categories WHERE type=? AND name=? AND id<>?")
        .get(value.type, value.name, current.id)
    )
      fail("Bu türde aynı isimli kategori zaten var.", 409);
    db.prepare("UPDATE categories SET name=?,color=? WHERE id=?").run(
      value.name,
      value.color,
      current.id,
    );
    res.json({ ok: true });
  });
  app.delete("/api/categories/:id", (req, res) => {
    if (
      db
        .prepare("SELECT id FROM entries WHERE category_id=? LIMIT 1")
        .get(req.params.id)
    )
      fail(
        "Kullanılan kategori silinemez. Önce kayıtları başka kategoriye taşıyın.",
        409,
      );
    if (
      !db.prepare("DELETE FROM categories WHERE id=?").run(req.params.id)
        .changes
    )
      fail("Kategori bulunamadı.", 404);
    res.json({ ok: true });
  });
  function summarize(rows) {
    let income = 0,
      expense = 0,
      pendingIncome = 0,
      pendingExpense = 0,
      paidCount = 0;
    for (const e of rows) {
      if (e.status === "pending") {
        if (e.type === "income") pendingIncome += e.amount_cents;
        else pendingExpense += e.amount_cents;
      } else {
        paidCount++;
        if (e.type === "income") income += e.amount_cents;
        else expense += e.amount_cents;
      }
    }
    return {
      income: income / 100,
      expense: expense / 100,
      balance: (income - expense) / 100,
      pendingIncome: pendingIncome / 100,
      pendingExpense: pendingExpense / 100,
      count: rows.length,
      paidCount,
    };
  }
  function report(from, to) {
    const rows = db
      .prepare("SELECT * FROM entries WHERE date>=? AND date<=? ORDER BY date")
      .all(from, to);
    const paid = rows.filter((e) => e.status === "paid");
    const grouped = (key) => {
      const map = new Map();
      for (const e of paid) {
        const name = key(e);
        if (!map.has(name)) map.set(name, []);
        map.get(name).push(e);
      }
      return [...map].map(([period, entries]) => ({
        period,
        ...summarize(entries),
      }));
    };
    const categories = db
      .prepare("SELECT * FROM categories ORDER BY name")
      .all()
      .map((c) => {
        const entries = paid.filter((e) => e.category_id === c.id);
        return {
          ...c,
          total: entries.reduce((s, e) => s + e.amount_cents, 0) / 100,
          count: entries.length,
        };
      })
      .filter((c) => c.count > 0)
      .sort((a, b) => b.total - a.total);
    return {
      summary: summarize(rows),
      months: grouped((e) => e.date.slice(0, 7)),
      days: grouped((e) => e.date),
      categories,
      accounts: ACCOUNTS.map((name) => ({
        name,
        ...summarize(paid.filter((e) => e.account === name)),
      })),
    };
  }
  function previousRange(from, to) {
    if (from === "2000-01-01" && to === "2100-12-31") return null;
    const f = new Date(from + "T12:00:00Z"),
      t = new Date(to + "T12:00:00Z");
    if (from.endsWith("-01-01") && to === from.slice(0, 4) + "-12-31")
      return {
        from: `${f.getUTCFullYear() - 1}-01-01`,
        to: `${f.getUTCFullYear() - 1}-12-31`,
      };
    const last = new Date(
      Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 0, 12),
    )
      .toISOString()
      .slice(0, 10);
    if (from.endsWith("-01") && to === last) {
      const pf = new Date(
        Date.UTC(f.getUTCFullYear(), f.getUTCMonth() - 1, 1, 12),
      );
      const pt = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth(), 0, 12));
      return {
        from: pf.toISOString().slice(0, 10),
        to: pt.toISOString().slice(0, 10),
      };
    }
    const length = t.getTime() - f.getTime() + 86400000;
    return {
      from: new Date(f.getTime() - length).toISOString().slice(0, 10),
      to: new Date(f.getTime() - 86400000).toISOString().slice(0, 10),
    };
  }
  app.get("/api/reports", (req, res) => {
    const from = date(req.query.from),
      to = date(req.query.to);
    if (from > to) fail("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
    const previous = previousRange(from, to);
    const years = db
      .prepare(
        "SELECT substr(date,1,4) AS year FROM entries GROUP BY year ORDER BY year DESC",
      )
      .all()
      .map(({ year }) => ({
        year: Number(year),
        ...summarize(
          db
            .prepare("SELECT * FROM entries WHERE date>=? AND date<=?")
            .all(`${year}-01-01`, `${year}-12-31`),
        ),
      }));
    res.json({
      from,
      to,
      ...report(from, to),
      previous: previous
        ? { ...previous, ...report(previous.from, previous.to) }
        : null,
      years,
    });
  });
  app.patch("/api/settings", (req, res) => {
    const body = objectBody(req);
    rejectUnknown(body, ["branchName", "ownerName"]);
    const branchName = has(body, "branchName")
      ? text(body.branchName, "İşletme adı")
      : undefined;
    const ownerName = has(body, "ownerName")
      ? text(body.ownerName, "Yönetici adı")
      : undefined;
    transaction(() => {
      if (branchName !== undefined)
        db.prepare("UPDATE settings SET branch_name=? WHERE id=1").run(
          branchName,
        );
      if (ownerName !== undefined)
        db.prepare("UPDATE owners SET name=? WHERE id=1").run(ownerName);
    });
    res.json({ ok: true });
  });
  app.post("/api/password", (req, res) => {
    const body = objectBody(req);
    rejectUnknown(body, ["currentPassword", "newPassword"]);
    const owner = db.prepare("SELECT * FROM owners WHERE id=1").get();
    if (
      typeof body.currentPassword !== "string" ||
      body.currentPassword.length > 200 ||
      !timingSafeEqual(
        scryptSync(body.currentPassword, owner.password_salt, 64),
        Buffer.from(owner.password_hash, "hex"),
      )
    )
      fail("Mevcut şifre doğru değil.", 400);
    const next = secret(body.newPassword);
    const salt = randomBytes(16).toString("hex");
    transaction(() => {
      db.prepare(
        "UPDATE owners SET password_salt=?,password_hash=? WHERE id=1",
      ).run(salt, scryptSync(next, salt, 64).toString("hex"));
      db.prepare("DELETE FROM sessions").run();
    });
    setSession(req, res);
    res.json({ ok: true });
  });
  app.get("/api/export", (req, res) => {
    const value = state();
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="komagene-finans-${new Date().toISOString().slice(0, 10)}.json"`,
    );
    res.json({
      format: "komagene-finance",
      version: 1,
      exportedAt: new Date().toISOString(),
      settings: value.settings,
      categories: value.categories,
      entries: value.entries,
    });
  });
  function importData(body, preview = false) {
    rejectUnknown(body, [
      "format",
      "version",
      "exportedAt",
      "settings",
      "categories",
      "entries",
    ]);
    if (
      body.format !== "komagene-finance" ||
      body.version !== 1 ||
      !Array.isArray(body.categories) ||
      !Array.isArray(body.entries) ||
      body.categories.length > 500 ||
      body.entries.length > 20000
    )
      fail(
        "Geçerli bir Komagene Finans yedeği seçin (en fazla 500 kategori, 20.000 kayıt).",
      );
    let added = 0,
      skipped = 0,
      categoriesAdded = 0;
    // A savepoint rolls preview back and makes a full import atomic.
    db.exec("SAVEPOINT finance_import");
    try {
      const seenCategories = new Set(),
        seenEntries = new Set(),
        seenCategoryNames = new Set();
      for (const c of body.categories) {
        if (
          !c ||
          typeof c !== "object" ||
          Array.isArray(c) ||
          !uuid(c.id) ||
          seenCategories.has(c.id)
        )
          fail("Yedekte geçersiz veya tekrar eden kategori var.");
        seenCategories.add(c.id);
        const value = categoryData(c);
        const categoryKey = value.type + "|" + value.name;
        if (seenCategoryNames.has(categoryKey))
          fail("Yedekte tekrar eden kategori adı var.");
        seenCategoryNames.add(categoryKey);
        const existing = db
          .prepare("SELECT * FROM categories WHERE id=?")
          .get(c.id);
        if (existing) {
          if (existing.type !== value.type)
            fail("Yedekteki kategori türü mevcut kategoriyle çakışıyor.", 409);
          if (existing.name !== value.name || existing.color !== value.color) {
            if (
              db
                .prepare("SELECT id FROM entries WHERE category_id=? LIMIT 1")
                .get(c.id)
            )
              fail(
                "Yedekteki kategori mevcut kategoriyle çakışıyor. Mevcut veriler değiştirilmedi.",
                409,
              );
            const collision = db
              .prepare(
                "SELECT id FROM categories WHERE type=? AND name=? AND id<>?",
              )
              .get(value.type, value.name, c.id);
            if (collision)
              fail("Kategori adı mevcut başka kategoriyle çakışıyor.", 409);
            db.prepare("UPDATE categories SET name=?,color=? WHERE id=?").run(
              value.name,
              value.color,
              c.id,
            );
          }
        } else {
          const collision = db
            .prepare("SELECT id FROM categories WHERE type=? AND name=?")
            .get(value.type, value.name);
          if (collision) {
            if (
              db
                .prepare("SELECT id FROM entries WHERE category_id=? LIMIT 1")
                .get(collision.id)
            )
              fail(
                "Yedekte aynı isimli farklı bir kategori var. Boş bir işletmeye geri yükleyin.",
                409,
              );
            db.prepare("DELETE FROM categories WHERE id=?").run(collision.id);
          }
          db.prepare(
            "INSERT INTO categories(id,type,name,color) VALUES(?,?,?,?)",
          ).run(c.id, value.type, value.name, value.color);
          categoriesAdded++;
        }
      }
      for (const e of body.entries) {
        if (
          !e ||
          typeof e !== "object" ||
          Array.isArray(e) ||
          !uuid(e.id) ||
          seenEntries.has(e.id)
        )
          fail("Yedekte geçersiz veya tekrar eden kayıt var.");
        seenEntries.add(e.id);
        rejectUnknown(e, [
          ...entryFields,
          "id",
          "category",
          "createdAt",
          "updatedAt",
        ]);
        const value = validateEntry(
          Object.fromEntries(entryFields.map((k) => [k, e[k]])),
        );
        for (const key of ["createdAt", "updatedAt"])
          if (
            typeof e[key] !== "string" ||
            !/^\d{4}-\d{2}-\d{2}T/.test(e[key]) ||
            !Number.isFinite(Date.parse(e[key]))
          )
            fail("Yedekte geçersiz kayıt zamanı var.");
        const existing = db
          .prepare("SELECT * FROM entries WHERE id=?")
          .get(e.id);
        if (existing) {
          const equal =
            existing.type === value.type &&
            existing.category_id === value.categoryId &&
            existing.amount_cents === value.amount &&
            [
              "date",
              "account",
              "status",
              "description",
              "counterparty",
              "reference",
              "notes",
            ].every((k) => existing[k] === value[k]);
          if (!equal)
            fail(
              "Yedekteki kayıt mevcut kayıtla çakışıyor. Mevcut veriler değiştirilmedi.",
              409,
            );
          skipped++;
        } else {
          insertEntry(e.id, value, e.createdAt, e.updatedAt);
          added++;
        }
      }
      if (body.settings?.demoData === true)
        db.prepare("UPDATE settings SET demo_data=1 WHERE id=1").run();
      if (preview) db.exec("ROLLBACK TO finance_import");
      db.exec("RELEASE finance_import");
      return { ok: true, added, skipped, categoriesAdded };
    } catch (error) {
      db.exec("ROLLBACK TO finance_import");
      db.exec("RELEASE finance_import");
      throw error;
    }
  }
  app.post("/api/import/preview", (req, res) =>
    res.json(importData(objectBody(req), true)),
  );
  app.post("/api/import", (req, res) => res.json(importData(objectBody(req))));

  app.use("/api", (req, res) =>
    res.status(404).json({ error: "İşlem bulunamadı." }),
  );
  if (staticDir) {
    const directory = resolve(staticDir);
    app.use((req, res, next) => {
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
      next();
    });
    app.use(express.static(directory));
    app.get("/{*path}", (req, res, next) => {
      if (
        !req.get("accept")?.includes("text/html") ||
        req.path.startsWith("/assets/") ||
        !existsSync(resolve(directory, "index.html"))
      )
        return next();
      res.sendFile(resolve(directory, "index.html"));
    });
  }
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === "entity.too.large")
      return res.status(413).json({ error: "İstek çok büyük." });
    if (error instanceof SyntaxError && error.status === 400)
      return res.status(400).json({ error: "Geçerli JSON verisi gönderin." });
    if (error instanceof ApiError)
      return res.status(error.status).json({ error: error.message });
    console.error(
      "İşlem sırasında beklenmeyen hata:",
      error.code || error.name,
    );
    res
      .status(500)
      .json({ error: "İşlem tamamlanamadı. Lütfen tekrar deneyin." });
  });
  app.locals.close = () => db.close();

  function seedCategories() {
    const categories = [
      ["income", "Şube satışı", "#20a477"],
      ["income", "Paket servis", "#4b87db"],
      ["income", "Diğer gelir", "#8e72d4"],
      ["expense", "Malzeme alımı", "#f08035"],
      ["expense", "Kira", "#6174d1"],
      ["expense", "Personel", "#b57cce"],
      ["expense", "Faturalar", "#e4ad43"],
      ["expense", "Ambalaj", "#44a2aa"],
      ["expense", "Ulaşım", "#d78698"],
      ["expense", "Vergi / harç", "#8a98a8"],
      ["expense", "Diğer gider", "#ac9278"],
    ];
    categories.forEach(([type, name, color]) => {
      const h = createHash("sha256")
        .update("finance:" + type + ":" + name)
        .digest("hex");
      const id = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
      db.prepare(
        "INSERT INTO categories(id,type,name,color) VALUES(?,?,?,?)",
      ).run(id, type, name, color);
    });
  }
  function seedDemo() {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const year = Number(today.slice(0, 4)),
      month = Number(today.slice(5, 7));
    const cats = db.prepare("SELECT * FROM categories").all();
    function add(
      type,
      name,
      amount,
      day,
      description,
      status = "paid",
      account = "Nakit",
    ) {
      const categoryId = cats.find(
        (c) => c.type === type && c.name === name,
      ).id;
      insertEntry(
        randomUUID(),
        validateEntry({
          type,
          categoryId,
          amount,
          date: day,
          account,
          status,
          description: "Örnek · " + description,
          counterparty: "",
          reference: "",
          notes: "Tanıtım için oluşturulmuş örnek kayıttır.",
        }),
      );
    }
    for (let y = year - 1; y <= year; y++)
      for (let m = 1; m <= 12; m++) {
        if (y === year && m > month) continue;
        const period = `${y}-${String(m).padStart(2, "0")}`;
        for (let d of [1, 5, 10, 15, 20, 25]) {
          const day = period + "-" + String(d).padStart(2, "0");
          if (day > today) continue;
          add(
            "income",
            "Şube satışı",
            4850 + m * 145 + d * 18,
            day,
            "Günlük şube geliri",
            "paid",
            d % 2 ? "Nakit" : "Kart",
          );
          add(
            "income",
            "Paket servis",
            1720 + m * 83 + d * 12,
            day,
            "Paket servis tahsilatı",
            "paid",
            "Banka",
          );
        }
        for (const [name, amount, d] of [
          ["Kira", 9500, 1],
          ["Malzeme alımı", 8350 + m * 110, 5],
          ["Personel", 15500, 10],
          ["Faturalar", 2240 + m * 32, 15],
          ["Ambalaj", 850 + m * 15, 10],
        ]) {
          const day = period + "-" + String(d).padStart(2, "0");
          if (day <= today)
            add(
              "expense",
              name,
              amount,
              day,
              name + " ödemesi",
              "paid",
              "Banka",
            );
        }
      }
    const pendingDate = `${year}-${String(month).padStart(2, "0")}-28`;
    add(
      "income",
      "Paket servis",
      3850,
      pendingDate,
      "Beklenen platform ödemesi",
      "pending",
      "Banka",
    );
    add(
      "expense",
      "Faturalar",
      1860,
      pendingDate,
      "Bekleyen elektrik faturası",
      "pending",
      "Banka",
    );
  }

  return app;
}
