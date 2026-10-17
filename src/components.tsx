import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { Period, State, Summary } from "./types";
import { integer, money, months, periodLabel, today } from "./types";

export function Button({
  children,
  onClick,
  variant = "",
  type = "button",
  disabled = false,
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      className={`button ${variant} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
export function AddButtons({
  open,
}: {
  open: (type: "income" | "expense") => void;
}) {
  return (
    <>
      <Button variant="secondary" onClick={() => open("expense")}>
        <Plus size={17} />
        Gider ekle
      </Button>
      <Button variant="primary" onClick={() => open("income")}>
        <Plus size={17} />
        Gelir ekle
      </Button>
    </>
  );
}
export function Heading({
  title,
  description,
  eyebrow,
  children,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        <p className="description">{description}</p>
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}
export function CardHeader({
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
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function Empty({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-symbol">
        <Search size={25} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {children}
    </div>
  );
}
export function SearchField({
  value,
  change,
  placeholder = "Açıklama, kişi veya belge ara…",
}: {
  value: string;
  change: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-input">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => change(e.target.value)}
      />
    </div>
  );
}
export function StatusBadge({
  paid,
  income = false,
}: {
  paid: boolean;
  income?: boolean;
}) {
  return (
    <span className={`badge ${paid ? "success" : "warning"}`}>
      <i />
      {paid ? (income ? "Tahsil edildi" : "Ödendi") : "Bekliyor"}
    </span>
  );
}
export function Modal({
  title,
  description,
  close,
  children,
  wide = false,
}: {
  title: string;
  description?: string;
  close: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () =>
      [
        ...(ref.current?.querySelectorAll<HTMLElement>(
          'button,input,select,textarea,a[href],[tabindex="0"]',
        ) || []),
      ].filter((e) => !e.hasAttribute("disabled") && e.getClientRects().length);
    focusable()[0]?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
      if (e.key === "Tab") {
        const list = focusable();
        if (e.shiftKey && document.activeElement === list[0]) {
          e.preventDefault();
          list.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === list.at(-1)) {
          e.preventDefault();
          list[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", key);
      old?.focus();
    };
  }, [close]);
  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="dialog-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button
            className="icon-button"
            aria-label="Pencereyi kapat"
            onClick={close}
          >
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`field ${wide ? "span-2" : ""}`}>
      {label}
      {children}
    </label>
  );
}
export function FormFooter({
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
      <Button variant="secondary" onClick={close}>
        Vazgeç
      </Button>
      <Button variant="primary" type="submit" disabled={busy}>
        <Check size={17} />
        {busy ? "Kaydediliyor…" : label}
      </Button>
    </div>
  );
}
export function PeriodPicker({
  period,
  change,
  state,
}: {
  period: Period;
  change: (period: Period) => void;
  state: State;
}) {
  const now = Number(today().slice(0, 4));
  const years = [
    ...new Set([
      now - 1,
      now,
      now + 1,
      period.year,
      ...state.entries.map((e) => Number(e.date.slice(0, 4))),
    ]),
  ].sort((a, b) => b - a);
  const move = (direction: number) => {
    if (period.mode === "month") {
      const d = new Date(
        Date.UTC(period.year, period.month - 1 + direction, 1),
      );
      if (d.getUTCFullYear() >= 2000 && d.getUTCFullYear() <= 2100)
        change({
          ...period,
          year: d.getUTCFullYear(),
          month: d.getUTCMonth() + 1,
        });
    } else if (period.mode === "year") {
      const year = period.year + direction;
      if (year >= 2000 && year <= 2100) change({ ...period, year });
    }
  };
  return (
    <div className="period-bar">
      <div className="period-title">
        <CalendarDays size={19} />
        <strong>{periodLabel(period)}</strong>
      </div>
      <div className="period-controls">
        <div className="segmented">
          {(
            [
              ["month", "Aylık"],
              ["year", "Yıllık"],
              ["custom", "Özel aralık"],
              ["all", "Tüm zamanlar"],
            ] as const
          ).map(([mode, label]) => (
            <button
              key={mode}
              className={period.mode === mode ? "active" : ""}
              onClick={() => change({ ...period, mode })}
            >
              {label}
            </button>
          ))}
        </div>
        {period.mode === "custom" ? (
          <div className="date-range">
            <input
              type="date"
              aria-label="Başlangıç tarihi"
              min="2000-01-01"
              max="2100-12-31"
              value={period.from}
              onChange={(e) =>
                change({ ...period, from: e.target.value || today() })
              }
            />
            <span>—</span>
            <input
              type="date"
              aria-label="Bitiş tarihi"
              min="2000-01-01"
              max="2100-12-31"
              value={period.to}
              onChange={(e) =>
                change({ ...period, to: e.target.value || today() })
              }
            />
          </div>
        ) : (
          period.mode !== "all" && (
            <div className="period-selects">
              <button
                className="icon-button"
                aria-label="Önceki dönem"
                onClick={() => move(-1)}
              >
                <ChevronLeft size={17} />
              </button>
              {period.mode === "month" && (
                <select
                  aria-label="Ay seç"
                  value={period.month}
                  onChange={(e) =>
                    change({ ...period, month: Number(e.target.value) })
                  }
                >
                  {months.map((m, i) => (
                    <option value={i + 1} key={m}>
                      {m}
                    </option>
                  ))}
                </select>
              )}
              <select
                aria-label="Yıl seç"
                value={period.year}
                onChange={(e) =>
                  change({ ...period, year: Number(e.target.value) })
                }
              >
                {years.map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
              <button
                className="icon-button"
                aria-label="Sonraki dönem"
                onClick={() => move(1)}
              >
                <ChevronRight size={17} />
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
export function Metrics({
  summary,
  previous,
  periodText,
}: {
  summary: Summary;
  previous?: Summary;
  periodText?: string;
}) {
  const items = [
    {
      key: "income",
      label: "Toplam gelir",
      value: summary.income,
      color: "green",
      icon: ArrowDownLeft,
      detail: "Tahsil edilen gelirler",
    },
    {
      key: "expense",
      label: "Toplam gider",
      value: summary.expense,
      color: "orange",
      icon: ArrowUpRight,
      detail: "Ödenen giderler",
    },
    {
      key: "balance",
      label: "Net fark",
      value: summary.balance,
      color: "blue",
      icon: Check,
      detail: "Gerçekleşen gelir − gider",
    },
    {
      key: "count",
      label: "Toplam kayıt",
      value: summary.count,
      color: "purple",
      icon: CalendarDays,
      detail: `${summary.paidCount} gerçekleşen · ${summary.count - summary.paidCount} bekleyen`,
    },
  ];
  return (
    <div className="metrics">
      {items.map((item) => {
        const prev = previous?.[item.key as keyof Summary];
        const diff =
          prev === undefined
            ? null
            : prev === 0
              ? item.value === 0
                ? 0
                : null
              : ((item.value - prev) / Math.abs(prev)) * 100;
        return (
          <article className="metric" key={item.key}>
            <div className="metric-top">
              <span>{item.label}</span>
              <span className={`metric-icon ${item.color}`}>
                <item.icon size={21} />
              </span>
            </div>
            <strong
              className={
                item.key === "balance" && item.value < 0 ? "negative" : ""
              }
            >
              {item.key === "count" ? integer(item.value) : money(item.value)}
            </strong>
            <div className="metric-detail">{item.detail}</div>
            {previous && item.key !== "count" && (
              <small className="comparison">
                {diff === null
                  ? "Önceki dönemde kayıt yok"
                  : `${diff >= 0 ? "+" : ""}${diff.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}% önceki döneme göre`}
              </small>
            )}
            {periodText && <small className="comparison">{periodText}</small>}
          </article>
        );
      })}
    </div>
  );
}
export function CsvButton({
  onClick,
  label = "CSV indir",
  disabled = false,
}: {
  onClick: () => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <Button variant="secondary" onClick={onClick} disabled={disabled}>
      <Download size={16} />
      {label}
    </Button>
  );
}
