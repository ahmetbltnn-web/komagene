import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  CreditCard,
  Eye,
  EyeOff,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Plus,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { api, ApiError } from "./api";
import type { AppState, Employee, Page, Product } from "./types";
import { localDate } from "./types";
import {
  Dashboard,
  Employees,
  Expenses,
  Orders,
  Products,
  Reports,
  SettingsPage,
  Stock,
} from "./views";
import {
  EmployeeForm,
  ExpenseForm,
  OrderForm,
  ProductForm,
  StockForm,
} from "./forms";

type Auth = { initialized: boolean; user: { name: string } | null };
export type Mutation = (
  path: string,
  body: unknown,
  method?: string,
) => Promise<boolean>;
type ModalKind = "order" | "product" | "stock" | "expense" | "employee";
const nav = [
  { key: "dashboard", label: "Genel bakış", icon: LayoutDashboard },
  { key: "orders", label: "Siparişler", icon: ShoppingBag },
  { key: "products", label: "Ürünler & menü", icon: ClipboardList },
  { key: "stock", label: "Stok yönetimi", icon: Package },
  { key: "expenses", label: "Giderler", icon: Wallet },
  { key: "employees", label: "Personel", icon: Users },
  { key: "reports", label: "Raporlar", icon: BarChart3 },
] as const;
const pageLabels: Record<Page, string> = {
  dashboard: "Genel bakış",
  orders: "Siparişler",
  products: "Ürünler & menü",
  stock: "Stok yönetimi",
  expenses: "Giderler",
  employees: "Personel",
  reports: "Raporlar",
  settings: "İşletme ayarları",
};
const pageFromHash = (): Page => {
  const hash = window.location.hash.slice(1);
  return Object.hasOwn(pageLabels, hash) ? (hash as Page) : "dashboard";
};

export function Brand() {
  return (
    <div className="sidebar-brand">
      <span className="brand-icon">
        k<span>·</span>
      </span>
      <span>
        <span className="brand-word">komagene</span>
        <span className="brand-caption">İŞLETME PANELİ</span>
      </span>
    </div>
  );
}

