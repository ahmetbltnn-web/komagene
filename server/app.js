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
const COOKIE = "kmg_session";
const CHANNELS = ["Şube", "Paket servis", "Gel-al"];
const PAYMENTS = ["Nakit", "Kart", "Online"];
const STATUSES = ["Hazırlanıyor", "Hazır", "Tamamlandı", "İptal"];

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
  dbPath = resolve(process.env.DATA_DIR || "data", "komagene.sqlite"),
  staticDir,
} = {}) {
  if (dbPath !== ":memory:")
    mkdirSync(dirname(resolve(dbPath)), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA foreign_keys=ON;
    PRAGMA journal_mode=WAL;
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS owners (id INTEGER PRIMARY KEY CHECK (id=1), name TEXT NOT NULL, password_salt TEXT NOT NULL, password_hash TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id=1), branch_name TEXT NOT NULL, demo_data INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL, price_cents INTEGER NOT NULL CHECK(price_cents>=0), cost_cents INTEGER NOT NULL CHECK(cost_cents>=0), stock_milli INTEGER NOT NULL CHECK(stock_milli>=0), min_stock_milli INTEGER NOT NULL CHECK(min_stock_milli>=0), unit TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)));
    CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, number INTEGER NOT NULL UNIQUE, customer TEXT NOT NULL, channel TEXT NOT NULL, payment TEXT NOT NULL, status TEXT NOT NULL, total_cents INTEGER NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), product_id TEXT NOT NULL REFERENCES products(id), name TEXT NOT NULL, quantity INTEGER NOT NULL CHECK(quantity>0), unit_price_cents INTEGER NOT NULL CHECK(unit_price_cents>=0), unit_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK(unit_cost_cents>=0));
    CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, description TEXT NOT NULL, category TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents>0), date TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS employees (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL, phone TEXT NOT NULL, salary_cents INTEGER NOT NULL CHECK(salary_cents>=0), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)));
    CREATE TABLE IF NOT EXISTS movements (id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), quantity_milli INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS movements_time ON movements(created_at);
  `);
  if (
    !db
      .prepare("PRAGMA table_info(settings)")
      .all()
      .some((column) => column.name === "demo_data")
  )
    db.exec(
      "ALTER TABLE settings ADD COLUMN demo_data INTEGER NOT NULL DEFAULT 0",
    );
  if (
    !db
      .prepare("PRAGMA table_info(order_items)")
      .all()
      .some((column) => column.name === "unit_cost_cents")
  )
    db.exec(
      "ALTER TABLE order_items ADD COLUMN unit_cost_cents INTEGER NOT NULL DEFAULT 0",
    );
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
  function state() {
    const settings = db
      .prepare("SELECT branch_name,demo_data FROM settings WHERE id=1")
      .get();
    const owner = db.prepare("SELECT name FROM owners WHERE id=1").get();
    const products = db
      .prepare("SELECT * FROM products ORDER BY rowid")
      .all()
      .map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        price: product.price_cents / 100,
        cost: product.cost_cents / 100,
        stock: product.stock_milli / 1000,
        minStock: product.min_stock_milli / 1000,
        unit: product.unit,
        active: Boolean(product.active),
      }));
    const allItems = db.prepare("SELECT * FROM order_items ORDER BY id").all();
    const itemsByOrder = new Map();
    for (const item of allItems) {
      if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
      itemsByOrder
        .get(item.order_id)
        .push({
          productId: item.product_id,
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unit_price_cents / 100,
          unitCost: item.unit_cost_cents / 100,
        });
    }
    const orders = db
      .prepare("SELECT * FROM orders ORDER BY created_at DESC, number DESC")
      .all()
      .map((order) => ({
        id: order.id,
        number: order.number,
        customer: order.customer,
        channel: order.channel,
        payment: order.payment,
        status: order.status,
        items: itemsByOrder.get(order.id) || [],
        total: order.total_cents / 100,
        createdAt: order.created_at,
      }));
    const expenses = db
      .prepare("SELECT * FROM expenses ORDER BY date DESC, rowid DESC")
      .all()
      .map((expense) => ({
        id: expense.id,
        description: expense.description,
        category: expense.category,
        amount: expense.amount_cents / 100,
        date: expense.date,
      }));
    const employees = db
      .prepare("SELECT * FROM employees ORDER BY rowid")
      .all()
      .map((employee) => ({
        id: employee.id,
        name: employee.name,
        role: employee.role,
        phone: employee.phone,
        salary: employee.salary_cents / 100,
        active: Boolean(employee.active),
      }));
    const movements = db
      .prepare(
        "SELECT m.*, p.name AS product_name FROM movements m JOIN products p ON p.id=m.product_id ORDER BY m.created_at DESC, m.rowid DESC",
      )
      .all()
      .map((movement) => ({
        id: movement.id,
        productId: movement.product_id,
        productName: movement.product_name,
        quantity: movement.quantity_milli / 1000,
        reason: movement.reason,
        createdAt: movement.created_at,
      }));
    return {
      settings: {
        branchName: settings.branch_name,
        ownerName: owner.name,
        demoData: Boolean(settings.demo_data),
      },
      products,
      orders,
      expenses,
      employees,
      movements,
      generatedAt: new Date().toISOString(),
    };
  }
  app.get("/api/state", (req, res) => res.json(state()));
  app.get("/api/export", (req, res) => {
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="komagene-yedek-${new Date().toISOString().slice(0, 10)}.json"`,
    );
    res.json(state());
  });
  function movement(
    productId,
    quantity,
    reason,
    createdAt = new Date().toISOString(),
  ) {
    db.prepare(
      "INSERT INTO movements(id,product_id,quantity_milli,reason,created_at) VALUES(?,?,?,?,?)",
    ).run(randomUUID(), productId, quantity, reason, createdAt);
  }
  app.post("/api/products", (req, res) => {
    const body = objectBody(req);
    rejectUnknown(body, [
      "name",
      "category",
      "price",
      "cost",
      "stock",
      "minStock",
      "unit",
    ]);
    const product = {
      id: randomUUID(),
      name: text(body.name, "Ürün adı"),
      category: text(body.category, "Kategori", 50),
      price: number(body.price, "Satış fiyatı"),
      cost: number(body.cost, "Maliyet"),
      stock: number(body.stock, "Stok", 0, 1_000_000, 1000),
      minStock: number(body.minStock, "Uyarı eşiği", 0, 1_000_000, 1000),
      unit: text(body.unit, "Birim", 20),
    };
    transaction(() => {
      db.prepare(
        "INSERT INTO products(id,name,category,price_cents,cost_cents,stock_milli,min_stock_milli,unit) VALUES(?,?,?,?,?,?,?,?)",
      ).run(
        product.id,
        product.name,
        product.category,
        product.price,
        product.cost,
        product.stock,
        product.minStock,
        product.unit,
      );
      if (product.stock > 0)
        movement(product.id, product.stock, "Açılış stoğu");
    });
    res.status(201).json({ ok: true, id: product.id });
  });
  app.patch("/api/products/:id", (req, res) => {
    const body = objectBody(req);
    rejectUnknown(body, [
      "name",
      "category",
      "price",
      "cost",
      "minStock",
      "unit",
      "active",
    ]);
    const product = db
      .prepare("SELECT * FROM products WHERE id=?")
      .get(req.params.id);
    if (!product) fail("Ürün bulunamadı.", 404);
    const updated = {
      name: has(body, "name") ? text(body.name, "Ürün adı") : product.name,
      category: has(body, "category")
        ? text(body.category, "Kategori", 50)
        : product.category,
      price: has(body, "price")
        ? number(body.price, "Satış fiyatı")
        : product.price_cents,
      cost: has(body, "cost")
        ? number(body.cost, "Maliyet")
        : product.cost_cents,
      minStock: has(body, "minStock")
        ? number(body.minStock, "Uyarı eşiği", 0, 1_000_000, 1000)
        : product.min_stock_milli,
      unit: has(body, "unit") ? text(body.unit, "Birim", 20) : product.unit,
      active: has(body, "active")
        ? boolean(body.active, "Aktiflik")
        : product.active,
    };
    db.prepare(
      "UPDATE products SET name=?,category=?,price_cents=?,cost_cents=?,min_stock_milli=?,unit=?,active=? WHERE id=?",
    ).run(
      updated.name,
      updated.category,
      updated.price,
      updated.cost,
      updated.minStock,
      updated.unit,
      updated.active,
      product.id,
    );
    res.json({ ok: true });
  });
  app.post("/api/stock", (req, res) => {
    const body = objectBody(req);
    rejectUnknown(body, ["productId", "quantity", "reason"]);
    const productId = text(body.productId, "Ürün", 100);
    const quantity = number(
      body.quantity,
      "Stok değişimi",
      -1_000_000,
      1_000_000,
      1000,
    );
    if (quantity === 0) fail("Stok değişimi sıfır olamaz.");
    const reason = text(body.reason, "Açıklama", 200);
    transaction(() => {
      const product = db
        .prepare("SELECT * FROM products WHERE id=?")
        .get(productId);
      if (!product) fail("Ürün bulunamadı.", 404);
      if (product.stock_milli + quantity < 0)
        fail("Stok miktarı sıfırın altına düşemez.", 409);
      if (product.stock_milli + quantity > 1_000_000_000)
        fail("Maksimum stok miktarı aşıldı.");
      db.prepare(
        "UPDATE products SET stock_milli=stock_milli+? WHERE id=?",
      ).run(quantity, productId);
      movement(productId, quantity, reason);
    });
    res.json({ ok: true });
  });
  function createOrder(
    body,
    { createdAt = new Date().toISOString(), status = "Hazırlanıyor" } = {},
  ) {
    rejectUnknown(body, ["customer", "channel", "payment", "items"]);
    const customer =
      text(
        body.customer === undefined ? "" : body.customer,
        "Müşteri",
        100,
        true,
      ) || "Misafir";
    const channel = choice(body.channel, CHANNELS, "Satış kanalı");
    const payment = choice(body.payment, PAYMENTS, "Ödeme yöntemi");
    if (
      !Array.isArray(body.items) ||
      body.items.length < 1 ||
      body.items.length > 100
    )
      fail("Sipariş 1 ile 100 ürün satırı içermeli.");
    const quantities = new Map();
    for (const item of body.items) {
      if (!item || typeof item !== "object" || Array.isArray(item))
        fail("Sipariş ürünü geçerli olmalı.");
      rejectUnknown(item, ["productId", "quantity"]);
      const id = text(item.productId, "Ürün", 100);
      if (
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 10_000
      )
        fail("Sipariş adedi 1 ile 10.000 arasında tam sayı olmalı.");
      const quantity = (quantities.get(id) || 0) + item.quantity;
      if (quantity > 10_000)
        fail("Bir ürün için en fazla 10.000 adet sipariş verilebilir.");
      quantities.set(id, quantity);
    }
    const items = [];
    for (const [id, quantity] of quantities) {
      const product = db.prepare("SELECT * FROM products WHERE id=?").get(id);
      if (!product || !product.active)
        fail("Siparişte satışa kapalı veya bulunamayan bir ürün var.", 409);
      if (product.stock_milli < quantity * 1000)
        fail(`${product.name} için yeterli stok yok.`, 409);
      items.push({ product, quantity });
    }
    const total = items.reduce(
      (sum, item) => sum + item.product.price_cents * item.quantity,
      0,
    );
    if (!Number.isSafeInteger(total) || total > 1_000_000_000_000)
      fail("Sipariş tutarı üst sınırı aşıldı.");
    const id = randomUUID();
    const orderNumber = db
      .prepare("SELECT COALESCE(MAX(number),1000)+1 AS number FROM orders")
      .get().number;
    db.prepare(
      "INSERT INTO orders(id,number,customer,channel,payment,status,total_cents,created_at) VALUES(?,?,?,?,?,?,?,?)",
    ).run(
      id,
      orderNumber,
      customer,
      channel,
      payment,
      status,
      total,
      createdAt,
    );
    for (const item of items) {
      db.prepare(
        "INSERT INTO order_items(order_id,product_id,name,quantity,unit_price_cents,unit_cost_cents) VALUES(?,?,?,?,?,?)",
      ).run(
        id,
        item.product.id,
        item.product.name,
        item.quantity,
        item.product.price_cents,
        item.product.cost_cents,
      );
      db.prepare(
        "UPDATE products SET stock_milli=stock_milli-? WHERE id=?",
      ).run(item.quantity * 1000, item.product.id);
      movement(
        item.product.id,
        -item.quantity * 1000,
        `Sipariş #${orderNumber}`,
        createdAt,
      );
    }
    return id;
  }
  app.post("/api/orders", (req, res) => {
    const id = transaction(() => createOrder(objectBody(req)));
    res.status(201).json({ ok: true, id });
  });
  app.patch("/api/orders/:id", (req, res) => {
    const body = objectBody(req);
    rejectUnknown(body, ["status"]);
    const target = choice(body.status, STATUSES, "Sipariş durumu");
    transaction(() => {
      const order = db
        .prepare("SELECT * FROM orders WHERE id=?")
        .get(req.params.id);
      if (!order) fail("Sipariş bulunamadı.", 404);
      if (order.status === target) return;
      const transitions = {
        Hazırlanıyor: ["Hazır", "İptal"],
        Hazır: ["Tamamlandı", "İptal"],
        Tamamlandı: [],
        İptal: [],
      };
      if (!transitions[order.status].includes(target))
        fail("Bu sipariş durumu değiştirilemez.", 409);
      if (target === "İptal") {
        const items = db
          .prepare("SELECT * FROM order_items WHERE order_id=?")
          .all(order.id);
        for (const item of items) {
          db.prepare(
            "UPDATE products SET stock_milli=stock_milli+? WHERE id=?",
          ).run(item.quantity * 1000, item.product_id);
          movement(
            item.product_id,
            item.quantity * 1000,
            `İptal: sipariş #${order.number}`,
          );
        }
      }
      db.prepare("UPDATE orders SET status=? WHERE id=?").run(target, order.id);
    });
    res.json({ ok: true });
  });
  app.post("/api/expenses", (req, res) => {
    const body = objectBody(req);
    rejectUnknown(body, ["description", "category", "amount", "date"]);
    const id = randomUUID();
    const amount = number(body.amount, "Gider tutarı", 0.01);
    db.prepare(
      "INSERT INTO expenses(id,description,category,amount_cents,date) VALUES(?,?,?,?,?)",
    ).run(
      id,
      text(body.description, "Açıklama", 200),
      text(body.category, "Kategori", 50),
      amount,
      date(body.date),
    );
    res.status(201).json({ ok: true, id });
  });
  app.delete("/api/expenses/:id", (req, res) => {
    const result = db
      .prepare("DELETE FROM expenses WHERE id=?")
      .run(req.params.id);
    if (!result.changes) fail("Gider bulunamadı.", 404);
    res.json({ ok: true });
  });
  app.post("/api/employees", (req, res) => {
    const body = objectBody(req);
    rejectUnknown(body, ["name", "role", "phone", "salary"]);
    const id = randomUUID();
    db.prepare(
      "INSERT INTO employees(id,name,role,phone,salary_cents) VALUES(?,?,?,?,?)",
    ).run(
      id,
      text(body.name, "Çalışan adı"),
      text(body.role, "Görev", 80),
      text(body.phone, "Telefon", 30, true),
      number(body.salary, "Aylık ücret"),
    );
    res.status(201).json({ ok: true, id });
  });
  app.patch("/api/employees/:id", (req, res) => {
    const body = objectBody(req);
    rejectUnknown(body, ["name", "role", "phone", "salary", "active"]);
    const employee = db
      .prepare("SELECT * FROM employees WHERE id=?")
      .get(req.params.id);
    if (!employee) fail("Çalışan bulunamadı.", 404);
    db.prepare(
      "UPDATE employees SET name=?,role=?,phone=?,salary_cents=?,active=? WHERE id=?",
    ).run(
      has(body, "name") ? text(body.name, "Çalışan adı") : employee.name,
      has(body, "role") ? text(body.role, "Görev", 80) : employee.role,
      has(body, "phone")
        ? text(body.phone, "Telefon", 30, true)
        : employee.phone,
      has(body, "salary")
        ? number(body.salary, "Aylık ücret")
        : employee.salary_cents,
      has(body, "active") ? boolean(body.active, "Aktiflik") : employee.active,
      employee.id,
    );
    res.json({ ok: true });
  });
  app.patch("/api/settings", (req, res) => {
    const body = objectBody(req);
    rejectUnknown(body, ["branchName", "ownerName"]);
    const branchName = has(body, "branchName")
      ? text(body.branchName, "Şube adı")
      : undefined;
    const ownerName = has(body, "ownerName")
      ? text(body.ownerName, "İşletmeci adı")
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

  function seedDemo() {
    const initial = [
      ["Dürüm", "Dürümler", 95, 32, 145, 20, "adet"],
      ["Mega Dürüm", "Dürümler", 125, 45, 85, 15, "adet"],
      ["Porsiyon Çiğköfte", "Porsiyonlar", 175, 66, 65, 15, "porsiyon"],
      ["Ayran", "İçecekler", 30, 12, 80, 20, "adet"],
      ["Şalgam", "İçecekler", 40, 18, 16, 15, "adet"],
      ["Dürüm Menü", "Menüler", 120, 43, 55, 10, "adet"],
    ];
    const productIds = initial.map((row) => {
      const id = randomUUID();
      db.prepare(
        "INSERT INTO products(id,name,category,price_cents,cost_cents,stock_milli,min_stock_milli,unit) VALUES(?,?,?,?,?,?,?,?)",
      ).run(
        id,
        row[0],
        row[1],
        row[2] * 100,
        row[3] * 100,
        row[4] * 1000,
        row[5] * 1000,
        row[6],
      );
      movement(
        id,
        row[4] * 1000,
        "Örnek açılış stoğu",
        new Date(Date.now() - 48 * 3600_000).toISOString(),
      );
      return id;
    });
    const now = new Date();
    const [year, month, day] = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .filter((part) => ["year", "month", "day"].includes(part.type))
      .sort(
        (a, b) =>
          ["year", "month", "day"].indexOf(a.type) -
          ["year", "month", "day"].indexOf(b.type),
      )
      .map((part) => part.value);
    const dayStart = new Date(
      `${year}-${month}-${day}T00:00:00+03:00`,
    ).getTime();
    const todaySpacing = Math.min(
      25 * 60_000,
      Math.floor((now.getTime() - dayStart) / 8),
    );
    const previousNoon = dayStart - 12 * 3600_000;
    for (let i = 0; i < 12; i++) {
      const today = i < 8;
      const createdAt = new Date(
        today
          ? now.getTime() - i * todaySpacing
          : previousNoon - (i - 8) * 35 * 60_000,
      ).toISOString();
      createOrder(
        {
          customer: `Örnek müşteri ${i + 1}`,
          channel: CHANNELS[i % 3],
          payment: PAYMENTS[i % 3],
          items: [
            { productId: productIds[i % 3], quantity: (i % 3) + 1 },
            { productId: productIds[3 + (i % 2)], quantity: 1 },
          ],
        },
        {
          createdAt,
          status: i < 2 ? "Hazırlanıyor" : i === 2 ? "Hazır" : "Tamamlandı",
        },
      );
    }
    db.prepare(
      "INSERT INTO expenses(id,description,category,amount_cents,date) VALUES(?,?,?,?,?)",
    ).run(
      randomUUID(),
      "Örnek ambalaj alımı",
      "Malzeme",
      45000,
      `${year}-${month}-${day}`,
    );
    db.prepare(
      "INSERT INTO expenses(id,description,category,amount_cents,date) VALUES(?,?,?,?,?)",
    ).run(
      randomUUID(),
      "Örnek elektrik gideri",
      "Faturalar",
      72500,
      `${year}-${month}-${day}`,
    );
    db.prepare(
      "INSERT INTO employees(id,name,role,phone,salary_cents) VALUES(?,?,?,?,?)",
    ).run(randomUUID(), "Örnek Çalışan 1", "Şube sorumlusu", "", 3200000);
    db.prepare(
      "INSERT INTO employees(id,name,role,phone,salary_cents) VALUES(?,?,?,?,?)",
    ).run(randomUUID(), "Örnek Çalışan 2", "Servis personeli", "", 2800000);
  }
  return app;
}
