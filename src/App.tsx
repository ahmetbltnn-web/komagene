import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Store,
  Tags,
  Wallet,
  X,
} from "lucide-react";
import { api, ApiError } from "./api";
import { Button, Modal, PeriodPicker } from "./components";
import { CategoryForm, EntryForm } from "./forms";
import {
  Categories,
  Dashboard,
  Entries,
  Reports,
  SettingsPage,
} from "./finance";
import type {
  Category,
  Entry,
  EntryType,
  Mutation,
  Page,
  Period,
  Report,
  State,
} from "./types";
import { initialPeriod, range } from "./types";

type Auth = { initialized: boolean; user: { name: string } | null };
const menu = [
  { key: "dashboard", label: "Genel bakış", icon: LayoutDashboard },
  { key: "income", label: "Gelirler", icon: ArrowDownLeft },
  { key: "expense", label: "Giderler", icon: ArrowUpRight },
  { key: "entries", label: "Tüm hareketler", icon: ArrowLeftRight },
  { key: "reports", label: "Raporlar", icon: BarChart3 },
  { key: "categories", label: "Kategoriler", icon: Tags },
] as const;
const labels: Record<Page, string> = {
  dashboard: "Genel bakış",
  income: "Gelirler",
  expense: "Giderler",
  entries: "Tüm hareketler",
  reports: "Raporlar",
  categories: "Kategoriler",
  settings: "Ayarlar & yedekleme",
};
const hashPage = (): Page =>
  Object.hasOwn(labels, location.hash.slice(1))
    ? (location.hash.slice(1) as Page)
    : "dashboard";
