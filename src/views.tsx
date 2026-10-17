import { useCallback, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bike,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  CreditCard,
  Download,
  Eye,
  FileText,
  Flame,
  Package,
  Pencil,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { AddButton, Empty, ExportButton, Modal, PageHeading } from "./App";
import type { Mutation } from "./App";
import type { AppState, Order, Page, Product, Status, Employee } from "./types";
import { count, dateLabel, localDate, money, sum, timeLabel } from "./types";
import { productEmoji } from "./forms";

const statusColors: Record<Status, string> = {
  Hazırlanıyor: "orange",
  Hazır: "blue",
  Tamamlandı: "green",
  İptal: "red",
};
function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={"badge " + statusColors[status]}>
      <span className="status-dot" />
      {status}
    </span>
  );
}
function CardHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="card-header">
      <div>
        <h2 className="card-title">{title}</h2>
        {description && <p className="card-subtitle">{description}</p>}
      </div>
      {children}
    </div>
  );
}
function Metric({
  label,
  value,
  foot,
  icon,
  color = "orange",
}: {
  label: string;
  value: string;
  foot: string;
  icon: ReactNode;
  color?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        <span className={"stat-icon " + color}>{icon}</span>
      </div>
      <strong className="stat-value">{value}</strong>
      <span className="stat-foot">{foot}</span>
    </div>
  );
}
const completed = (orders: Order[]) =>
  orders.filter((o) => o.status === "Tamamlandı");
function pastDates(days: number) {
  const today = localDate();
  const midday = new Date(today + "T12:00:00+03:00");
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(midday);
    date.setDate(date.getDate() - (days - 1 - i));
    return localDate(date);
  });
}

function SalesChart({ state }: { state: AppState }) {
  const [days, setDays] = useState(7);
  const dates = pastDates(days);
  const orders = completed(state.orders);
  const values = dates.map((d) =>
    sum(
      orders.filter((o) => localDate(o.createdAt) === d),
      (o) => o.total,
    ),
  );
  const max = Math.max(...values, 100);
  const top = Math.ceil(max / 4 / 100) * 100 * 4;
  const width = 650,
    height = 190;
  const points = values
    .map(
      (value, i) =>
        `${48 + (i / Math.max(dates.length - 1, 1)) * (width - 65)},${height - 22 - (value / top) * (height - 36)}`,
    )
    .join(" ");
  const area = `48,${height - 22} ${points} ${width - 17},${height - 22}`;
  return (
    <section className="card sales-card">
      <CardHeader
        title="Satış performansı"
        description="Tamamlanan siparişlerden elde edilen ciro"
      >
        <div className="period-tabs">
          {[7, 14].map((n) => (
            <button
              key={n}
              className={days === n ? "active" : ""}
              onClick={() => setDays(n)}
            >
              Son {n} gün
            </button>
          ))}
        </div>
      </CardHeader>
      <div className="chart-summary">
        <strong>{money(sum(values, (v) => v))}</strong>
        <span className="chart-legend">
          <i className="legend-dot" />
          Toplam satış
        </span>
      </div>
      <div className="chart-wrap">
        <svg
          viewBox={`0 0 ${width} ${height + 22}`}
          role="img"
          aria-label={`Son ${days} gün satış grafiği. Toplam ${money(sum(values, (v) => v))}. Günlük ayrıntılar raporlarda.`}
        >
          <defs>
            <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f58435" stopOpacity=".2" />
              <stop offset="100%" stopColor="#f58435" stopOpacity=".01" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3, 4].map((i) => (
            <g key={i}>
              <line
                x1="48"
                x2={width - 15}
                y1={14 + i * ((height - 36) / 4)}
                y2={14 + i * ((height - 36) / 4)}
                stroke="#edf0f2"
                strokeDasharray="4 5"
              />
              <text
                x="36"
                y={18 + i * ((height - 36) / 4)}
                textAnchor="end"
                fontSize="10"
                fill="#8b93a2"
              >
                {count(top - (i * top) / 4)}
              </text>
            </g>
          ))}
          <polygon points={area} fill="url(#sales-fill)" />
          <polyline
            points={points}
            fill="none"
            stroke="#f07826"
            strokeWidth="2.8"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {values.map((value, i) => (
            <circle
              key={dates[i]}
              cx={48 + (i / Math.max(dates.length - 1, 1)) * (width - 65)}
              cy={height - 22 - (value / top) * (height - 36)}
              r="3.5"
              fill="white"
              stroke="#f07826"
              strokeWidth="2"
            >
              <title>
                {dateLabel(dates[i])}: {money(value)}
              </title>
            </circle>
          ))}
          {dates.map(
            (date, i) =>
              (days === 7 || i % 2 === 0 || i === days - 1) && (
                <text
                  key={date}
                  x={48 + (i / (dates.length - 1)) * (width - 65)}
                  y={height + 5}
                  fontSize="10"
                  fill="#8b93a2"
                  textAnchor="middle"
                >
                  {dateLabel(date)}
                </text>
              ),
          )}
        </svg>
      </div>
      <div className="chart-bottom">
        <span>
          <span className="live-dot" /> Kayıtlarından güncellenir
        </span>
        <span>Türk lirası (₺)</span>
      </div>
    </section>
  );
}