export function Modal({
  title,
  subtitle,
  children,
  close,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      [
        ...(dialog.current?.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, a[href], [tabindex="0"]',
        ) || []),
      ].filter(
        (el) => !el.hasAttribute("disabled") && el.getClientRects().length > 0,
      );
    focusable()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
      if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0];
        const last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [close]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={dialog}
        className={"modal" + (wide ? " wide" : "")}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button
            className="icon-button modal-close"
            onClick={close}
            aria-label="Pencereyi kapat"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AuthPage({
  auth,
  onSuccess,
}: {
  auth: Auth;
  onSuccess: () => Promise<void>;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const setup = !auth.initialized;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api(
        setup ? "/setup" : "/login",
        "POST",
        setup
          ? {
              name: form.get("name"),
              branchName: form.get("branchName"),
              password: form.get("password"),
              withDemo: form.get("withDemo") === "on",
            }
          : { password: form.get("password") },
      );
      await onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bağlantı kurulamadı.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-shell">
      <section className="auth-story">
        <Brand />
        <div className="auth-illustration">
          <span className="setup-tag">
            <span /> Şubenin kontrolü sende
          </span>
          <h1>
            İşini büyüt.
            <br />
            <span>Her detayı yönet.</span>
          </h1>
          <p>
            Tezgahtan kasaya, stoktan ekibine.
            <br />
            İşletmenin tüm akışı tek bir yerde.
          </p>
          <div className="auth-feature-grid">
            <div>
              <ShoppingBag size={24} />
              <strong>Siparişler</strong>
              <span>Her sipariş kontrol altında</span>
            </div>
            <div>
              <Package size={24} />
              <strong>Stok takibi</strong>
              <span>İhtiyacını önceden gör</span>
            </div>
            <div>
              <BarChart3 size={24} />
              <strong>Raporlar</strong>
              <span>Rakamlarla karar ver</span>
            </div>
            <div>
              <Users size={24} />
              <strong>Ekip yönetimi</strong>
              <span>Birlikte daha düzenli</span>
            </div>
          </div>
        </div>
        <span className="auth-note">
          İşletmen için hazırlanmış bağımsız yönetim uygulaması.
        </span>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <span className="auth-symbol">
            <Store size={28} />
          </span>
          <p className="eyebrow">KOMAGENE İŞLETME PANELİ</p>
          <h2>{setup ? "Yeni bir başlangıç." : "Tekrar hoş geldin."}</h2>
          <p className="page-description">
            {setup
              ? "Şubeni tanımla, yönetici hesabını oluştur ve başlayalım."
              : "İşletmeni yönetmeye devam etmek için giriş yap."}
          </p>
          <form className="form-stack" onSubmit={submit}>
            {setup && (
              <>
                <label className="form-field">
                  Adın soyadın
                  <input
                    name="name"
                    required
                    maxLength={80}
                    placeholder="Ad Soyad"
                    autoComplete="name"
                  />
                </label>
                <label className="form-field">
                  Şube adı
                  <input
                    name="branchName"
                    required
                    maxLength={100}
                    placeholder="Örn. Kadıköy Şubesi"
                  />
                </label>
              </>
            )}
            <label className="form-field">
              Yönetici şifresi
              <div className="password-field">
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  required
                  minLength={setup ? 10 : undefined}
                  maxLength={200}
                  autoComplete={setup ? "new-password" : "current-password"}
                  placeholder={setup ? "En az 10 karakter" : "Şifreni gir"}
                />
                <button
                  className="toggle-password"
                  type="button"
                  aria-label={show ? "Şifreyi gizle" : "Şifreyi göster"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {setup && (
              <label className="checkbox-field">
                <input type="checkbox" name="withDemo" defaultChecked />
                <span>
                  Örnek işletme verileri ekle
                  <small>
                    Özellikleri denemek için örnek sipariş, ürün ve personel
                    kayıtları oluşturur. Gerçek kayıtlar için işareti kaldır.
                  </small>
                </span>
              </label>
            )}
            {error && (
              <div className="error-banner" role="alert">
                {error}
              </div>
            )}
            <button className="btn primary full" disabled={busy}>
              {busy
                ? "Hazırlanıyor…"
                : setup
                  ? "İşletmemi oluştur"
                  : "Panele giriş yap"}
              <ArrowRight size={18} />
            </button>
          </form>
          <p className="auth-security">
            <ShieldCheck size={16} /> Şifre korumalı erişim · Kalıcı veri kaydı
          </p>
        </div>
      </section>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [state, setState] = useState<AppState | null>(null);
  const [page, setPage] = useState<Page>(pageFromHash);
  const [mobile, setMobile] = useState(false);
  const [modal, setModal] = useState<ModalKind | null>(null);
  const [editProduct, setEditProduct] = useState<Product | undefined>();
  const [editEmployee, setEditEmployee] = useState<Employee | undefined>();
  const [stockProduct, setStockProduct] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    error?: boolean;
  } | null>(null);
  const [mutating, setMutating] = useState(false);
  const mutationLock = useRef(false);
  const stateVersion = useRef(0);
  const closeModal = useCallback(() => setModal(null), []);
  const notify = (message: string, isError = false) =>
    setToast({ message, error: isError });
  const refresh = useCallback(async () => {
    const nextAuth = await api<Auth>("/auth");
    setAuth(nextAuth);
    if (nextAuth.user) setState(await api<AppState>("/state"));
    else setState(null);
    setError("");
  }, []);
  useEffect(() => {
    refresh().catch((err) => setError(err.message));
  }, [refresh]);
  useEffect(() => {
    const update = () => {
      setPage(pageFromHash());
      setMobile(false);
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    document.title = `${pageLabels[page]} · Komagene`;
  }, [page]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!auth?.user) return;
    const poll = () => {
      if (document.visibilityState !== "visible" || mutationLock.current)
        return;
      const version = stateVersion.current;
      api<AppState>("/state")
        .then((next) => {
          if (!mutationLock.current && version === stateVersion.current)
            setState(next);
        })
        .catch((err) => {
          if (err instanceof ApiError && err.status === 401) {
            setAuth({ initialized: true, user: null });
            setState(null);
          }
        });
    };
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [auth?.user]);
  const mutate: Mutation = async (path, body, method = "POST") => {
    if (mutationLock.current) return false;
    mutationLock.current = true;
    stateVersion.current++;
    setMutating(true);
    try {
      await api(path, method, body);
      try {
        setState(await api<AppState>("/state"));
      } catch {
        notify(
          "Kayıt alındı. Güncel verileri görmek için sayfayı yenileyin.",
          true,
        );
        return true;
      }
      notify("İşlem başarıyla kaydedildi.");
      return true;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setAuth({ initialized: true, user: null });
        setState(null);
        setModal(null);
      }
      notify(err instanceof Error ? err.message : "İşlem tamamlanamadı.", true);
      return false;
    } finally {
      mutationLock.current = false;
      setMutating(false);
    }
  };
  const navigate = (next: Page) => {
    window.location.hash = next;
    setPage(next);
    setMobile(false);
  };
  const openModal = (kind: ModalKind) => {
    setEditProduct(undefined);
    setEditEmployee(undefined);
    setStockProduct(undefined);
    setModal(kind);
  };
  const onEditProduct = (product: Product) => {
    setEditProduct(product);
    setModal("product");
  };
  const onEditEmployee = (employee: Employee) => {
    setEditEmployee(employee);
    setModal("employee");
  };
  const onStock = (productId?: string) => {
    setStockProduct(productId);
    setModal("stock");
  };
  async function logout() {
    try {
      await api("/logout", "POST");
      setAuth({ initialized: true, user: null });
      setState(null);
    } catch (err) {
      notify(err instanceof Error ? err.message : "Çıkış yapılamadı.", true);
    }
  }
  if (error && !state)
    return (
      <div className="loading-screen">
        <Store size={40} />
        <h2>Sunucuya ulaşılamadı</h2>
        <p>{error}</p>
        <button
          className="btn primary"
          onClick={() => refresh().catch((err) => setError(err.message))}
        >
          Yeniden dene
        </button>
      </div>
    );
  if (!auth)
    return (
      <div className="loading-screen">
        <span className="spinner" />
        <p>İşletme paneli hazırlanıyor…</p>
      </div>
    );
  if (!auth.user) return <AuthPage auth={auth} onSuccess={refresh} />;
  if (!state)
    return (
      <div className="loading-screen">
        <span className="spinner" />
        <p>İşletme verileri yükleniyor…</p>
      </div>
    );
  const lowStock = state.products.filter(
    (p) => p.active && p.stock <= p.minStock,
  );
  const activeOrders = state.orders.filter(
    (o) => o.status === "Hazırlanıyor" || o.status === "Hazır",
  ).length;
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="mobile-backdrop"
          aria-label="Menüyü kapat"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={"sidebar" + (mobile ? " open" : "")}>
        <Brand />
        <div className="branch-switch">
          <span className="branch-icon">
            <Store size={18} />
          </span>
          <span>
            <strong>{state.settings.branchName}</strong>
            <small>Tek şube yönetimi</small>
          </span>
        </div>
        <p className="nav-section">İŞLETME YÖNETİMİ</p>
        <nav aria-label="Ana menü">
          {nav.map((item) => (
            <a
              href={"#" + item.key}
              key={item.key}
              className={"nav-item" + (page === item.key ? " active" : "")}
              aria-current={page === item.key ? "page" : undefined}
              onClick={() => navigate(item.key)}
            >
              <item.icon size={20} className="nav-icon" />
              <span>{item.label}</span>
              {item.key === "orders" && activeOrders > 0 && (
                <span className="nav-badge">{activeOrders}</span>
              )}
              {item.key === "stock" && lowStock.length > 0 && (
                <span className="nav-badge muted">{lowStock.length}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span>
              <CircleHelp size={20} />
            </span>
            <strong>Her şey bir arada.</strong>
            <p>İşletmenin günlük akışını tek panelden yönet.</p>
            <button className="link-button" onClick={() => navigate("reports")}>
              Raporları incele <ArrowRight size={14} />
            </button>
          </div>
          <a
            className={"nav-item" + (page === "settings" ? " active" : "")}
            href="#settings"
            onClick={() => navigate("settings")}
          >
            <Settings size={20} />
            <span>Ayarlar</span>
          </a>
          <button className="nav-item" onClick={logout}>
            <LogOut size={20} />
            <span>Güvenli çıkış</span>
          </button>
          <div className="sidebar-status">
            <span /> Sistem çalışıyor <span className="version">v1.0</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Menüyü aç"
            >
              <Menu size={22} />
            </button>
            <Store size={17} />
            <span>İşletmem</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{pageLabels[page]}</strong>
          </div>
          <div className="topbar-actions">
            <span className="topbar-date">
              {new Date().toLocaleDateString("tr-TR", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "Europe/Istanbul",
              })}
            </span>
            <button
              className="icon-button notification-button"
              onClick={() => navigate("stock")}
              aria-label={`${lowStock.length} ürün stok uyarısı`}
            >
              <Bell size={20} />
              {lowStock.length > 0 && <i />}
            </button>
            <div className="topbar-divider" />
            <button
              className="user-button"
              onClick={() => navigate("settings")}
            >
              <span className="avatar">
                {state.settings.ownerName
                  .slice(0, 2)
                  .toLocaleUpperCase("tr-TR")}
              </span>
              <span>
                <strong>{state.settings.ownerName}</strong>
                <small>İşletme yöneticisi</small>
              </span>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>
        <main className="page-content" id="main-content">
          {page === "dashboard" && (
            <Dashboard
              state={state}
              navigate={navigate}
              openOrder={() => openModal("order")}
              onStock={onStock}
            />
          )}
          {page === "orders" && (
            <Orders
              state={state}
              mutate={mutate}
              busy={mutating}
              open={() => openModal("order")}
            />
          )}
          {page === "products" && (
            <Products
              state={state}
              open={() => openModal("product")}
              edit={onEditProduct}
            />
          )}
          {page === "stock" && <Stock state={state} open={onStock} />}
          {page === "expenses" && (
            <Expenses
              state={state}
              mutate={mutate}
              busy={mutating}
              open={() => openModal("expense")}
            />
          )}
          {page === "employees" && (
            <Employees
              state={state}
              edit={onEditEmployee}
              open={() => openModal("employee")}
            />
          )}
          {page === "reports" && <Reports state={state} />}
          {page === "settings" && (
            <SettingsPage state={state} mutate={mutate} busy={mutating} />
          )}
          <footer className="page-footer">
            <span>Komagene · İşletme Paneli</span>
            <span>Veriler şubene özel, kontrol sende.</span>
          </footer>
        </main>
      </div>
      {modal === "order" && (
        <Modal
          title="Yeni sipariş"
          subtitle="Ürünleri seç, siparişi mutfağa ilet."
          close={closeModal}
          wide
        >
          <OrderForm
            state={state}
            mutate={mutate}
            busy={mutating}
            close={closeModal}
          />
        </Modal>
      )}
      {modal === "product" && (
        <Modal
          title={editProduct ? "Ürünü düzenle" : "Yeni ürün"}
          subtitle="Menünü ve satış fiyatlarını yönet."
          close={closeModal}
        >
          <ProductForm
            product={editProduct}
            mutate={mutate}
            busy={mutating}
            close={closeModal}
          />
        </Modal>
      )}
      {modal === "stock" && (
        <Modal
          title="Stok hareketi ekle"
          subtitle="Giriş ve sayım düzeltmelerini kayıt altına al."
          close={closeModal}
        >
          <StockForm
            state={state}
            productId={stockProduct}
            mutate={mutate}
            busy={mutating}
            close={closeModal}
          />
        </Modal>
      )}
      {modal === "expense" && (
        <Modal
          title="Gider ekle"
          subtitle="İşletme harcamalarını takip et."
          close={closeModal}
        >
          <ExpenseForm
            mutate={mutate}
            busy={mutating}
            close={closeModal}
            date={localDate()}
          />
        </Modal>
      )}
      {modal === "employee" && (
        <Modal
          title={editEmployee ? "Personeli düzenle" : "Personel ekle"}
          close={closeModal}
        >
          <EmployeeForm
            employee={editEmployee}
            mutate={mutate}
            busy={mutating}
            close={closeModal}
          />
        </Modal>
      )}
      {toast && (
        <div
          className={"toast" + (toast.error ? " error" : "")}
          role={toast.error ? "alert" : "status"}
        >
          <span className="toast-icon">
            {toast.error ? <X size={18} /> : <Check size={18} />}
          </span>
          {toast.message}
          <button
            className="icon-button"
            aria-label="Bildirimi kapat"
            onClick={() => setToast(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function Empty({
  title,
  message,
  children,
}: {
  title: string;
  message: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <ShoppingBag size={28} />
      </span>
      <h3>{title}</h3>
      <p>{message}</p>
      {children}
    </div>
  );
}
export function AddButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button className="btn primary" onClick={onClick}>
      <Plus size={18} />
      {children}
    </button>
  );
}
export function ExportButton() {
  return (
    <a href="/api/export" className="btn secondary" download>
      <ArrowDownToLine size={17} />
      Verileri indir
    </a>
  );
}
export function PaymentIcon() {
  return <CreditCard size={16} />;
}
