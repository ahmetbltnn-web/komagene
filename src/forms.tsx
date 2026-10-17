import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Check,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import type { Mutation } from "./App";
import type { AppState, Employee, Product } from "./types";
import { money } from "./types";

function FormFooter({
  busy,
  close,
  label = "Kaydet",
}: {
  busy: boolean;
  close: () => void;
  label?: string;
}) {
  return (
    <div className="modal-footer">
      <button type="button" className="btn secondary" onClick={close}>
        Vazgeç
      </button>
      <button type="submit" className="btn primary" disabled={busy}>
        <Check size={17} />
        {busy ? "Kaydediliyor…" : label}
      </button>
    </div>
  );
}
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={"form-field" + (wide ? " span-2" : "")}>
      {label}
      {children}
    </label>
  );
}
const number = (form: FormData, name: string) => Number(form.get(name));

export function ProductForm({
  product,
  mutate,
  busy,
  close,
}: {
  product?: Product;
  mutate: Mutation;
  busy: boolean;
  close: () => void;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const data = {
      name: f.get("name"),
      category: f.get("category"),
      price: number(f, "price"),
      cost: number(f, "cost"),
      minStock: number(f, "minStock"),
      unit: f.get("unit"),
      ...(product
        ? { active: f.get("active") === "on" }
        : { stock: number(f, "stock") }),
    };
    if (
      await mutate(
        "/products" + (product ? "/" + product.id : ""),
        data,
        product ? "PATCH" : "POST",
      )
    )
      close();
  }
  return (
    <form onSubmit={submit}>
      <div className="modal-body form-grid">
        <Field label="Ürün adı" wide>
          <input
            name="name"
            required
            maxLength={100}
            defaultValue={product?.name}
            placeholder="Örn. Mega Dürüm"
          />
        </Field>
        <Field label="Kategori">
          <select
            name="category"
            defaultValue={product?.category || "Dürümler"}
          >
            {[
              "Dürümler",
              "Porsiyonlar",
              "Menüler",
              "İçecekler",
              "Ekstralar",
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Birim">
          <select name="unit" defaultValue={product?.unit || "adet"}>
            {["adet", "porsiyon", "kg", "litre", "paket"].map((unit) => (
              <option key={unit}>{unit}</option>
            ))}
          </select>
        </Field>
        <Field label="Satış fiyatı (₺)">
          <input
            name="price"
            type="number"
            required
            min="0.01"
            max="1000000"
            step="0.01"
            defaultValue={product?.price}
            placeholder="0,00"
          />
        </Field>
        <Field label="Birim maliyet (₺)">
          <input
            name="cost"
            type="number"
            required
            min="0"
            max="1000000"
            step="0.01"
            defaultValue={product?.cost ?? 0}
          />
        </Field>
        {!product && (
          <Field label="Başlangıç stoku">
            <input
              name="stock"
              type="number"
              required
              min="0"
              max="1000000"
              step="0.001"
              defaultValue="0"
            />
          </Field>
        )}
        <Field label="Minimum stok uyarısı">
          <input
            name="minStock"
            type="number"
            required
            min="0"
            max="1000000"
            step="0.001"
            defaultValue={product?.minStock ?? 10}
          />
        </Field>
        {product && (
          <label className="checkbox-field span-2">
            <input
              type="checkbox"
              name="active"
              defaultChecked={product.active}
            />
            <span>
              Ürün satışa açık
              <small>Kapalı ürünler yeni siparişlerde listelenmez.</small>
            </span>
          </label>
        )}
        <p className="field-hint span-2">
          Stok, satılabilir ürün bazında izlenir. Hammadde ve reçete takibi bu
          sürüme dahil değildir.
        </p>
      </div>
      <FormFooter busy={busy} close={close} />
    </form>
  );
}

export function StockForm({
  state,
  productId,
  mutate,
  busy,
  close,
}: {
  state: AppState;
  productId?: string;
  mutate: Mutation;
  busy: boolean;
  close: () => void;
}) {
  const [selected, setSelected] = useState(
    productId || state.products[0]?.id || "",
  );
  const [direction, setDirection] = useState("in");
  const product = state.products.find((p) => p.id === selected);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    if (
      await mutate("/stock", {
        productId: selected,
        quantity: number(f, "quantity") * (direction === "out" ? -1 : 1),
        reason: f.get("reason"),
      })
    )
      close();
  }
  return (
    <form onSubmit={submit}>
      <div className="modal-body form-stack">
        <Field label="Ürün">
          <select
            required
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="" disabled>
              Ürün seçin
            </option>
            {state.products.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        {product && (
          <div className="section-note">
            <Package size={18} />
            Mevcut stok:{" "}
            <strong>
              {product.stock} {product.unit}
            </strong>
          </div>
        )}
        <div className="form-grid">
          <Field label="İşlem türü">
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            >
              <option value="in">Stok girişi (+)</option>
              <option value="out">Stok çıkışı / fire (−)</option>
            </select>
          </Field>
          <Field label="Miktar">
            <input
              name="quantity"
              type="number"
              min="0.001"
              max="1000000"
              step="0.001"
              required
              placeholder="0"
            />
          </Field>
        </div>
        <Field label="Açıklama">
          <input
            name="reason"
            required
            minLength={2}
            maxLength={200}
            placeholder="Örn. Tedarikçi teslimatı / sayım düzeltmesi"
          />
        </Field>
      </div>
      <FormFooter busy={busy} close={close} label="Hareketi kaydet" />
    </form>
  );
}

export function ExpenseForm({
  mutate,
  busy,
  close,
  date,
}: {
  mutate: Mutation;
  busy: boolean;
  close: () => void;
  date: string;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    if (
      await mutate("/expenses", {
        description: f.get("description"),
        category: f.get("category"),
        amount: number(f, "amount"),
        date: f.get("date"),
      })
    )
      close();
  }
  return (
    <form onSubmit={submit}>
      <div className="modal-body form-grid">
        <Field label="Gider açıklaması" wide>
          <input
            name="description"
            required
            maxLength={200}
            placeholder="Örn. Ekim ayı elektrik faturası"
          />
        </Field>
        <Field label="Kategori">
          <select name="category">
            {[
              "Malzeme",
              "Kira",
              "Faturalar",
              "Personel",
              "Ulaşım",
              "Diğer",
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Tutar (₺)">
          <input
            name="amount"
            type="number"
            min="0.01"
            max="10000000"
            step="0.01"
            required
            placeholder="0,00"
          />
        </Field>
        <Field label="Tarih" wide>
          <input
            type="date"
            name="date"
            required
            defaultValue={date}
            max="2100-12-31"
            min="2000-01-01"
          />
        </Field>
      </div>
      <FormFooter busy={busy} close={close} />
    </form>
  );
}

export function EmployeeForm({
  employee,
  mutate,
  busy,
  close,
}: {
  employee?: Employee;
  mutate: Mutation;
  busy: boolean;
  close: () => void;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    if (
      await mutate(
        "/employees" + (employee ? "/" + employee.id : ""),
        {
          name: f.get("name"),
          role: f.get("role"),
          phone: f.get("phone"),
          salary: number(f, "salary"),
          ...(employee ? { active: f.get("active") === "on" } : {}),
        },
        employee ? "PATCH" : "POST",
      )
    )
      close();
  }
  return (
    <form onSubmit={submit}>
      <div className="modal-body form-grid">
        <Field label="Ad soyad" wide>
          <input
            name="name"
            required
            maxLength={100}
            defaultValue={employee?.name}
            placeholder="Personelin adı soyadı"
          />
        </Field>
        <Field label="Görev">
          <input
            name="role"
            required
            maxLength={80}
            defaultValue={employee?.role}
            placeholder="Örn. Kasiyer"
          />
        </Field>
        <Field label="Telefon">
          <input
            name="phone"
            type="tel"
            maxLength={30}
            defaultValue={employee?.phone}
            placeholder="05xx xxx xx xx"
          />
        </Field>
        <Field label="Aylık maaş (₺)" wide>
          <input
            name="salary"
            required
            type="number"
            min="0"
            max="10000000"
            step="0.01"
            defaultValue={employee?.salary ?? 0}
          />
        </Field>
        {employee && (
          <label className="checkbox-field span-2">
            <input
              name="active"
              type="checkbox"
              defaultChecked={employee.active}
            />
            <span>Aktif çalışan</span>
          </label>
        )}
        <p className="field-hint span-2">
          Maaş bilgisi personel kaydıdır. Ödenen maaşları gider ekranından
          ayrıca kaydedin.
        </p>
      </div>
      <FormFooter busy={busy} close={close} />
    </form>
  );
}

export const productEmoji = (category: string) =>
  ({
    Dürümler: "🌯",
    Porsiyonlar: "🥗",
    Menüler: "🍽️",
    İçecekler: "🥤",
    Ekstralar: "🧆",
  })[category] || "🌯";

export function OrderForm({
  state,
  mutate,
  busy,
  close,
}: {
  state: AppState;
  mutate: Mutation;
  busy: boolean;
  close: () => void;
}) {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tümü");
  const available = state.products.filter((p) => p.active);
  const categories = ["Tümü", ...new Set(available.map((p) => p.category))];
  const filtered = available.filter(
    (p) =>
      (category === "Tümü" || category === p.category) &&
      p.name
        .toLocaleLowerCase("tr-TR")
        .includes(query.toLocaleLowerCase("tr-TR")),
  );
  const items = Object.entries(cart)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => ({
      product: state.products.find((p) => p.id === id)!,
      quantity,
    }))
    .filter((i) => i.product);
  const total = items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);
  function change(product: Product, difference: number) {
    setCart((current) => {
      const quantity = Math.max(
        0,
        Math.min(
          Math.floor(product.stock),
          (current[product.id] || 0) + difference,
        ),
      );
      return { ...current, [product.id]: quantity };
    });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length) return;
    const f = new FormData(event.currentTarget);
    if (
      await mutate("/orders", {
        customer: String(f.get("customer") || "").trim() || "Misafir",
        channel: f.get("channel"),
        payment: f.get("payment"),
        items: items.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
        })),
      })
    )
      close();
  }
  return (
    <form onSubmit={submit}>
      <div className="modal-body order-form-layout">
        <section className="order-products">
          <div className="search-field">
            <Search size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ürün ara…"
              aria-label="Sipariş için ürün ara"
            />
          </div>
          <div className="filter-tabs compact">
            {categories.map((c) => (
              <button
                type="button"
                className={category === c ? "active" : ""}
                key={c}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="product-picker">
            {filtered.map((p) => (
              <button
                type="button"
                key={p.id}
                className={
                  "picker-item" + ((cart[p.id] || 0) > 0 ? " selected" : "")
                }
                onClick={() => change(p, 1)}
                disabled={
                  p.stock < 1 || (cart[p.id] || 0) >= Math.floor(p.stock)
                }
              >
                <span className="picker-emoji">{productEmoji(p.category)}</span>
                <strong>{p.name}</strong>
                <small>
                  {p.stock < 1 ? "Stok tükendi" : `${p.stock} ${p.unit} stokta`}
                </small>
                <span className="picker-bottom">
                  {money(p.price)}
                  <span>
                    <Plus size={14} />
                  </span>
                </span>
              </button>
            ))}
          </div>
          {!filtered.length && (
            <p className="section-note">
              Ürün bulunamadı. Önce menüye ürün ekleyin.
            </p>
          )}
        </section>
        <section className="order-cart">
          <h3>
            <ShoppingBag size={18} />
            Sipariş özeti{" "}
            <span className="badge gray">
              {items.reduce((sum, i) => sum + i.quantity, 0)}
            </span>
          </h3>
          <div className="cart-list">
            {!items.length ? (
              <div className="cart-empty">
                <ShoppingBag size={30} />
                <p>
                  Soldaki ürünlere dokunarak
                  <br />
                  siparişe ekle.
                </p>
              </div>
            ) : (
              items.map((i) => (
                <div className="cart-item" key={i.product.id}>
                  <div>
                    <strong>{i.product.name}</strong>
                    <small>{money(i.product.price)}</small>
                    <div className="quantity-control">
                      <button
                        type="button"
                        onClick={() => change(i.product, -1)}
                        aria-label={`${i.product.name} azalt`}
                      >
                        <Minus size={13} />
                      </button>
                      <span>{i.quantity}</span>
                      <button
                        type="button"
                        onClick={() => change(i.product, 1)}
                        disabled={i.quantity >= Math.floor(i.product.stock)}
                        aria-label={`${i.product.name} artır`}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <strong>{money(i.product.price * i.quantity)}</strong>
                    <button
                      className="icon-button"
                      type="button"
                      onClick={() =>
                        setCart((c) => ({ ...c, [i.product.id]: 0 }))
                      }
                      aria-label={`${i.product.name} kaldır`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="form-stack">
            <Field label="Müşteri / masa">
              <input name="customer" maxLength={100} placeholder="Misafir" />
            </Field>
            <div className="form-grid">
              <Field label="Kanal">
                <select name="channel">
                  <option>Şube</option>
                  <option>Paket servis</option>
                  <option>Gel-al</option>
                </select>
              </Field>
              <Field label="Ödeme">
                <select name="payment">
                  <option>Nakit</option>
                  <option>Kart</option>
                  <option>Online</option>
                </select>
              </Field>
            </div>
          </div>
          <div className="cart-summary">
            <span>Toplam tutar</span>
            <strong>{money(total)}</strong>
          </div>
          <p className="field-hint">
            Sipariş açıldığında stok ayrılır. İptal edildiğinde geri eklenir.
          </p>
        </section>
      </div>
      <div className="modal-footer">
        <button className="btn secondary" type="button" onClick={close}>
          Vazgeç
        </button>
        <button className="btn primary" disabled={!items.length || busy}>
          <Plus size={17} />
          {busy ? "Kaydediliyor…" : "Siparişi oluştur"}
        </button>
      </div>
    </form>
  );
}
