export type EntryType = "income" | "expense";
export type EntryStatus = "paid" | "pending";
export type Page =
  | "dashboard"
  | "income"
  | "expense"
  | "entries"
  | "reports"
  | "categories"
  | "settings";
export type Category = {
  id: string;
  type: EntryType;
  name: string;
  color: string;
};
export type Entry = {
  id: string;
  type: EntryType;
  categoryId: string;
  category: string;
  amount: number;
  date: string;
  account: string;
  status: EntryStatus;
  description: string;
  counterparty: string;
  reference: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};
export type State = {
  settings: { branchName: string; ownerName: string; demoData: boolean };
  categories: Category[];
  entries: Entry[];
  generatedAt: string;
};
export type Summary = {
  income: number;
  expense: number;
  balance: number;
  pendingIncome: number;
  pendingExpense: number;
  count: number;
  paidCount: number;
};
export type Bucket = Summary & { period: string };
export type Report = {
  from: string;
  to: string;
  summary: Summary;
  months: Bucket[];
  days: Bucket[];
  categories: (Category & { total: number; count: number })[];
  accounts: (Summary & { name: string })[];
  previous: { from: string; to: string; summary: Summary } | null;
  years: (Summary & { year: number })[];
};
export type Period = {
  mode: "month" | "year" | "custom" | "all";
  year: number;
  month: number;
  from: string;
  to: string;
};
export type Mutation = (
  path: string,
  body?: unknown,
  method?: string,
) => Promise<boolean>;
export const money = (n: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(n);
export const integer = (n: number) =>
  new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(n);
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const dateLabel = (date: string, year = true) =>
  new Date(date.slice(0, 10) + "T12:00:00+03:00").toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    ...(year ? ({ year: "numeric" } as const) : {}),
    timeZone: "Europe/Istanbul",
  });
export const months = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];
export const initialPeriod = (): Period => {
  const d = today();
  return {
    mode: "month",
    year: Number(d.slice(0, 4)),
    month: Number(d.slice(5, 7)),
    from: d.slice(0, 7) + "-01",
    to: d,
  };
};
export function range(p: Period) {
  if (p.mode === "all") return { from: "2000-01-01", to: "2100-12-31" };
  if (p.mode === "custom") return { from: p.from, to: p.to };
  if (p.mode === "year")
    return { from: `${p.year}-01-01`, to: `${p.year}-12-31` };
  const start = `${p.year}-${String(p.month).padStart(2, "0")}`;
  return {
    from: start + "-01",
    to: start + "-" + new Date(Date.UTC(p.year, p.month, 0)).getUTCDate(),
  };
}
export function periodLabel(p: Period) {
  if (p.mode === "all") return "Tüm zamanlar";
  if (p.mode === "year") return `${p.year} yılı`;
  if (p.mode === "month") return `${months[p.month - 1]} ${p.year}`;
  const r = range(p);
  return `${dateLabel(r.from)} – ${dateLabel(r.to)}`;
}
export function summarize(entries: Entry[]): Summary {
  let income = 0,
    expense = 0,
    pendingIncome = 0,
    pendingExpense = 0,
    paidCount = 0;
  for (const e of entries) {
    const cents = Math.round(e.amount * 100);
    if (e.status === "pending") {
      if (e.type === "income") pendingIncome += cents;
      else pendingExpense += cents;
    } else {
      paidCount++;
      if (e.type === "income") income += cents;
      else expense += cents;
    }
  }
  return {
    income: income / 100,
    expense: expense / 100,
    balance: (income - expense) / 100,
    pendingIncome: pendingIncome / 100,
    pendingExpense: pendingExpense / 100,
    count: entries.length,
    paidCount,
  };
}
export function csv(rows: (string | number)[][], filename: string) {
  const text =
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((value) => {
            const s = String(value);
            return (
              '"' +
              (/^[\s]*[=+\-@]|^[\t\r\n]/.test(s) ? "'" : "") +
              s.replaceAll('"', '""') +
              '"'
            );
          })
          .join(";"),
      )
      .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportEntries(entries: Entry[], label: string) {
  csv(
    [
      [
        "Tarih",
        "Tür",
        "Kategori",
        "Açıklama",
        "Tutar (TL)",
        "Hesap",
        "Durum",
        "Kişi / firma",
        "Belge no",
        "Not",
      ],
      ...entries.map((e) => [
        e.date,
        e.type === "income" ? "Gelir" : "Gider",
        e.category,
        e.description,
        e.amount.toFixed(2).replace(".", ","),
        e.account,
        e.status === "paid"
          ? e.type === "income"
            ? "Tahsil edildi"
            : "Ödendi"
          : "Bekliyor",
        e.counterparty,
        e.reference,
        e.notes,
      ]),
    ],
    `komagene-hareketler-${label}.csv`,
  );
}