function Channels({ orders }: { orders: Order[] }) {
  const channels = [
    { name: "Şube", icon: Store, color: "orange" },
    { name: "Paket servis", icon: Bike, color: "green" },
    { name: "Gel-al", icon: ShoppingBag, color: "blue" },
  ];
  const total = sum(orders, (o) => o.total);
  return (
    <section className="card">
      <CardHeader
        title="Satış kanalları"
        description="Bugünkü tamamlanan siparişler"
      />
      <div className="channel-total">
        <span>Toplam ciro</span>
        <strong>{money(total)}</strong>
      </div>
      <div className="channel-list">
        {channels.map((channel) => {
          const selected = orders.filter((o) => o.channel === channel.name);
          const value = sum(selected, (o) => o.total);
          const percent = total ? (value / total) * 100 : 0;
          return (
            <div className="channel-item" key={channel.name}>
              <span className={"channel-icon " + channel.color}>
                <channel.icon size={19} />
              </span>
              <div className="channel-meta">
                <div>
                  <strong>{channel.name}</strong>
                  <span>{money(value)}</span>
                </div>
                <div className="channel-sub">
                  <span>{selected.length} sipariş</span>
                  <span>%{Math.round(percent)}</span>
                </div>
                <div className="progress-track">
                  <div
                    className={"progress-fill " + channel.color}
                    style={{ width: percent + "%" }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="section-note channel-note">
        <Activity size={16} /> Her satış, işletmene bir adım daha.
      </div>
    </section>
  );
}

function OrderTable({
  orders,
  onDetail,
}: {
  orders: Order[];
  onDetail?: (order: Order) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Sipariş</th>
            <th>Müşteri / kanal</th>
            <th>Tutar</th>
            <th>Durum</th>
            <th>Saat</th>
            {onDetail && (
              <th>
                <span className="visually-hidden">İşlem</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <span className="order-number">#{o.number}</span>
                <small className="cell-sub">
                  {sum(o.items, (i) => i.quantity)} ürün
                </small>
              </td>
              <td>
                <div className="customer-cell">
                  <span
                    className={
                      "customer-avatar " +
                      (o.channel === "Şube"
                        ? "orange"
                        : o.channel === "Paket servis"
                          ? "green"
                          : "blue")
                    }
                  >
                    {o.channel === "Şube" ? (
                      <Store size={17} />
                    ) : o.channel === "Paket servis" ? (
                      <Bike size={17} />
                    ) : (
                      <ShoppingBag size={17} />
                    )}
                  </span>
                  <span>
                    <strong>{o.customer}</strong>
                    <small>{o.channel}</small>
                  </span>
                </div>
              </td>
              <td className="money-cell">
                {money(o.total)}
                <small className="cell-sub">{o.payment}</small>
              </td>
              <td>
                <StatusBadge status={o.status} />
              </td>
              <td>
                <span>{timeLabel(o.createdAt)}</span>
                <small className="cell-sub">{dateLabel(o.createdAt)}</small>
              </td>
              {onDetail && (
                <td>
                  <button
                    className="icon-button"
                    onClick={() => onDetail(o)}
                    aria-label={`Sipariş ${o.number} ayrıntıları`}
                  >
                    <Eye size={18} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Dashboard({
  state,
  navigate,
  openOrder,
  onStock,
}: {
  state: AppState;
  navigate: (page: Page) => void;
  openOrder: () => void;
  onStock: (id?: string) => void;
}) {
  const today = localDate();
  const todayOrders = state.orders.filter(
    (o) => localDate(o.createdAt) === today,
  );
  const sales = completed(todayOrders);
  const revenue = sum(sales, (o) => o.total);
  const activeOrders = state.orders.filter(
    (o) => o.status === "Hazır" || o.status === "Hazırlanıyor",
  );
  const low = state.products
    .filter((p) => p.active && p.stock <= p.minStock)
    .sort((a, b) => a.stock - b.stock);
  const hour = Number(
    new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      timeZone: "Europe/Istanbul",
    }),
  );
  const greeting =
    hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";
  return (
    <>
      <PageHeading
        eyebrow="İŞLETMENE BİR BAKIŞ"
        title={`${greeting}, ${state.settings.ownerName.split(" ")[0]} 👋`}
        description="Bugün de güzel işler çıkaralım. İşte şubenin güncel durumu."
      >
        <span className="date-pill">
          <CalendarDays size={16} />
          Bugün
        </span>
        <AddButton onClick={openOrder}>Yeni sipariş</AddButton>
      </PageHeading>
      {state.settings.demoData && (
        <div className="demo-banner">
          <Flame size={16} />
          <span>
            Örnek işletme verileri görüntüleniyor. Gerçek kayıt eklediğinde
            örnek kayıtlar da raporlarda yer alır.
          </span>
          <button className="link-button" onClick={() => navigate("settings")}>
            Bilgi <ArrowRight size={14} />
          </button>
        </div>
      )}
      <div className="stats-grid">
        <Metric
          label="Bugünkü ciro"
          value={money(revenue)}
          foot={`${sales.length} tamamlanan siparişten`}
          icon={<Wallet size={22} />}
        />
        <Metric
          label="Bugünkü sipariş"
          value={count(todayOrders.filter((o) => o.status !== "İptal").length)}
          foot={`${todayOrders.filter((o) => o.status === "İptal").length} iptal edilen sipariş`}
          icon={<ShoppingBag size={22} />}
          color="green"
        />
        <Metric
          label="Ortalama sepet"
          value={money(sales.length ? revenue / sales.length : 0)}
          foot="Tamamlanan sipariş ortalaması"
          icon={<TrendingUp size={22} />}
          color="blue"
        />
        <Metric
          label="Aktif siparişler"
          value={count(activeOrders.length)}
          foot={`${activeOrders.filter((o) => o.status === "Hazır").length} sipariş teslimata hazır`}
          icon={<Clock3 size={22} />}
          color="purple"
        />
      </div>
      <div className="dashboard-grid">
        <SalesChart state={state} />
        <Channels orders={sales} />
      </div>
      <div className="dashboard-grid dashboard-bottom">
        <section className="card">
          <CardHeader
            title="Son siparişler"
            description="Şubendeki son hareketler"
          >
            <button className="link-button" onClick={() => navigate("orders")}>
              Tümünü gör <ArrowRight size={15} />
            </button>
          </CardHeader>
          {state.orders.length ? (
            <OrderTable orders={state.orders.slice(0, 5)} />
          ) : (
            <Empty
              title="İlk siparişini oluşturalım"
              message="Yeni siparişler bu alanda görünecek."
            >
              <AddButton onClick={openOrder}>Yeni sipariş</AddButton>
            </Empty>
          )}
          <div className="table-footer">
            <span>
              <span className="live-dot" />
              Siparişler otomatik güncellenir
            </span>
            <button className="link-button" onClick={() => navigate("orders")}>
              Sipariş yönetimi <ArrowRight size={14} />
            </button>
          </div>
        </section>
        <section className="card">
          <CardHeader
            title="Stok uyarıları"
            description="Takip etmen gereken ürünler"
          >
            <span className={"badge " + (low.length ? "orange" : "green")}>
              {low.length} ürün
            </span>
          </CardHeader>
          <div className="stock-list">
            {low.length ? (
              low.slice(0, 4).map((p) => (
                <div className="stock-item" key={p.id}>
                  <span className="stock-avatar">
                    {productEmoji(p.category)}
                  </span>
                  <div className="stock-info">
                    <strong>{p.name}</strong>
                    <span>
                      <span className="text-danger">
                        {count(p.stock)} {p.unit} kaldı
                      </span>
                      <small>Min. {count(p.minStock)}</small>
                    </span>
                    <div className="stock-track">
                      <span
                        style={{
                          width:
                            Math.min(
                              100,
                              p.minStock ? (p.stock / p.minStock) * 100 : 0,
                            ) + "%",
                        }}
                      />
                    </div>
                  </div>
                  <button
                    className="icon-button"
                    onClick={() => onStock(p.id)}
                    aria-label={`${p.name} stok girişi`}
                  >
                    <Plus size={18} />
                  </button>
                </div>
              ))
            ) : (
              <div className="stock-healthy">
                <CheckCircle2 size={36} />
                <strong>Stoklar yolunda!</strong>
                <p>Minimum seviyenin altında ürün yok.</p>
              </div>
            )}
          </div>
          <div className="stock-card-footer">
            <button
              className="btn secondary full"
              onClick={() => navigate("stock")}
            >
              <Package size={16} />
              Stokları yönet <ArrowRight size={15} />
            </button>
          </div>
        </section>
      </div>
      <div className="insight-banner">
        <span className="insight-icon">
          <BarChart3 size={23} />
        </span>
        <div>
          <strong>Rakamlar doğru adımları gösterir.</strong>
          <p>
            Satışlarını, ödeme dağılımını ve giderlerini rapor ekranından takip
            et.
          </p>
        </div>
        <button className="btn secondary" onClick={() => navigate("reports")}>
          Raporları keşfet <ArrowUpRight size={16} />
        </button>
      </div>
    </>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="search-field">
      <Search size={18} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
}

export function Orders({
  state,
  mutate,
  busy,
  open,
}: {
  state: AppState;
  mutate: Mutation;
  busy: boolean;
  open: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Tümü");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [page, setPage] = useState(0);
  const selected = state.orders.find((o) => o.id === selectedId);
  const close = useCallback(() => {
    setSelectedId(null);
    setConfirmCancel(false);
  }, []);
  const matches = state.orders.filter(
    (o) =>
      (filter === "Tümü" || o.status === filter) &&
      `${o.number} ${o.customer}`
        .toLocaleLowerCase("tr-TR")
        .includes(query.toLocaleLowerCase("tr-TR")),
  );
  const safePage = Math.min(
    page,
    Math.max(0, Math.ceil(matches.length / 10) - 1),
  );
  const visible = matches.slice(safePage * 10, (safePage + 1) * 10);
  async function update(status: Status) {
    if (
      selected &&
      (await mutate("/orders/" + selected.id, { status }, "PATCH"))
    ) {
      setConfirmCancel(false);
    }
  }
  return (
    <>
      <PageHeading
        title="Siparişler"
        description="Siparişleri oluştur, hazırlık sürecini ve teslimatı takip et."
      >
        <AddButton onClick={open}>Yeni sipariş</AddButton>
      </PageHeading>
      <div className="toolbar">
        <div className="filter-tabs">
          {["Tümü", "Hazırlanıyor", "Hazır", "Tamamlandı", "İptal"].map((s) => (
            <button
              className={filter === s ? "active" : ""}
              key={s}
              onClick={() => {
                setFilter(s);
                setPage(0);
              }}
            >
              {s}
              <span>
                {
                  state.orders.filter((o) => s === "Tümü" || o.status === s)
                    .length
                }
              </span>
            </button>
          ))}
        </div>
        <SearchField
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(0);
          }}
          placeholder="Sipariş no veya müşteri ara…"
        />
      </div>
      <section className="card">
        {matches.length ? (
          <OrderTable
            orders={visible}
            onDetail={(o) => {
              setSelectedId(o.id);
              setConfirmCancel(false);
            }}
          />
        ) : (
          <Empty
            title="Sipariş bulunamadı"
            message="Aramanı değiştir veya yeni bir sipariş oluştur."
          />
        )}
        <div className="table-footer">
          <span>
            {matches.length} sipariş · {matches.length ? safePage * 10 + 1 : 0}–
            {Math.min((safePage + 1) * 10, matches.length)} gösteriliyor
          </span>
          <div className="inline-actions">
            <button
              className="icon-button"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
              aria-label="Önceki sayfa"
            >
              <ChevronLeft size={18} />
            </button>
            <span>{safePage + 1}</span>
            <button
              className="icon-button"
              disabled={(safePage + 1) * 10 >= matches.length}
              onClick={() => setPage(safePage + 1)}
              aria-label="Sonraki sayfa"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </section>
      {selected && (
        <Modal
          title={`Sipariş #${selected.number}`}
          subtitle={`${dateLabel(selected.createdAt)} · ${timeLabel(selected.createdAt)} · ${selected.channel}`}
          close={close}
        >
          <div className="modal-body">
            <div className="order-detail-top">
              <div>
                <h3>{selected.customer}</h3>
                <p>{selected.payment} ile ödeme</p>
              </div>
              <StatusBadge status={selected.status} />
            </div>
            <div className="detail-list">
              {selected.items.map((i, index) => (
                <div key={index}>
                  <span>
                    {i.quantity} × {i.name}
                    <small>{money(i.unitPrice)} / adet</small>
                  </span>
                  <strong>{money(i.unitPrice * i.quantity)}</strong>
                </div>
              ))}
            </div>
            <div className="cart-summary">
              <span>Sipariş toplamı</span>
              <strong>{money(selected.total)}</strong>
            </div>
            {confirmCancel && (
              <div className="error-banner">
                Bu sipariş iptal edilecek ve ürünler stoğa geri eklenecek.
                Onaylıyor musun?
              </div>
            )}
          </div>
          <div className="modal-footer">
            {selected.status !== "Tamamlandı" && selected.status !== "İptal" ? (
              <>
                <button
                  className="btn danger"
                  disabled={busy}
                  onClick={() =>
                    confirmCancel ? update("İptal") : setConfirmCancel(true)
                  }
                >
                  {confirmCancel ? "Evet, iptal et" : "Siparişi iptal et"}
                </button>
                {confirmCancel ? (
                  <button
                    className="btn secondary"
                    onClick={() => setConfirmCancel(false)}
                  >
                    Vazgeç
                  </button>
                ) : (
                  <button
                    className="btn primary"
                    disabled={busy}
                    onClick={() =>
                      update(
                        selected.status === "Hazırlanıyor"
                          ? "Hazır"
                          : "Tamamlandı",
                      )
                    }
                  >
                    <Check size={17} />
                    {selected.status === "Hazırlanıyor"
                      ? "Hazır olarak işaretle"
                      : "Teslim et ve tamamla"}
                  </button>
                )}
              </>
            ) : (
              <button className="btn secondary" onClick={close}>
                Kapat
              </button>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}

export function Products({
  state,
  open,
  edit,
}: {
  state: AppState;
  open: () => void;
  edit: (p: Product) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tümü");
  const categories = [
    "Tümü",
    ...new Set(state.products.map((p) => p.category)),
  ];
  const filtered = state.products.filter(
    (p) =>
      (category === "Tümü" || p.category === category) &&
      p.name
        .toLocaleLowerCase("tr-TR")
        .includes(query.toLocaleLowerCase("tr-TR")),
  );
  return (
    <>
      <PageHeading
        title="Ürünler & menü"
        description="Menünü güncel tut, fiyat ve ürün bilgilerini kolayca düzenle."
      >
        <AddButton onClick={open}>Ürün ekle</AddButton>
      </PageHeading>
      <div className="toolbar">
        <div className="filter-tabs">
          {categories.map((c) => (
            <button
              key={c}
              className={c === category ? "active" : ""}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Ürün adı ara…"
        />
      </div>
      {filtered.length ? (
        <div className="products-grid">
          {filtered.map((p) => (
            <article
              className={"product-card" + (!p.active ? " inactive" : "")}
              key={p.id}
            >
              <div
                className={
                  "product-visual visual-" +
                  (p.category === "İçecekler"
                    ? "blue"
                    : p.category === "Menüler"
                      ? "green"
                      : "orange")
                }
              >
                <span>{productEmoji(p.category)}</span>
                <span className={"badge " + (p.active ? "green" : "gray")}>
                  {p.active ? "Satışa açık" : "Satışa kapalı"}
                </span>
                <button
                  className="icon-button"
                  onClick={() => edit(p)}
                  aria-label={`${p.name} düzenle`}
                >
                  <Pencil size={16} />
                </button>
              </div>
              <div className="product-info">
                <span className="product-category">{p.category}</span>
                <h3>{p.name}</h3>
                <div className="product-price">
                  <strong>{money(p.price)}</strong>
                  <span>/ {p.unit}</span>
                </div>
                <div className="product-footer">
                  <span className={p.stock <= p.minStock ? "text-danger" : ""}>
                    <Package size={14} />
                    {count(p.stock)} {p.unit} stokta
                  </span>
                  <button className="link-button" onClick={() => edit(p)}>
                    Düzenle <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="card">
          <Empty
            title="Menün seni bekliyor"
            message="Ürün ekle veya aramanı değiştir."
          >
            <AddButton onClick={open}>Ürün ekle</AddButton>
          </Empty>
        </section>
      )}
    </>
  );
}

export function Stock({
  state,
  open,
}: {
  state: AppState;
  open: (id?: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const low = state.products.filter((p) => p.active && p.stock <= p.minStock);
  const products = state.products.filter(
    (p) =>
      (!lowOnly || (p.active && p.stock <= p.minStock)) &&
      p.name
        .toLocaleLowerCase("tr-TR")
        .includes(query.toLocaleLowerCase("tr-TR")),
  );
  const [movementPage, setMovementPage] = useState(0);
  const maxPage = Math.max(0, Math.ceil(state.movements.length / 12) - 1);
  const safePage = Math.min(movementPage, maxPage);
  return (
    <>
      <PageHeading
        title="Stok yönetimi"
        description="Satılabilir ürün stoklarını izle, girişleri ve fireleri kaydet."
      >
        <AddButton onClick={() => open()}>Stok hareketi ekle</AddButton>
      </PageHeading>
      <div className="stats-grid three">
        <Metric
          label="Takip edilen ürün"
          value={count(state.products.filter((p) => p.active).length)}
          foot="Satışa açık ürünler"
          icon={<Package size={22} />}
        />
        <Metric
          label="Kritik stok"
          value={count(low.length)}
          foot="Minimum seviyede veya altında"
          icon={<Activity size={22} />}
          color="purple"
        />
        <Metric
          label="Stok maliyet değeri"
          value={money(sum(state.products, (p) => p.stock * p.cost))}
          foot="Güncel birim maliyet üzerinden"
          icon={<Wallet size={22} />}
          color="green"
        />
      </div>
      <section className="card">
        <CardHeader
          title="Ürün stokları"
          description="Siparişler stoktan otomatik düşülür."
        />
        <div className="toolbar in-card">
          <div className="filter-tabs">
            <button
              className={!lowOnly ? "active" : ""}
              onClick={() => setLowOnly(false)}
            >
              Tüm ürünler
            </button>
            <button
              className={lowOnly ? "active" : ""}
              onClick={() => setLowOnly(true)}
            >
              Kritik stok <span>{low.length}</span>
            </button>
          </div>
          <SearchField
            value={query}
            onChange={setQuery}
            placeholder="Stokta ürün ara…"
          />
        </div>
        {products.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Ürün</th>
                  <th>Mevcut stok</th>
                  <th>Minimum</th>
                  <th>Durum</th>
                  <th className="text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="customer-cell">
                        <span className="stock-avatar small">
                          {productEmoji(p.category)}
                        </span>
                        <span>
                          <strong>{p.name}</strong>
                          <small>{p.category}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <strong>{count(p.stock)}</strong> {p.unit}
                    </td>
                    <td>
                      {count(p.minStock)} {p.unit}
                    </td>
                    <td>
                      <span
                        className={
                          "badge " +
                          (!p.active
                            ? "gray"
                            : p.stock <= p.minStock
                              ? "red"
                              : "green")
                        }
                      >
                        {!p.active
                          ? "Satışa kapalı"
                          : p.stock === 0
                            ? "Tükendi"
                            : p.stock <= p.minStock
                              ? "Kritik stok"
                              : "Yeterli"}
                      </span>
                    </td>
                    <td className="text-right">
                      <button
                        className="btn secondary small"
                        onClick={() => open(p.id)}
                      >
                        <Plus size={14} />
                        Hareket ekle
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Ürün bulunamadı"
            message="Aramanı veya stok filtresini değiştir."
          />
        )}
      </section>
      <section className="card section-gap">
        <CardHeader
          title="Stok hareketleri"
          description="Satış, iptal, tedarik ve düzeltme kayıtları"
        />
        {state.movements.length ? (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ürün</th>
                    <th>Hareket</th>
                    <th>Açıklama</th>
                    <th>Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {state.movements
                    .slice(safePage * 12, (safePage + 1) * 12)
                    .map((m) => (
                      <tr key={m.id}>
                        <td>
                          <strong>{m.productName}</strong>
                        </td>
                        <td>
                          <span
                            className={
                              m.quantity > 0 ? "text-success" : "text-danger"
                            }
                          >
                            {m.quantity > 0 ? "+" : ""}
                            {count(m.quantity)}
                          </span>
                        </td>
                        <td>{m.reason}</td>
                        <td>
                          {dateLabel(m.createdAt)} · {timeLabel(m.createdAt)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>
                {state.movements.length} hareket · Sayfa {safePage + 1}
              </span>
              <div className="inline-actions">
                <button
                  className="icon-button"
                  disabled={safePage === 0}
                  onClick={() => setMovementPage(safePage - 1)}
                  aria-label="Önceki hareketler"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  className="icon-button"
                  disabled={safePage === maxPage}
                  onClick={() => setMovementPage(safePage + 1)}
                  aria-label="Sonraki hareketler"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <Empty
            title="Henüz stok hareketi yok"
            message="Giriş ve satış işlemleri burada listelenir."
          />
        )}
      </section>
    </>
  );
}

export function Expenses({
  state,
  mutate,
  busy,
  open,
}: {
  state: AppState;
  mutate: Mutation;
  busy: boolean;
  open: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const close = useCallback(() => setSelected(null), []);
  const currentMonth = localDate().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const rows = state.expenses.filter(
    (e) =>
      (!month || e.date.startsWith(month)) &&
      `${e.description} ${e.category}`
        .toLocaleLowerCase("tr-TR")
        .includes(query.toLocaleLowerCase("tr-TR")),
  );
  const categories = [...new Set(rows.map((e) => e.category))];
  return (
    <>
      <PageHeading
        title="Giderler"
        description="Harcamalarını kaydet, işletmenin gider dağılımını takip et."
      >
        <AddButton onClick={open}>Gider ekle</AddButton>
      </PageHeading>
      <div className="stats-grid three">
        <Metric
          label="Seçili dönemin gideri"
          value={money(sum(rows, (e) => e.amount))}
          foot={
            month
              ? `${month} dönemi · ${rows.length} kayıt`
              : `${rows.length} kayıt · Tüm dönemler`
          }
          icon={<Wallet size={22} />}
        />
        <Metric
          label="En büyük gider"
          value={money(Math.max(0, ...rows.map((e) => e.amount)))}
          foot="Seçili filtredeki tek gider"
          icon={<ArrowUpRight size={22} />}
          color="purple"
        />
        <Metric
          label="Gider kategorisi"
          value={count(categories.length)}
          foot="Seçili dönemde kullanılan kategoriler"
          icon={<FileText size={22} />}
          color="blue"
        />
      </div>
      <div className="toolbar">
        <div className="inline-actions">
          <label className="form-field horizontal">
            Dönem
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              aria-label="Gider dönemi"
            />
          </label>
          <button className="btn ghost small" onClick={() => setMonth("")}>
            Tümü
          </button>
        </div>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Gider veya kategori ara…"
        />
      </div>
      <section className="card">
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Gider açıklaması</th>
                  <th>Kategori</th>
                  <th>Tarih</th>
                  <th>Tutar</th>
                  <th className="text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.description}</strong>
                    </td>
                    <td>
                      <span className="badge gray">{e.category}</span>
                    </td>
                    <td>{dateLabel(e.date)}</td>
                    <td className="money-cell">{money(e.amount)}</td>
                    <td className="text-right">
                      <button
                        className="icon-button text-danger"
                        onClick={() => setSelected(e.id)}
                        aria-label={`${e.description} sil`}
                      >
                        <Trash2 size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Gider kaydı bulunamadı"
            message="Bu döneme gider ekleyebilir veya filtreyi değiştirebilirsin."
          />
        )}
        <div className="table-footer">
          <span>{rows.length} gider kaydı</span>
          <strong>Toplam {money(sum(rows, (e) => e.amount))}</strong>
        </div>
      </section>
      {selected && (
        <Modal title="Gideri sil" close={close}>
          <div className="modal-body">
            <p>
              Bu gider kaydı kalıcı olarak silinecek. Devam etmek istiyor musun?
            </p>
            <div className="section-note">
              {state.expenses.find((e) => e.id === selected)?.description}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn secondary" onClick={close}>
              Vazgeç
            </button>
            <button
              className="btn danger"
              disabled={busy}
              onClick={async () => {
                if (await mutate("/expenses/" + selected, undefined, "DELETE"))
                  close();
              }}
            >
              Evet, sil
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

export function Employees({
  state,
  open,
  edit,
}: {
  state: AppState;
  open: () => void;
  edit: (e: Employee) => void;
}) {
  const [query, setQuery] = useState("");
  const rows = state.employees.filter((e) =>
    `${e.name} ${e.role}`
      .toLocaleLowerCase("tr-TR")
      .includes(query.toLocaleLowerCase("tr-TR")),
  );
  const active = state.employees.filter((e) => e.active);
  return (
    <>
      <PageHeading
        title="Personel"
        description="Ekibini tanı, iletişim ve maaş bilgilerini düzenli tut."
      >
        <AddButton onClick={open}>Personel ekle</AddButton>
      </PageHeading>
      <div className="stats-grid three">
        <Metric
          label="Aktif çalışan"
          value={count(active.length)}
          foot={`${state.employees.length} toplam personel kaydı`}
          icon={<Users size={22} />}
          color="green"
        />
        <Metric
          label="Aylık maaş toplamı"
          value={money(sum(active, (e) => e.salary))}
          foot="Aktif personelin kayıtlı maaşları"
          icon={<Wallet size={22} />}
        />
        <Metric
          label="Görev çeşitliliği"
          value={count(new Set(active.map((e) => e.role)).size)}
          foot="Aktif ekibindeki farklı görevler"
          icon={<Store size={22} />}
          color="blue"
        />
      </div>
      <div className="toolbar">
        <p className="text-muted">Ekibin, işletmenin kalbi.</p>
        <SearchField
          value={query}
          onChange={setQuery}
          placeholder="Personel veya görev ara…"
        />
      </div>
      {rows.length ? (
        <div className="employee-grid">
          {rows.map((e, i) => (
            <article className="employee-card" key={e.id}>
              <div className="employee-top">
                <span className={"badge " + (e.active ? "green" : "gray")}>
                  {e.active ? "Aktif çalışan" : "Pasif"}
                </span>
                <button
                  className="icon-button"
                  aria-label={`${e.name} düzenle`}
                  onClick={() => edit(e)}
                >
                  <Pencil size={17} />
                </button>
              </div>
              <span className={"employee-avatar avatar-" + (i % 3)}>
                {e.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <h3>{e.name}</h3>
              <p>{e.role}</p>
              <div className="employee-details">
                <span>
                  <Phone size={16} />
                  {e.phone || "Telefon eklenmedi"}
                </span>
                <span>
                  <Wallet size={16} />
                  {money(e.salary)}
                  <small>/ ay</small>
                </span>
              </div>
              <button className="btn secondary full" onClick={() => edit(e)}>
                Bilgileri düzenle <ArrowRight size={15} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <section className="card">
          <Empty
            title="Ekibini buraya ekle"
            message="Personel kayıtları ve iletişim bilgileri burada görünecek."
          >
            <AddButton onClick={open}>Personel ekle</AddButton>
          </Empty>
        </section>
      )}
      <p className="section-note section-gap">
        <Users size={17} /> Bu ekran personel rehberidir. Vardiya, bordro ve
        personel giriş yetkileri bu sürümde bulunmaz.
      </p>
    </>
  );
}

function downloadCsv(rows: (string | number)[][], filename: string) {
  const csv =
    "\uFEFF" +
    rows
      .map((row) =>
        row
          .map((cell) => {
            const text = String(cell);
            return (
              '"' +
              (/^[=+\-@\t\r]/.test(text) ? "'" : "") +
              text.replaceAll('"', '""') +
              '"'
            );
          })
          .join(";"),
      )
      .join("\r\n");
  const link = document.createElement("a");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" }),
  );
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function Reports({ state }: { state: AppState }) {
  const dates = pastDates(7);
  const [from, setFrom] = useState(dates[0]);
  const [to, setTo] = useState(localDate());
  const invalid = from > to;
  const orders = completed(state.orders).filter(
    (o) =>
      !invalid &&
      localDate(o.createdAt) >= from &&
      localDate(o.createdAt) <= to,
  );
  const expenses = state.expenses.filter(
    (e) => !invalid && e.date >= from && e.date <= to,
  );
  const revenue = sum(orders, (o) => o.total);
  const cost = sum(orders, (o) => sum(o.items, (i) => i.quantity * i.unitCost));
  const expense = sum(expenses, (e) => e.amount);
  const best = useMemo(() => {
    const map = new Map<
      string,
      { name: string; quantity: number; total: number }
    >();
    for (const order of orders)
      for (const item of order.items) {
        const entry = map.get(item.productId) || {
          name: item.name,
          quantity: 0,
          total: 0,
        };
        entry.quantity += item.quantity;
        entry.total += item.quantity * item.unitPrice;
        map.set(item.productId, entry);
      }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [orders]);
  const payment = ["Nakit", "Kart", "Online"].map((name) => ({
    name,
    total: sum(
      orders.filter((o) => o.payment === name),
      (o) => o.total,
    ),
  }));
  const daily = [...new Set(orders.map((o) => localDate(o.createdAt)))]
    .sort()
    .reverse();
  function exportReport() {
    downloadCsv(
      [
        [
          "Tarih",
          "Sipariş no",
          "Müşteri",
          "Kanal",
          "Ödeme",
          "Ciro (TL)",
          "Ürün maliyeti (TL)",
        ],
        ...orders.map((o) => [
          localDate(o.createdAt),
          o.number,
          o.customer,
          o.channel,
          o.payment,
          o.total.toFixed(2),
          sum(o.items, (i) => i.quantity * i.unitCost).toFixed(2),
        ]),
      ],
      `komagene-satis-${from}-${to}.csv`,
    );
  }
  return (
    <>
      <PageHeading
        title="İşletme raporları"
        description="Satış ve gider kayıtlarından işletmenin performansını gör."
      >
        <button
          className="btn secondary"
          disabled={!orders.length}
          onClick={exportReport}
        >
          <Download size={17} />
          Satışları CSV indir
        </button>
      </PageHeading>
      <div className="report-date-bar">
        <div>
          <CalendarDays size={20} />
          <strong>Rapor dönemi</strong>
        </div>
        <label className="form-field horizontal">
          Başlangıç
          <input
            type="date"
            value={from}
            required
            onChange={(e) => setFrom(e.target.value || localDate())}
            aria-label="Rapor başlangıç tarihi"
          />
        </label>
        <span>—</span>
        <label className="form-field horizontal">
          Bitiş
          <input
            type="date"
            value={to}
            required
            onChange={(e) => setTo(e.target.value || localDate())}
            aria-label="Rapor bitiş tarihi"
          />
        </label>
        <button
          className="btn ghost small"
          onClick={() => {
            setFrom(dates[0]);
            setTo(localDate());
          }}
        >
          Son 7 gün
        </button>
      </div>
      {invalid && (
        <div className="error-banner">
          Başlangıç tarihi bitiş tarihinden sonra olamaz.
        </div>
      )}
      <div className="stats-grid">
        <Metric
          label="Toplam ciro"
          value={money(revenue)}
          foot={`${orders.length} tamamlanan sipariş`}
          icon={<TrendingUp size={22} />}
          color="green"
        />
        <Metric
          label="Satılan ürün maliyeti"
          value={money(cost)}
          foot="Sipariş anındaki birim maliyetler"
          icon={<Package size={22} />}
          color="blue"
        />
        <Metric
          label="Kayıtlı giderler"
          value={money(expense)}
          foot={`${expenses.length} gider kaydı`}
          icon={<Wallet size={22} />}
          color="purple"
        />
        <Metric
          label="Brüt ürün kârı"
          value={money(revenue - cost)}
          foot="Ciro − satılan ürün maliyeti"
          icon={<BarChartIcon />}
        />
      </div>
      <p className="section-note">
        <FileText size={17} /> Brüt ürün kârı gider ve vergileri içermez.
        Malzeme alımları ayrıca gider kaydedilmişse maliyetlerle çakışabilir;
        net kâr olarak değerlendirmeyin.
      </p>
      <div className="dashboard-grid section-gap">
        <section className="card">
          <CardHeader
            title="En çok satan ürünler"
            description="Seçili dönemde ciroya göre sıralama"
          />
          {best.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ürün</th>
                    <th>Satılan adet</th>
                    <th>Ciro</th>
                    <th>Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {best.map((item, i) => (
                    <tr key={i}>
                      <td>
                        <span className="ranking">{i + 1}</span>
                        <strong>{item.name}</strong>
                      </td>
                      <td>{count(item.quantity)}</td>
                      <td className="money-cell">{money(item.total)}</td>
                      <td>
                        %
                        {revenue ? Math.round((item.total / revenue) * 100) : 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="Rapor için henüz satış yok"
              message="Tamamlanan siparişlerin bu alanda raporlanır."
            />
          )}
        </section>
        <section className="card">
          <CardHeader
            title="Ödeme dağılımı"
            description="Tamamlanan siparişlerin ödeme yöntemleri"
          />
          <div className="payment-list">
            {payment.map((p, i) => (
              <div key={p.name} className="payment-item">
                <span className={"stat-icon " + ["green", "orange", "blue"][i]}>
                  {i === 0 ? <Wallet size={20} /> : <CreditCard size={20} />}
                </span>
                <div>
                  <strong>{p.name}</strong>
                  <div className="progress-track">
                    <span
                      className={
                        "progress-fill " + ["green", "orange", "blue"][i]
                      }
                      style={{
                        width: (revenue ? (p.total / revenue) * 100 : 0) + "%",
                      }}
                    />
                  </div>
                </div>
                <strong>{money(p.total)}</strong>
              </div>
            ))}
          </div>
          <div className="report-total">
            <span>Toplam</span>
            <strong>{money(revenue)}</strong>
          </div>
        </section>
      </div>
      <section className="card section-gap">
        <CardHeader
          title="Günlük satış özeti"
          description="Satış yapılan günler · tamamlanan siparişler"
        />
        {daily.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Sipariş sayısı</th>
                  <th>Ortalama sepet</th>
                  <th>Toplam ciro</th>
                </tr>
              </thead>
              <tbody>
                {daily.map((d) => {
                  const items = orders.filter(
                    (o) => localDate(o.createdAt) === d,
                  );
                  const total = sum(items, (o) => o.total);
                  return (
                    <tr key={d}>
                      <td>{dateLabel(d)}</td>
                      <td>{items.length}</td>
                      <td>{money(total / items.length)}</td>
                      <td className="money-cell">{money(total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Bu dönemde tamamlanan sipariş yok"
            message="Tarih aralığını değiştirebilir veya siparişleri tamamlayabilirsin."
          />
        )}
      </section>
    </>
  );
}
function BarChartIcon() {
  return <TrendingUp size={22} />;
}

export function SettingsPage({
  state,
  mutate,
  busy,
}: {
  state: AppState;
  mutate: Mutation;
  busy: boolean;
}) {
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(
      "/settings",
      { branchName: form.get("branchName"), ownerName: form.get("ownerName") },
      "PATCH",
    );
  }
  return (
    <>
      <PageHeading
        title="İşletme ayarları"
        description="Şube bilgilerini düzenle ve verilerini dışa aktar."
      />
      <div className="settings-grid">
        <section className="card">
          <CardHeader
            title="Şube bilgileri"
            description="Panelde görüntülenen işletme ve yönetici bilgileri"
          />
          <form onSubmit={submit}>
            <div className="card-body form-stack">
              <label className="form-field">
                Şube adı
                <input
                  key={"branch-" + state.settings.branchName}
                  name="branchName"
                  required
                  maxLength={100}
                  defaultValue={state.settings.branchName}
                />
              </label>
              <label className="form-field">
                Yönetici adı
                <input
                  key={"owner-" + state.settings.ownerName}
                  name="ownerName"
                  required
                  maxLength={80}
                  defaultValue={state.settings.ownerName}
                />
              </label>
              <label className="form-field">
                Para birimi
                <input value="Türk lirası (TRY) · ₺" disabled readOnly />
              </label>
              <label className="form-field">
                Saat dilimi
                <input value="Türkiye · Europe/Istanbul" disabled readOnly />
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn primary" disabled={busy}>
                <Check size={17} />
                {busy ? "Kaydediliyor…" : "Değişiklikleri kaydet"}
              </button>
            </div>
          </form>
        </section>
        <div className="stack">
          <section className="card">
            <CardHeader
              title="Verilerin seninle"
              description="Kayıtlarının bir kopyasını indir."
            />
            <div className="card-body">
              <div className="settings-icon">
                <ArrowDownToLine size={24} />
              </div>
              <p>
                Sipariş, stok, ürün, gider ve personel kayıtlarını JSON dosyası
                olarak dışa aktar. Dosya kişisel ve işletme bilgileri içerir;
                güvenli bir yerde sakla.
              </p>
              <ExportButton />
              <p className="field-hint">
                Bu dosya raporlama içindir; uygulamada içe aktarma özelliği
                yoktur. Tam yedekleme için README talimatlarını kullan.
              </p>
            </div>
          </section>
          <section className="card">
            <CardHeader title="Uygulama bilgileri" />
            <div className="card-body detail-list">
              <div>
                <span>Sürüm</span>
                <strong>1.0.0</strong>
              </div>
              <div>
                <span>Veri saklama</span>
                <strong>Sunucuda kalıcı kayıt</strong>
              </div>
              <div>
                <span>Erişim</span>
                <strong>Tek yönetici</strong>
              </div>
              <div>
                <span>Hesap güvenliği</span>
                <span className="badge green">
                  <ShieldCheck size={13} />
                  Şifre korumalı
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
      {state.settings.demoData && (
        <div className="section-note section-gap">
          <Flame size={18} />
          <span>
            Bu işletme örnek verilerle oluşturuldu. Örnek ve gerçek kayıtlar
            raporlarda birlikte görünür. Gerçek kullanım için örnek veri
            içermeyen ayrı bir kurulum kullanın. Ayrıntılar proje kurulum
            rehberinde yer alır.
          </span>
        </div>
      )}
      <div className="section-note section-gap">
        <Store size={18} />
        <span>
          Bu uygulama bağımsız bir işletme yönetim aracıdır. Komagene merkez
          sistemine, yemek platformlarına, e-faturaya veya mali POS cihazlarına
          bağlı değildir. Siparişler manuel girilir.
        </span>
      </div>
    </>
  );
}
