import { useCallback, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileJson,
  Info,
  Landmark,
  Pencil,
  Plus,
  Printer,
  ShieldCheck,
  Tags,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
} from "lucide-react";
import { api } from "./api";
import {
  AddButtons,
  Button,
  CardHeader,
  CsvButton,
  Empty,
  Field,
  Heading,
  Metrics,
  Modal,
  SearchField,
  StatusBadge,
} from "./components";
import type {
  Bucket,
  Category,
  Entry,
  EntryType,
  Mutation,
  Page,
  Period,
  Report,
  State,
} from "./types";
import {
  csv,
  dateLabel,
  exportEntries,
  integer,
  money,
  months,
  periodLabel,
  summarize,
} from "./types";

type OpenEntry = (type: EntryType, entry?: Entry) => void;
const within = (state: State, report: Report) =>
  state.entries.filter((e) => e.date >= report.from && e.date <= report.to);
const compactMoney = (v: number) =>
  new Intl.NumberFormat("tr-TR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(v);
function tableBuckets(report: Report, period: Period): Bucket[] {
  if (period.mode === "year")
    return months.map((_, i) => {
      const p = `${period.year}-${String(i + 1).padStart(2, "0")}`;
      return (
        report.months.find((b) => b.period === p) || {
          period: p,
          ...summarize([]),
        }
      );
    });
  return report.months;
}
function chartBuckets(report: Report, period: Period): Bucket[] {
  if (period.mode === "month") {
    const n = new Date(Date.UTC(period.year, period.month, 0)).getUTCDate();
    return Array.from({ length: n }, (_, i) => {
      const p = report.from.slice(0, 7) + "-" + String(i + 1).padStart(2, "0");
      return (
        report.days.find((b) => b.period === p) || {
          period: p,
          ...summarize([]),
        }
      );
    });
  }
  return tableBuckets(report, period).slice(-24);
}
function FlowChart({ report, period }: { report: Report; period: Period }) {
  const values = chartBuckets(report, period),
    w = 740,
    h = 215,
    left = 55,
    right = 15,
    top = 15,
    bottom = 32,
    max = Math.max(100, ...values.flatMap((v) => [v.income, v.expense])),
    ceiling = Math.ceil(max / 4 / 100) * 100 * 4,
    step = (w - left - right) / Math.max(values.length, 1),
    bar = Math.min(15, step * 0.29);
  return (
    <section className="card flow-card">
      <CardHeader
        title="Gelir & gider dengesi"
        description={
          period.mode === "month"
            ? "Günlük gerçekleşen hareketler"
            : "Aylık gerçekleşen hareketler · grafik en fazla son 24 ayı gösterir"
        }
      >
        <div className="chart-legend">
          <span>
            <i className="income-dot" />
            Gelir
          </span>
          <span>
            <i className="expense-dot" />
            Gider
          </span>
        </div>
      </CardHeader>
      <div className="chart-callout">
        <strong>{money(report.summary.balance)}</strong>
        <span>seçili dönemin net farkı</span>
      </div>
      <div className="chart-container">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label={`${periodLabel(period)} gelir gider grafiği. Gelir ${money(report.summary.income)}, gider ${money(report.summary.expense)}. Tablo ayrıntıları Raporlar bölümünde.`}
        >
          {[0, 1, 2, 3, 4].map((i) => {
            const y = top + (i * (h - top - bottom)) / 4;
            return (
              <g key={i}>
                <line
                  x1={left}
                  x2={w - right}
                  y1={y}
                  y2={y}
                  stroke="#e9edf1"
                  strokeDasharray="4 5"
                />
                <text
                  x={left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill="#8e98a6"
                  fontSize="11"
                >
                  {compactMoney(ceiling - (i * ceiling) / 4)}
                </text>
              </g>
            );
          })}
          {values.map((v, i) => {
            const base = h - bottom,
              scale = (h - top - bottom) / ceiling,
              x = left + i * step + step / 2;
            const label =
              period.mode === "month"
                ? v.period.slice(8)
                : months[Number(v.period.slice(5, 7)) - 1].slice(0, 3) +
                  (period.mode !== "year" ? " " + v.period.slice(2, 4) : "");
            return (
              <g key={v.period}>
                <rect
                  x={x - bar - 2}
                  y={base - v.income * scale}
                  width={bar}
                  height={Math.max(v.income ? 2 : 0, v.income * scale)}
                  rx="3"
                  fill="#29a77c"
                >
                  <title>
                    {v.period} gelir: {money(v.income)}
                  </title>
                </rect>
                <rect
                  x={x + 2}
                  y={base - v.expense * scale}
                  width={bar}
                  height={Math.max(v.expense ? 2 : 0, v.expense * scale)}
                  rx="3"
                  fill="#f38b49"
                >
                  <title>
                    {v.period} gider: {money(v.expense)}
                  </title>
                </rect>
                {(values.length <= 16 ||
                  i % Math.ceil(values.length / 12) === 0 ||
                  i === values.length - 1) && (
                  <text
                    x={x}
                    y={h - 9}
                    textAnchor="middle"
                    fill="#8e98a6"
                    fontSize="11"
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="chart-footer">
        <span>
          <i />
          Yalnızca tahsil edilen ve ödenen kayıtlar
        </span>
        <span>Türk lirası (₺)</span>
      </div>
    </section>
  );
}
function CategoryBreakdown({ report }: { report: Report }) {
  const [type, setType] = useState<EntryType>("expense");
  const rows = report.categories.filter((c) => c.type === type);
  const total =
    type === "income" ? report.summary.income : report.summary.expense;
  let angle = 0;
  const stops = rows.map((c) => {
    const start = angle;
    angle += total ? (c.total / total) * 100 : 0;
    return `${c.color} ${start}% ${angle}%`;
  });
  return (
    <section className="card distribution">
      <CardHeader
        title={type === "expense" ? "Giderlerin nereye gidiyor?" : "Gelirin nereden geliyor?"}
        description="Seçili dönemin kategori dağılımı"
      >
        <div className="mini-tabs">
          <button
            className={type === "expense" ? "active" : ""}
            onClick={() => setType("expense")}
          >
            Gider
          </button>
          <button
            className={type === "income" ? "active" : ""}
            onClick={() => setType("income")}
          >
            Gelir
          </button>
        </div>
      </CardHeader>
      {rows.length ? (
        <>
          <div
            className="donut"
            style={{
              background: stops.length
                ? `conic-gradient(${stops.join(",")})`
                : "#edf0f3",
            }}
            role="img"
            aria-label={`${rows.length} kategoride ${money(total)} ${type === "income" ? "gelir" : "gider"}`}
          >
            <div>
              <small>TOPLAM {type === "income" ? "GELİR" : "GİDER"}</small>
              <strong>{money(total)}</strong>
              <span>{rows.length} kategori</span>
            </div>
          </div>
          <div className="category-legend">
            {rows.slice(0, 5).map((c) => (
              <div key={c.id}>
                <i style={{ background: c.color }} />
                <span>{c.name}</span>
                <strong>{money(c.total)}</strong>
                <small>
                  %{total ? Math.round((c.total / total) * 100) : 0}
                </small>
              </div>
            ))}
            {rows.length > 5 && (
              <small className="muted">
                Diğer {rows.length - 5} kategori raporlarda listelenir.
              </small>
            )}
          </div>
        </>
      ) : (
        <Empty
          title="Henüz dağılım yok"
          description="Bu dönemde gerçekleşen kayıtlar burada görünecek."
        />
      )}
    </section>
  );
}
function EntryTable({
  entries,
  open,
  actions,
}: {
  entries: Entry[];
  open: OpenEntry;
  actions?: (entry: Entry) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>İşlem</th>
            <th>Tarih</th>
            <th>Kategori</th>
            <th>Hesap</th>
            <th>Durum</th>
            <th className="align-right">Tutar</th>
            <th>
              <span className="sr-only">İşlemler</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>
                <div className="entry-name">
                  <span
                    className={`entry-icon ${e.type === "income" ? "green" : "orange"}`}
                  >
                    {e.type === "income" ? (
                      <ArrowDownLeft size={17} />
                    ) : (
                      <ArrowUpRight size={17} />
                    )}
                  </span>
                  <span>
                    <button
                      className="text-button entry-link"
                      onClick={() => open(e.type, e)}
                    >
                      {e.description}
                    </button>
                    <small>
                      {e.counterparty ||
                        (e.type === "income" ? "Gelir kaydı" : "Gider kaydı")}
                      {e.reference ? " · " + e.reference : ""}
                    </small>
                  </span>
                </div>
              </td>
              <td className="nowrap">{dateLabel(e.date)}</td>
              <td>
                <span className="category-tag">{e.category}</span>
              </td>
              <td>{e.account}</td>
              <td>
                <StatusBadge
                  paid={e.status === "paid"}
                  income={e.type === "income"}
                />
              </td>
              <td
                className={`amount align-right ${e.type === "income" ? "positive" : "negative"}`}
              >
                {e.type === "income" ? "+" : "−"}
                {money(e.amount)}
              </td>
              <td>
                <div className="table-actions">
                  <button
                    className="icon-button"
                    onClick={() => open(e.type, e)}
                    aria-label={`${e.description} düzenle`}
                  >
                    <Pencil size={15} />
                  </button>
                  {actions && (
                    <button
                      className="icon-button danger-icon"
                      aria-label={`${e.description} sil`}
                      onClick={() => actions(e)}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Dashboard({
  state,
  report,
  period,
  open,
  navigate,
}: {
  state: State;
  report: Report;
  period: Period;
  open: OpenEntry;
  navigate: (p: Page) => void;
}) {
  const entries = within(state, report);
  const pending = entries
    .filter((e) => e.status === "pending")
    .sort((a, b) => a.date.localeCompare(b.date));
  const annual = report.years.find((y) => y.year === period.year);
  return (
    <>
      <Heading
        eyebrow="İŞLETMENİN FİNANSAL GÖRÜNÜMÜ"
        title={`Merhaba, ${state.settings.ownerName.split(" ")[0]} 👋`}
        description="Gelirin, giderin ve aradaki fark. Tüm tablo tek bir yerde."
      >
        <AddButtons open={open} />
      </Heading>
      <Metrics summary={report.summary} previous={report.previous?.summary} />
      <div className="dashboard-grid">
        <FlowChart report={report} period={period} />
        <CategoryBreakdown report={report} />
      </div>
      <div className="pending-strip">
        <span className="pending-symbol">
          <Clock3 size={22} />
        </span>
        <div>
          <strong>Bekleyen ödemelerini gözden kaçırma.</strong>
          <p>
            Bu dönemde {pending.length} kayıt, henüz gerçekleşmeyi bekliyor.
          </p>
        </div>
        <div className="pending-amounts">
          <span>
            Beklenen gelir
            <strong className="positive">
              {money(report.summary.pendingIncome)}
            </strong>
          </span>
          <span>
            Bekleyen gider
            <strong className="negative">
              {money(report.summary.pendingExpense)}
            </strong>
          </span>
        </div>
        <button
          className="icon-button"
          aria-label="Tüm hareketleri aç"
          onClick={() => navigate("entries")}
        >
          <ArrowRight size={18} />
        </button>
      </div>
      <section className="card">
        <CardHeader
          title="Son finansal hareketler"
          description={`${periodLabel(period)} · En son 6 kayıt`}
        >
          <button className="text-button" onClick={() => navigate("entries")}>
            Tüm hareketler <ArrowRight size={15} />
          </button>
        </CardHeader>
        {entries.length ? (
          <EntryTable entries={entries.slice(0, 6)} open={open} />
        ) : (
          <Empty
            title="Bu dönemin ilk kaydını ekle"
            description="Gelir ve giderlerini kaydettiğinde özetin burada oluşur."
          >
            <Button variant="primary" onClick={() => open("income")}>
              <Plus size={17} />
              İlk gelirimi ekle
            </Button>
          </Empty>
        )}
        <div className="table-footer">
          <span>
            <i className="live-dot" />
            Kayıtlar sunucuda kalıcı olarak saklanır
          </span>
          <span>{entries.length} kayıt</span>
        </div>
      </section>
      <div className="annual-banner">
        <span className="annual-symbol">
          <TrendingUp size={25} />
        </span>
        <div>
          <strong>{period.year} yılına büyük resimden bak.</strong>
          <p>
            {annual
              ? `${money(annual.income)} gelir · ${money(annual.expense)} gider`
              : "Yıllık kayıtlar geldikçe özetin oluşur."}
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate("reports")}>
          Raporları keşfet <ArrowUpRight size={16} />
        </Button>
      </div>
    </>
  );
}
export function Entries({
  state,
  report,
  page,
  open,
  mutate,
  busy,
}: {
  state: State;
  report: Report;
  page: "income" | "expense" | "entries";
  open: OpenEntry;
  mutate: Mutation;
  busy: boolean;
}) {
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [account, setAccount] = useState(""),
    [status, setStatus] = useState(""),
    [kind, setKind] = useState(""),
    [cursor, setCursor] = useState(0),
    [selected, setSelected] = useState<Entry | null>(null);
  const close = useCallback(() => setSelected(null), []);
  const type = page === "entries" ? kind : page;
  const rows = within(state, report).filter(
    (e) =>
      (!type || e.type === type) &&
      (!category || e.categoryId === category) &&
      (!account || e.account === account) &&
      (!status || e.status === status) &&
      `${e.description} ${e.counterparty} ${e.reference} ${e.notes}`
        .toLocaleLowerCase("tr-TR")
        .includes(query.toLocaleLowerCase("tr-TR")),
  );
  const summary = summarize(rows);
  const maxPage = Math.max(0, Math.ceil(rows.length / 15) - 1),
    safePage = Math.min(cursor, maxPage);
  const total =
    page === "income"
      ? summary.income
      : page === "expense"
        ? summary.expense
        : summary.balance;
  const reset = () => {
    setQuery("");
    setCategory("");
    setAccount("");
    setStatus("");
    setKind("");
    setCursor(0);
  };
  return (
    <>
      <Heading
        title={
          page === "income"
            ? "Gelirler"
            : page === "expense"
              ? "Giderler"
              : "Tüm hareketler"
        }
        description={
          page === "income"
            ? "İşletmene giren parayı, tahsilatlarını ve bekleyen gelirlerini takip et."
            : page === "expense"
              ? "Harcamalarını kaydet, kategorilere ayır ve ödemelerini takip et."
              : "Gelir ve giderlerinin tamamını ara, filtrele ve düzenle."
        }
      >
        <CsvButton
          onClick={() => exportEntries(rows, `${report.from}-${report.to}`)}
          disabled={!rows.length}
        />
        {page === "entries" ? (
          <AddButtons open={open} />
        ) : (
          <Button variant="primary" onClick={() => open(page)}>
            <Plus size={17} />
            {page === "income" ? "Gelir ekle" : "Gider ekle"}
          </Button>
        )}
      </Heading>
      <div className="ledger-summary">
        <div>
          <span>
            {page === "entries"
              ? "Filtrelenmiş net fark"
              : page === "income"
                ? "Tahsil edilen gelir"
                : "Ödenen gider"}
          </span>
          <strong>{money(total)}</strong>
        </div>
        <div>
          <span>
            {page === "income"
              ? "Beklenen tahsilat"
              : page === "expense"
                ? "Bekleyen ödeme"
                : "Beklenen gelir"}
          </span>
          <strong>
            {money(
              page === "expense"
                ? summary.pendingExpense
                : summary.pendingIncome,
            )}
          </strong>
        </div>
        <div>
          <span>{page === "entries" ? "Bekleyen gider" : "Kayıt sayısı"}</span>
          <strong>
            {page === "entries"
              ? money(summary.pendingExpense)
              : integer(rows.length)}
          </strong>
        </div>
      </div>
      <section className="card ledger-card">
        <div className="ledger-toolbar">
          <SearchField
            value={query}
            change={(v) => {
              setQuery(v);
              setCursor(0);
            }}
          />
          <div className="ledger-filters">
            {page === "entries" && (
              <select
                aria-label="İşlem türü filtresi"
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value);
                  setCategory("");
                  setCursor(0);
                }}
              >
                <option value="">Tüm türler</option>
                <option value="income">Gelir</option>
                <option value="expense">Gider</option>
              </select>
            )}
            <select
              aria-label="Kategori filtresi"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setCursor(0);
              }}
            >
              <option value="">Tüm kategoriler</option>
              {state.categories
                .filter((c) => !type || c.type === type)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
            <select
              aria-label="Hesap filtresi"
              value={account}
              onChange={(e) => {
                setAccount(e.target.value);
                setCursor(0);
              }}
            >
              <option value="">Tüm hesaplar</option>
              <option>Nakit</option>
              <option>Banka</option>
              <option>Kart</option>
            </select>
            <select
              aria-label="Durum filtresi"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setCursor(0);
              }}
            >
              <option value="">Tüm durumlar</option>
              <option value="paid">Gerçekleşti</option>
              <option value="pending">Bekliyor</option>
            </select>
            <button className="text-button" onClick={reset}>
              Temizle
            </button>
          </div>
        </div>
        {rows.length ? (
          <EntryTable
            entries={rows.slice(safePage * 15, (safePage + 1) * 15)}
            open={open}
            actions={setSelected}
          />
        ) : (
          <Empty
            title="Bu filtrelerde kayıt bulunamadı"
            description="Dönemi ve filtreleri değiştirebilir veya yeni bir kayıt ekleyebilirsin."
          >
            <Button variant="secondary" onClick={reset}>
              Filtreleri temizle
            </Button>
          </Empty>
        )}
        <div className="table-footer">
          <span>
            {rows.length} kayıt · {rows.length ? safePage * 15 + 1 : 0}–
            {Math.min((safePage + 1) * 15, rows.length)} gösteriliyor
          </span>
          <div className="pagination">
            <button
              className="icon-button"
              disabled={safePage === 0}
              onClick={() => setCursor(safePage - 1)}
              aria-label="Önceki sayfa"
            >
              <ChevronLeft size={18} />
            </button>
            <span>
              {safePage + 1} / {maxPage + 1}
            </span>
            <button
              className="icon-button"
              disabled={safePage === maxPage}
              onClick={() => setCursor(safePage + 1)}
              aria-label="Sonraki sayfa"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>
      <p className="footnote">
        <Info size={16} />
        Toplamlar seçili döneme ve yukarıdaki filtrelere göre hesaplanır.
        Bekleyen kayıtlar gerçekleşen toplamlara dahil değildir.
      </p>
      {selected && (
        <Modal
          title="Bu kaydı silmek istiyor musun?"
          description="Silinen kayıt raporlardan da kaldırılır. Bu işlem geri alınamaz."
          close={close}
        >
          <div className="modal-body">
            <div className="delete-preview">
              <strong>{selected.description}</strong>
              <span>
                {dateLabel(selected.date)} · {selected.category}
              </span>
              <b>{money(selected.amount)}</b>
            </div>
          </div>
          <div className="modal-footer">
            <Button variant="secondary" onClick={close}>
              Vazgeç
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                if (
                  await mutate("/entries/" + selected.id, undefined, "DELETE")
                )
                  close();
              }}
            >
              <Trash2 size={16} />
              Evet, kaydı sil
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function Reports({
  state,
  report,
  period,
}: {
  state: State;
  report: Report;
  period: Period;
}) {
  const monthly = tableBuckets(report, period);
  const [dailyPage, setDailyPage] = useState(0);
  const maxPage = Math.max(0, Math.ceil(report.days.length / 15) - 1),
    safePage = Math.min(dailyPage, maxPage);
  const [categoryType, setCategoryType] = useState<EntryType>("expense");
  const categoryRows = report.categories.filter((c) => c.type === categoryType);
  const selected = within(state, report);
  const daily = [...report.days].reverse();
  const exportMonths = () =>
    csv(
      [
        [
          "Ay",
          "Tahsil edilen gelir (TL)",
          "Ödenen gider (TL)",
          "Net fark (TL)",
          "Gerçekleşen kayıt",
        ],
        ...monthly.map((r) => [
          r.period,
          r.income.toFixed(2).replace(".", ","),
          r.expense.toFixed(2).replace(".", ","),
          r.balance.toFixed(2).replace(".", ","),
          r.paidCount,
        ]),
      ],
      `komagene-aylik-${report.from}-${report.to}.csv`,
    );
  return (
    <>
      <Heading
        eyebrow="AYLIK, YILLIK VE DETAYLI"
        title="Finansal raporlar"
        description="Bir ayı yakından incele veya yılları karşılaştır. Kayıtlarının tamamı ulaşılabilir."
      >
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer size={17} />
          Yazdır / PDF
        </Button>
        <CsvButton
          label="Hareketleri indir"
          disabled={!selected.length}
          onClick={() => exportEntries(selected, `${report.from}-${report.to}`)}
        />
      </Heading>
      <Metrics summary={report.summary} previous={report.previous?.summary} />
      <div className="report-scope">
        <Info size={17} />
        <span>
          Seçili dönem: <strong>{periodLabel(period)}</strong>. Gerçekleşen
          hareketler esas alınır.
          {report.previous &&
            ` Karşılaştırma dönemi: ${dateLabel(report.previous.from)} – ${dateLabel(report.previous.to)}.`}
        </span>
      </div>
      <FlowChart report={report} period={period} />
      <section className="card section-gap">
        <CardHeader
          title="Aylık gelir-gider özeti"
          description="Ay bazında gelir, gider ve aradaki fark"
        >
          <CsvButton
            label="Aylık CSV"
            disabled={!monthly.length}
            onClick={exportMonths}
          />
        </CardHeader>
        {monthly.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Ay</th>
                  <th className="align-right">Gelir</th>
                  <th className="align-right">Gider</th>
                  <th className="align-right">Net fark</th>
                  <th className="align-right">Gerçekleşen kayıt</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((r) => (
                  <tr key={r.period}>
                    <td>
                      <strong>
                        {months[Number(r.period.slice(5, 7)) - 1]}{" "}
                        {r.period.slice(0, 4)}
                      </strong>
                    </td>
                    <td className="align-right positive">{money(r.income)}</td>
                    <td className="align-right negative">{money(r.expense)}</td>
                    <td
                      className={`align-right amount ${r.balance < 0 ? "negative" : "positive"}`}
                    >
                      {money(r.balance)}
                    </td>
                    <td className="align-right">{r.paidCount}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Seçili dönem toplamı</td>
                  <td className="align-right">
                    {money(report.summary.income)}
                  </td>
                  <td className="align-right">
                    {money(report.summary.expense)}
                  </td>
                  <td className="align-right">
                    {money(report.summary.balance)}
                  </td>
                  <td className="align-right">{report.summary.paidCount}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <Empty
            title="Bu dönem için rapor kaydı yok"
            description="Gelir veya gider kaydı ekleyerek raporlarını oluşturabilirsin."
          />
        )}
      </section>
      <section className="card section-gap">
        <CardHeader
          title="Yıllara göre karşılaştırma"
          description="Tüm zamanlar · yukarıdaki dönem filtresinden bağımsızdır"
        >
          <CsvButton
            label="Yıllık CSV"
            disabled={!report.years.length}
            onClick={() =>
              csv(
                [
                  [
                    "Yıl",
                    "Gelir (TL)",
                    "Gider (TL)",
                    "Net fark (TL)",
                    "Beklenen gelir (TL)",
                    "Bekleyen gider (TL)",
                  ],
                  ...report.years.map((y) => [
                    y.year,
                    ...[
                      y.income,
                      y.expense,
                      y.balance,
                      y.pendingIncome,
                      y.pendingExpense,
                    ].map((v) => v.toFixed(2).replace(".", ",")),
                  ]),
                ],
                "komagene-yillik-rapor.csv",
              )
            }
          />
        </CardHeader>
        {report.years.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Yıl</th>
                  <th className="align-right">Gelir</th>
                  <th className="align-right">Gider</th>
                  <th className="align-right">Net fark</th>
                  <th className="align-right">Beklenen gelir</th>
                  <th className="align-right">Bekleyen gider</th>
                </tr>
              </thead>
              <tbody>
                {report.years.map((y) => (
                  <tr key={y.year}>
                    <td>
                      <span className="year-badge">{y.year}</span>
                    </td>
                    <td className="align-right positive">{money(y.income)}</td>
                    <td className="align-right negative">{money(y.expense)}</td>
                    <td className="align-right amount">{money(y.balance)}</td>
                    <td className="align-right">{money(y.pendingIncome)}</td>
                    <td className="align-right">{money(y.pendingExpense)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Yıllık veriler burada birikecek"
            description="Geçmiş tarihlere de kayıt girebilirsin; yıllık raporlar otomatik oluşur."
          />
        )}
      </section>
      <div className="dashboard-grid section-gap">
        <section className="card">
          <CardHeader
            title="Kategori bazında detay"
            description="Seçili dönemde gerçekleşen kayıtlar"
          >
            <div className="mini-tabs">
              <button
                className={categoryType === "expense" ? "active" : ""}
                onClick={() => setCategoryType("expense")}
              >
                Gider
              </button>
              <button
                className={categoryType === "income" ? "active" : ""}
                onClick={() => setCategoryType("income")}
              >
                Gelir
              </button>
            </div>
          </CardHeader>
          {categoryRows.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Kategori</th>
                    <th className="align-right">Kayıt</th>
                    <th className="align-right">Tutar</th>
                    <th className="align-right">Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryRows.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="category-inline">
                          <i style={{ background: c.color }} />
                          {c.name}
                        </span>
                      </td>
                      <td className="align-right">{c.count}</td>
                      <td className="align-right amount">{money(c.total)}</td>
                      <td className="align-right">
                        %
                        {Math.round(
                          (c.total /
                            (categoryType === "income"
                              ? report.summary.income
                              : report.summary.expense)) *
                            100,
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Kategori verisi yok"
              description="Bu dönemde gerçekleşen kayıt bulunamadı."
            />
          )}
        </section>
        <section className="card">
          <CardHeader
            title="Hesap bazında hareket"
            description="Seçili dönem · gerçek hesap bakiyesi değildir"
          />
          <div className="account-list">
            {report.accounts.map((a) => (
              <div className="account-row" key={a.name}>
                <span className="account-icon">
                  {a.name === "Nakit" ? (
                    <Wallet size={21} />
                  ) : (
                    <Landmark size={21} />
                  )}
                </span>
                <div>
                  <strong>{a.name}</strong>
                  <small>
                    <span className="positive">+{money(a.income)}</span>
                    <span className="negative">−{money(a.expense)}</span>
                  </small>
                </div>
                <b>{money(a.balance)}</b>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="card section-gap daily-report">
        <CardHeader
          title="Günlük kayıt özeti"
          description="Seçili dönemde gerçekleşen hareket bulunan günler"
        >
          <CsvButton
            label="Günlük CSV"
            disabled={!daily.length}
            onClick={() =>
              csv(
                [
                  ["Tarih", "Gelir (TL)", "Gider (TL)", "Net fark (TL)"],
                  ...daily.map((d) => [
                    d.period,
                    ...[d.income, d.expense, d.balance].map((v) =>
                      v.toFixed(2).replace(".", ","),
                    ),
                  ]),
                ],
                `komagene-gunluk-${report.from}.csv`,
              )
            }
          />
        </CardHeader>
        {daily.length ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th className="align-right">Gelir</th>
                    <th className="align-right">Gider</th>
                    <th className="align-right">Net fark</th>
                    <th className="align-right">Kayıt</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.slice(safePage * 15, (safePage + 1) * 15).map((d) => (
                    <tr key={d.period}>
                      <td>{dateLabel(d.period)}</td>
                      <td className="align-right positive">
                        {money(d.income)}
                      </td>
                      <td className="align-right negative">
                        {money(d.expense)}
                      </td>
                      <td className="align-right amount">{money(d.balance)}</td>
                      <td className="align-right">{d.paidCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>
                {daily.length} gün · Sayfa {safePage + 1}
              </span>
              <div className="pagination">
                <button
                  className="icon-button"
                  disabled={safePage === 0}
                  aria-label="Önceki günlük kayıtlar"
                  onClick={() => setDailyPage(safePage - 1)}
                >
                  <ChevronLeft size={17} />
                </button>
                <button
                  className="icon-button"
                  disabled={safePage === maxPage}
                  aria-label="Sonraki günlük kayıtlar"
                  onClick={() => setDailyPage(safePage + 1)}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <Empty
            title="Günlük hareket bulunamadı"
            description="Tarih aralığını değiştirebilir veya yeni kayıt ekleyebilirsin."
          />
        )}
      </section>
      <p className="footnote">
        <Info size={16} />
        Net fark, kaydettiğin gelirler ile giderler arasındaki farktır. Açılış
        bakiyesi, vergi hesabı ve resmi muhasebe işlemleri içermez.
      </p>
    </>
  );
}
export function Categories({
  state,
  mutate,
  busy,
  edit,
}: {
  state: State;
  mutate: Mutation;
  busy: boolean;
  edit: (type: EntryType, category?: Category) => void;
}) {
  const [selected, setSelected] = useState<Category | null>(null);
  const close = useCallback(() => setSelected(null), []);
  return (
    <>
      <Heading
        title="Kategoriler"
        description="Gelir ve giderlerini işletmene uygun başlıklarla düzenle."
      >
        <Button variant="primary" onClick={() => edit("expense")}>
          <Plus size={17} />
          Kategori ekle
        </Button>
      </Heading>
      <div className="categories-layout">
        {(["income", "expense"] as const).map((type) => (
          <section className="card" key={type}>
            <CardHeader
              title={
                type === "income" ? "Gelir kategorileri" : "Gider kategorileri"
              }
              description="Kayıt ve toplamlar tüm zamanları kapsar."
            >
              <button
                className="icon-button"
                aria-label={`${type === "income" ? "Gelir" : "Gider"} kategorisi ekle`}
                onClick={() => edit(type)}
              >
                <Plus size={18} />
              </button>
            </CardHeader>
            <div className="category-list">
              {state.categories
                .filter((c) => c.type === type)
                .map((c) => {
                  const entries = state.entries.filter(
                    (e) => e.categoryId === c.id,
                  );
                  const summary = summarize(entries);
                  return (
                    <div className="category-row" key={c.id}>
                      <span
                        className="category-symbol"
                        style={{ background: c.color + "16", color: c.color }}
                      >
                        <Tags size={18} />
                      </span>
                      <div>
                        <strong>{c.name}</strong>
                        <small>
                          {entries.length} kayıt ·{" "}
                          {money(
                            type === "income"
                              ? summary.income
                              : summary.expense,
                          )}{" "}
                          gerçekleşen
                        </small>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={`${c.name} kategorisini düzenle`}
                        onClick={() => edit(type, c)}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-button danger-icon"
                        aria-label={`${c.name} kategorisini sil`}
                        disabled={busy || entries.length > 0}
                        title={
                          entries.length
                            ? "Kayıt içeren kategori silinemez"
                            : "Kategoriyi sil"
                        }
                        onClick={() => setSelected(c)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
      <p className="footnote">
        <Info size={16} />
        Kayıt içeren bir kategori silinemez. Adını veya rengini
        değiştirebilirsin; geçmiş kayıtlar ve raporlar güncellenir.
      </p>
      {selected && (
        <Modal title="Kategoriyi sil" close={close}>
          <div className="modal-body">
            <p>
              <strong>{selected.name}</strong> kategorisi silinecek. Devam etmek
              istiyor musun?
            </p>
          </div>
          <div className="modal-footer">
            <Button variant="secondary" onClick={close}>
              Vazgeç
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                if (
                  await mutate(
                    "/categories/" + selected.id,
                    undefined,
                    "DELETE",
                  )
                )
                  close();
              }}
            >
              Kategoriyi sil
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
export function SettingsPage({
  state,
  mutate,
  busy,
}: {
  state: State;
  mutate: Mutation;
  busy: boolean;
}) {
  const [error, setError] = useState(""),
    [fileBusy, setFileBusy] = useState(false),
    [preview, setPreview] = useState<{
      added: number;
      skipped: number;
      categoriesAdded: number;
      filename: string;
    } | null>(null);
  const file = useRef<unknown>(null);
  const input = useRef<HTMLInputElement>(null);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await mutate(
      "/settings",
      { branchName: f.get("branchName"), ownerName: f.get("ownerName") },
      "PATCH",
    );
  }
  async function password(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (f.get("newPassword") !== f.get("confirmPassword")) {
      setError("Yeni şifreler birbiriyle eşleşmiyor.");
      return;
    }
    setError("");
    if (
      await mutate("/password", {
        currentPassword: f.get("currentPassword"),
        newPassword: f.get("newPassword"),
      })
    )
      form.reset();
  }
  async function pick(selected: File | undefined) {
    setError("");
    setPreview(null);
    file.current = null;
    if (!selected) return;
    if (selected.size > 8 * 1024 * 1024) {
      setError("Yedek dosyası en fazla 8 MB olabilir.");
      return;
    }
    setFileBusy(true);
    try {
      const data: unknown = JSON.parse(await selected.text());
      const result = await api<{
        added: number;
        skipped: number;
        categoriesAdded: number;
      }>("/import/preview", "POST", data);
      file.current = data;
      setPreview({ ...result, filename: selected.name });
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? "Dosya geçerli bir JSON yedeği değil."
          : e instanceof Error
            ? e.message
            : "Yedek okunamadı.",
      );
    } finally {
      setFileBusy(false);
      if (input.current) input.current.value = "";
    }
  }
  return (
    <>
      <Heading
        title="Ayarlar & yedekleme"
        description="İşletme bilgilerini, hesap güvenliğini ve verilerini yönet."
      />
      <div className="settings-layout">
        <section className="card">
          <CardHeader
            title="İşletme bilgileri"
            description="Panelde görünen adları güncelle."
          />
          <form onSubmit={save}>
            <div className="card-body form-stack">
              <Field label="İşletme / şube adı">
                <input
                  name="branchName"
                  key={state.settings.branchName}
                  required
                  maxLength={100}
                  defaultValue={state.settings.branchName}
                />
              </Field>
              <Field label="Yönetici adı">
                <input
                  name="ownerName"
                  key={state.settings.ownerName}
                  required
                  maxLength={100}
                  defaultValue={state.settings.ownerName}
                />
              </Field>
              <div className="setting-facts">
                <span>
                  Para birimi<strong>Türk lirası · TRY</strong>
                </span>
                <span>
                  Saat dilimi<strong>Türkiye · İstanbul</strong>
                </span>
              </div>
              <Button type="submit" variant="primary" disabled={busy}>
                <Check size={16} />
                Bilgileri kaydet
              </Button>
            </div>
          </form>
        </section>
        <section className="card">
          <CardHeader
            title="Verilerin güvende kalsın"
            description="Tüm finans kayıtlarını yedekle ve geri yükle."
          />
          <div className="card-body">
            <div className="backup-icon">
              <FileJson size={28} />
            </div>
            <p className="body-copy">
              Gelir, gider ve kategorilerinin tamamını tek JSON dosyasında
              indir. Şifren yedeğe dahil edilmez. Dosyayı güvenli bir yerde
              sakla.
            </p>
            <a className="button primary" href="/api/export" download>
              <ArrowDownToLine size={17} />
              Tüm verileri yedekle
            </a>
            <div className="import-box">
              <strong>Yedekten kayıtları geri yükle</strong>
              <p>
                Mevcut kayıtlar silinmez. Aynı kayıtlar tekrar eklenmez; çakışma
                varsa işlem durdurulur.
              </p>
              <input
                ref={input}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                aria-label="JSON yedek dosyası seç"
                onChange={(e) => pick(e.target.files?.[0])}
              />
              <Button
                variant="secondary"
                disabled={fileBusy || busy}
                onClick={() => input.current?.click()}
              >
                <Upload size={16} />
                {fileBusy ? "Kontrol ediliyor…" : "Yedek dosyası seç"}
              </Button>
              {preview && (
                <div className="import-preview">
                  <strong>{preview.filename}</strong>
                  <p>
                    {preview.added} yeni kayıt · {preview.categoriesAdded} yeni
                    kategori · {preview.skipped} zaten mevcut kayıt
                  </p>
                  <Button
                    variant="primary"
                    disabled={busy}
                    onClick={async () => {
                      if (await mutate("/import", file.current)) {
                        setPreview(null);
                        file.current = null;
                      }
                    }}
                  >
                    Onayla ve geri yükle
                  </Button>
                  <button
                    className="text-button"
                    onClick={() => {
                      setPreview(null);
                      file.current = null;
                    }}
                  >
                    Vazgeç
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
        <section className="card">
          <CardHeader
            title="Şifreni değiştir"
            description="En az 10 karakterlik güçlü bir şifre seç."
          />
          <form onSubmit={password}>
            <div className="card-body form-stack">
              <Field label="Mevcut şifre">
                <input
                  name="currentPassword"
                  type="password"
                  required
                  maxLength={200}
                  autoComplete="current-password"
                />
              </Field>
              <Field label="Yeni şifre">
                <input
                  name="newPassword"
                  type="password"
                  required
                  minLength={10}
                  maxLength={200}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Yeni şifre tekrar">
                <input
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={10}
                  maxLength={200}
                  autoComplete="new-password"
                />
              </Field>
              <Button variant="secondary" type="submit" disabled={busy}>
                <ShieldCheck size={16} />
                Şifreyi güncelle
              </Button>
              <p className="hint">
                Şifren değiştiğinde diğer cihazlardaki açık oturumlar
                sonlandırılır.
              </p>
            </div>
          </form>
        </section>
        <section className="card">
          <CardHeader title="Panel hakkında" />
          <div className="card-body">
            <div className="about-grid">
              <span>
                Sürüm<strong>2.0 · Gelir & Gider</strong>
              </span>
              <span>
                Erişim<strong>Tek yönetici</strong>
              </span>
              <span>
                Kayıtlar<strong>Sunucuda kalıcı saklanır</strong>
              </span>
              <span>
                Raporlar<strong>Günlük · Aylık · Yıllık</strong>
              </span>
            </div>
            <p className="body-copy">
              Bu panel gelir ve giderlerini manuel takip etmek içindir. Banka,
              POS, e-fatura veya Komagene merkez bağlantısı yoktur. Eski işletme
              panelindeki kayıtlar otomatik taşınmaz; eski veri dosyaları
              korunur.
            </p>
            {state.settings.demoData && (
              <p className="demo-note">
                Bu hesap örnek veriler içerir. Gerçek kullanım için ayrı ve boş
                bir hesap kurulumu kullanın.
              </p>
            )}
          </div>
        </section>
      </div>
      {error && (
        <div className="error-message section-gap" role="alert">
          {error}
        </div>
      )}
    </>
  );
}
