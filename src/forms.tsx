import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { Field, FormFooter } from "./components";
import type { Category, Entry, EntryType, Mutation, State } from "./types";
import { dateLabel, today } from "./types";

export function EntryForm({
  state,
  entry,
  type,
  mutate,
  busy,
  close,
}: {
  state: State;
  entry?: Entry;
  type: EntryType;
  mutate: Mutation;
  busy: boolean;
  close: () => void;
}) {
  const [kind, setKind] = useState(entry?.type || type);
  const categories = state.categories.filter((c) => c.type === kind);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const data = {
      type: kind,
      categoryId: f.get("categoryId"),
      amount: Number(f.get("amount")),
      date: f.get("date"),
      account: f.get("account"),
      status: f.get("status"),
      description: f.get("description"),
      counterparty: f.get("counterparty"),
      reference: f.get("reference"),
      notes: f.get("notes"),
    };
    if (
      await mutate(
        "/entries" + (entry ? "/" + entry.id : ""),
        data,
        entry ? "PATCH" : "POST",
      )
    )
      close();
  }
  return (
    <form onSubmit={submit}>
      <div className="modal-body">
        <div className="type-toggle">
          <button
            type="button"
            className={kind === "income" ? "selected income" : ""}
            onClick={() => setKind("income")}
          >
            <ArrowDownLeft size={18} />
            Gelir kaydı
          </button>
          <button
            type="button"
            className={kind === "expense" ? "selected expense" : ""}
            onClick={() => setKind("expense")}
          >
            <ArrowUpRight size={18} />
            Gider kaydı
          </button>
        </div>
        <div className="form-grid">
          <Field label="Tutar (₺)">
            <input
              name="amount"
              type="number"
              min="0.01"
              max="100000000"
              step="0.01"
              required
              defaultValue={entry?.amount}
              placeholder="0,00"
              autoFocus
            />
          </Field>
          <Field label="İşlem / vade tarihi">
            <input
              name="date"
              type="date"
              min="2000-01-01"
              max="2100-12-31"
              required
              defaultValue={entry?.date || today()}
            />
          </Field>
          <Field label="Açıklama" wide>
            <input
              name="description"
              required
              maxLength={200}
              defaultValue={entry?.description}
              placeholder={
                kind === "income"
                  ? "Örn. Günlük şube satış geliri"
                  : "Örn. Ekim ayı elektrik faturası"
              }
            />
          </Field>
          <Field label="Kategori">
            <select
              key={kind}
              name="categoryId"
              required
              defaultValue={
                entry?.type === kind ? entry.categoryId : categories[0]?.id
              }
            >
              {!categories.length && (
                <option value="">Önce kategori ekleyin</option>
              )}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Hesap / ödeme yöntemi">
            <select name="account" defaultValue={entry?.account || "Nakit"}>
              <option>Nakit</option>
              <option>Banka</option>
              <option>Kart</option>
            </select>
          </Field>
          <Field label="Durum">
            <select
              key={"status-" + kind}
              name="status"
              defaultValue={entry?.status || "paid"}
            >
              <option value="paid">
                {kind === "income" ? "Tahsil edildi" : "Ödendi"}
              </option>
              <option value="pending">
                {kind === "income" ? "Tahsilat bekleniyor" : "Ödeme bekliyor"}
              </option>
            </select>
          </Field>
          <Field label="Kişi / firma (isteğe bağlı)">
            <input
              name="counterparty"
              maxLength={100}
              defaultValue={entry?.counterparty}
              placeholder="Müşteri veya tedarikçi"
            />
          </Field>
          <Field label="Belge / fiş numarası (isteğe bağlı)" wide>
            <input
              name="reference"
              maxLength={100}
              defaultValue={entry?.reference}
              placeholder="Örn. FTR-2026-001"
            />
          </Field>
          <Field label="Not (isteğe bağlı)" wide>
            <textarea
              name="notes"
              maxLength={2000}
              rows={3}
              defaultValue={entry?.notes}
              placeholder="Kayda ilişkin ek açıklamalar…"
            />
          </Field>
        </div>
        <p className="hint">
          Bekleyen kayıtlar gelir/gider toplamına dahil edilmez. Tahsilat veya
          ödeme olduğunda durumu güncelleyin.
        </p>
        {entry && (
          <p className="hint">
            Oluşturulma: {dateLabel(entry.createdAt)} · Son güncelleme:{" "}
            {dateLabel(entry.updatedAt)}
          </p>
        )}
      </div>
      <FormFooter
        busy={busy}
        close={close}
        label={entry ? "Değişiklikleri kaydet" : "Kaydı oluştur"}
      />
    </form>
  );
}
export const categoryColors = [
  "#20a477",
  "#4b87db",
  "#8e72d4",
  "#f08035",
  "#e4ad43",
  "#d78698",
  "#44a2aa",
  "#6174d1",
  "#ac9278",
];
export function CategoryForm({
  category,
  type,
  mutate,
  busy,
  close,
}: {
  category?: Category;
  type: EntryType;
  mutate: Mutation;
  busy: boolean;
  close: () => void;
}) {
  const [color, setColor] = useState(
    category?.color || categoryColors[type === "income" ? 0 : 3],
  );
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      await mutate(
        "/categories" + (category ? "/" + category.id : ""),
        {
          name: f.get("name"),
          color,
          ...(!category ? { type: f.get("type") } : {}),
        },
        category ? "PATCH" : "POST",
      )
    )
      close();
  }
  return (
    <form onSubmit={submit}>
      <div className="modal-body form-stack">
        {!category && (
          <Field label="Kategori türü">
            <select name="type" defaultValue={type}>
              <option value="income">Gelir kategorisi</option>
              <option value="expense">Gider kategorisi</option>
            </select>
          </Field>
        )}
        <Field label="Kategori adı">
          <input
            name="name"
            required
            maxLength={60}
            defaultValue={category?.name}
            placeholder="Örn. Kira / Şube satışı"
          />
        </Field>
        <fieldset className="color-field">
          <legend>Kategori rengi</legend>
          <div className="color-options">
            {categoryColors.map((c) => (
              <button
                key={c}
                type="button"
                style={{ background: c }}
                className={color === c ? "selected" : ""}
                onClick={() => setColor(c)}
                aria-label={`Renk ${c}`}
                aria-pressed={color === c}
              />
            ))}
          </div>
        </fieldset>
      </div>
      <FormFooter busy={busy} close={close} />
    </form>
  );
}