function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        k<span>·</span>
      </span>
      <span>
        <strong>komagene</strong>
        <small>GELİR & GİDER PANELİ</small>
      </span>
    </div>
  );
}
function Login({
  auth,
  refresh,
}: {
  auth: Auth;
  refresh: () => Promise<void>;
}) {
  const setup = !auth.initialized;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const f = new FormData(event.currentTarget);
    try {
      await api(
        setup ? "/setup" : "/login",
        "POST",
        setup
          ? {
              name: f.get("name"),
              branchName: f.get("branchName"),
              password: f.get("password"),
              withDemo: f.get("demo") === "on",
            }
          : { password: f.get("password") },
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bağlantı kurulamadı.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div className="auth-intro">
          <span className="auth-tag">
            <span />
            Finansal kontrol, tek bir yerde.
          </span>
          <h1>
            İşletmenin hesabı,
            <br />
            <em>artık çok daha net.</em>
          </h1>
          <p>
            Ne kazandığını, nereye harcadığını ve ay sonunda
            <br />
            nerede durduğunu kolayca gör.
          </p>
          <div className="auth-preview">
            <div>
              <span className="metric-icon green">
                <ArrowDownLeft size={22} />
              </span>
              <small>GELİRLERİN</small>
              <strong>Her tahsilat kayıtlı.</strong>
            </div>
            <div>
              <span className="metric-icon orange">
                <ArrowUpRight size={22} />
              </span>
              <small>GİDERLERİN</small>
              <strong>Her harcama görünür.</strong>
            </div>
            <div>
              <span className="metric-icon blue">
                <BarChart3 size={22} />
              </span>
              <small>RAPORLARIN</small>
              <strong>Aydan yıla, tüm tablo.</strong>
            </div>
          </div>
        </div>
        <p className="auth-foot">
          Tek şubeye özel · Türk lirası · Kalıcı kayıt
        </p>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <span className="login-symbol">
            <Wallet size={27} />
          </span>
          <p className="eyebrow">SADECE İŞLETMENİN FİNANSI</p>
          <h2>{setup ? "Hesabını birlikte açalım." : "Tekrar hoş geldin."}</h2>
          <p className="description">
            {setup
              ? "İşletmeni tanımla, gelir ve giderlerini takip etmeye başla."
              : "Gelir ve giderlerinin güncel durumuna göz at."}
          </p>
          <form className="form-stack" onSubmit={submit}>
            {setup && (
              <>
                <label className="field">
                  Adın soyadın
                  <input
                    name="name"
                    required
                    maxLength={100}
                    autoComplete="name"
                    placeholder="Ad Soyad"
                  />
                </label>
                <label className="field">
                  İşletme / şube adı
                  <input
                    name="branchName"
                    required
                    maxLength={100}
                    placeholder="Örn. Komagene Merkez Şubesi"
                  />
                </label>
              </>
            )}
            <label className="field">
              Yönetici şifresi
              <div className="password-input">
                <input
                  name="password"
                  type={visible ? "text" : "password"}
                  minLength={setup ? 10 : undefined}
                  maxLength={200}
                  required
                  autoComplete={setup ? "new-password" : "current-password"}
                  placeholder={setup ? "En az 10 karakter" : "Şifreni gir"}
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label="Şifre görünürlüğünü değiştir"
                  onClick={() => setVisible(!visible)}
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            {setup && (
              <label className="checkbox">
                <input type="checkbox" name="demo" />
                <span>
                  Örnek gelir-gider verileri ekle
                  <small>
                    Denemek için bu ve önceki yıldan örnek kayıtlar ekler.
                    Gerçek kullanım için boş bırak.
                  </small>
                </span>
              </label>
            )}
            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}
            <Button variant="primary full" type="submit" disabled={busy}>
              {busy
                ? "Hazırlanıyor…"
                : setup
                  ? "Panelimi oluştur"
                  : "Giriş yap"}
              <ArrowRight size={17} />
            </Button>
          </form>
          <p className="auth-secure">
            <ShieldCheck size={15} />
            Şifre korumalı erişim · Verilerin seninle
          </p>
        </div>
      </section>
    </div>
  );
}
export default function App() {
  const [auth, setAuth] = useState<Auth | null>(null),
    [state, setState] = useState<State | null>(null);
  const [page, setPage] = useState<Page>(hashPage);
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [mobile, setMobile] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [reportError, setReportError] = useState("");
  const [loadingError, setLoadingError] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; error: boolean } | null>(
    null,
  );
  const [modal, setModal] = useState<
    | { kind: "entry"; type: EntryType; entry?: Entry }
    | { kind: "category"; type: EntryType; category?: Category }
    | null
  >(null);
  const lock = useRef(false),
    version = useRef(0);
  const close = useCallback(() => setModal(null), []);
  const refresh = useCallback(async () => {
    const a = await api<Auth>("/auth");
    setAuth(a);
    if (a.user) setState(await api<State>("/state"));
    else setState(null);
    setLoadingError("");
  }, []);
  useEffect(() => {
    refresh().catch((e) => setLoadingError(e.message));
  }, [refresh]);
  useEffect(() => {
    const change = () => {
      setPage(hashPage());
      setMobile(false);
    };
    addEventListener("hashchange", change);
    return () => removeEventListener("hashchange", change);
  }, []);
  useEffect(() => {
    document.title = `${labels[page]} · Komagene Finans`;
  }, [page]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  const from = range(period).from,
    to = range(period).to;
  useEffect(() => {
    if (!state) return;
    let active = true;
    setReportError("");
    if (from > to) {
      setReportError("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
      return;
    }
    api<Report>(`/reports?from=${from}&to=${to}`)
      .then((value) => {
        if (active) setReport(value);
      })
      .catch((e) => {
        if (active) setReportError(e.message);
      });
    return () => {
      active = false;
    };
  }, [from, to, state]);
  useEffect(() => {
    if (!auth?.user) return;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible" || lock.current) return;
      const before = version.current;
      api<State>("/state")
        .then((next) => {
          if (!lock.current && before === version.current) setState(next);
        })
        .catch((e) => {
          if (e instanceof ApiError && e.status === 401) {
            setAuth({ initialized: true, user: null });
            setState(null);
            setModal(null);
          }
        });
    }, 60000);
    return () => clearInterval(timer);
  }, [auth?.user]);
  const mutate: Mutation = async (path, body, method = "POST") => {
    if (lock.current) return false;
    lock.current = true;
    version.current++;
    setBusy(true);
    try {
      await api(path, method, body);
      try {
        setState(await api<State>("/state"));
      } catch {
        setToast({
          text: "İşlem kaydedildi. Güncel veriler için sayfayı yenileyin.",
          error: true,
        });
        return true;
      }
      setToast({ text: "İşlem başarıyla kaydedildi.", error: false });
      return true;
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setAuth({ initialized: true, user: null });
        setState(null);
        setModal(null);
      }
      setToast({
        text: e instanceof Error ? e.message : "İşlem tamamlanamadı.",
        error: true,
      });
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const navigate = (next: Page) => {
    location.hash = next;
    setPage(next);
    setMobile(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const open = (type: EntryType, entry?: Entry) =>
    setModal({ kind: "entry", type, entry });
  async function logout() {
    try {
      await api("/logout", "POST");
      setAuth({ initialized: true, user: null });
      setState(null);
      setModal(null);
    } catch (e) {
      setToast({
        text: e instanceof Error ? e.message : "Çıkış yapılamadı.",
        error: true,
      });
    }
  }
  if (loadingError && !state)
    return (
      <div className="loading-screen">
        <Wallet size={34} />
        <h2>Panele bağlanılamadı</h2>
        <p>{loadingError}</p>
        <Button
          variant="primary"
          onClick={() => refresh().catch((e) => setLoadingError(e.message))}
        >
          Yeniden dene
        </Button>
      </div>
    );
  if (!auth)
    return (
      <div className="loading-screen">
        <span className="spinner" />
        <p>Finans paneli hazırlanıyor…</p>
      </div>
    );
  if (!auth.user) return <Login auth={auth} refresh={refresh} />;
  if (!state)
    return (
      <div className="loading-screen">
        <span className="spinner" />
        <p>Kayıtlar yükleniyor…</p>
      </div>
    );
  const showPeriod = !["settings", "categories"].includes(page);
  const pending = state.entries.filter((e) => e.status === "pending").length;
  return (
    <div className="app-layout">
      {mobile && (
        <button
          className="mobile-overlay"
          aria-label="Menüyü kapat"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <Brand />
        <div className="business">
          <span>
            <Store size={19} />
          </span>
          <div>
            <strong>{state.settings.branchName}</strong>
            <small>İşletme hesabı · TRY</small>
          </div>
        </div>
        <p className="nav-label">FİNANS YÖNETİMİ</p>
        <nav aria-label="Ana menü">
          {menu.map((item) => (
            <a
              key={item.key}
              className={`nav-link ${page === item.key ? "active" : ""}`}
              href={"#" + item.key}
              aria-current={page === item.key ? "page" : undefined}
              onClick={() => navigate(item.key)}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
              {item.key === "entries" && pending > 0 && (
                <small aria-hidden="true">{pending}</small>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <BarChart3 size={25} />
            <strong>Her rakamın bir hikâyesi var.</strong>
            <p>Aylık ve yıllık raporlarınla işletmenin yönünü gör.</p>
            <button onClick={() => navigate("reports")}>
              Raporları incele <ArrowRight size={14} />
            </button>
          </div>
          <a
            className={`nav-link ${page === "settings" ? "active" : ""}`}
            href="#settings"
            onClick={() => navigate("settings")}
          >
            <Settings size={19} />
            <span>Ayarlar & yedekleme</span>
          </a>
          <button className="nav-link" onClick={logout}>
            <LogOut size={19} />
            <span>Güvenli çıkış</span>
          </button>
          <div className="sidebar-version">
            <span />
            Gelir & Gider Paneli <small>v2.0</small>
          </div>
        </div>
      </aside>
      <div className="main-layout">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobile(true)}
              aria-label="Menüyü aç"
            >
              <Menu size={21} />
            </button>
            <span>İşletmem</span>
            <i>/</i>
            <strong>{labels[page]}</strong>
          </div>
          <div className="topbar-right">
            <span className="private-badge">
              <ShieldCheck size={15} />
              İşletmene özel
            </span>
            <span className="topbar-divider" />
            <button className="profile" onClick={() => navigate("settings")}>
              <span className="avatar">
                {state.settings.ownerName
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <span>
                <strong>{state.settings.ownerName}</strong>
                <small>İşletme yöneticisi</small>
              </span>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>
        <main className="content" id="main-content">
          {state.settings.demoData && (
            <div className="demo-banner">
              <span>ÖRNEK VERİ</span>Bu işletme örnek kayıtlar içeriyor.
              Raporlar bu kayıtları da kapsar.
            </div>
          )}
          {showPeriod && (
            <PeriodPicker
              period={period}
              change={(value) => {
                setReport(null);
                setPeriod(value);
              }}
              state={state}
            />
          )}
          <div className="print-heading">
            <h1>{state.settings.branchName} · Finans raporu</h1>
            <p>
              {from} / {to} · Türk lirası
            </p>
          </div>
          {reportError && showPeriod && (
            <div className="error-message" role="alert">
              {reportError}
            </div>
          )}
          {showPeriod && !report && !reportError && (
            <div className="report-loading">
              <span className="spinner" />
              Dönem verileri hazırlanıyor…
            </div>
          )}
          {report && page === "dashboard" && (
            <Dashboard
              state={state}
              report={report}
              period={period}
              open={open}
              navigate={navigate}
            />
          )}
          {report && ["income", "expense", "entries"].includes(page) && (
            <Entries
              key={page}
              state={state}
              report={report}
              page={page as "income" | "expense" | "entries"}
              open={open}
              mutate={mutate}
              busy={busy}
            />
          )}
          {report && page === "reports" && (
            <Reports state={state} report={report} period={period} />
          )}{" "}
          {page === "categories" && (
            <Categories
              state={state}
              mutate={mutate}
              busy={busy}
              edit={(type, category) =>
                setModal({ kind: "category", type, category })
              }
            />
          )}{" "}
          {page === "settings" && (
            <SettingsPage state={state} mutate={mutate} busy={busy} />
          )}
          <footer className="page-footer">
            <span>Komagene · Gelir & Gider Paneli</span>
            <span>Rakamlar net, kontrol sende.</span>
          </footer>
        </main>
      </div>
      {modal?.kind === "entry" && (
        <Modal
          title={
            modal.entry
              ? "Kaydı düzenle"
              : modal.type === "income"
                ? "Gelir ekle"
                : "Gider ekle"
          }
          description="İşletmenin finansal hareketini kayıt altına al."
          close={close}
        >
          <EntryForm
            state={state}
            entry={modal.entry}
            type={modal.type}
            mutate={mutate}
            busy={busy}
            close={close}
          />
        </Modal>
      )}
      {modal?.kind === "category" && (
        <Modal
          title={modal.category ? "Kategoriyi düzenle" : "Yeni kategori"}
          close={close}
        >
          <CategoryForm
            category={modal.category}
            type={modal.type}
            mutate={mutate}
            busy={busy}
            close={close}
          />
        </Modal>
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          {toast.error ? <X size={19} /> : <Check size={19} />}
          <span>{toast.text}</span>
          <button aria-label="Bildirimi kapat" onClick={() => setToast(null)}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
