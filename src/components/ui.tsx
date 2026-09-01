import type { ReactNode } from "react";
import type { Status } from "@/lib/types";

export function Card({ title, note, children, className = "" }: {
  title?: string; note?: string; children: ReactNode; className?: string;
}) {
  return (
    <section className={`rounded-lg border border-border bg-surface p-5 ${className}`}>
      {title && (
        <header className="mb-4">
          <h2 className="text-sm uppercase tracking-wide text-muted">{title}</h2>
          {note && <p className="mt-1 text-xs text-muted">{note}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Kpi({ label, value, note, tone = "default" }: {
  label: string; value: string; note?: string;
  tone?: "default" | "ok" | "warn" | "alert";
}) {
  const toneClass = {
    default: "text-foreground", ok: "text-ok", warn: "text-warn", alert: "text-alert",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`stat mt-2 text-3xl ${toneClass}`}>{value}</div>
      {note && <div className="mt-1 text-xs text-muted">{note}</div>}
    </div>
  );
}

const STATUS_TONE: Record<Status, string> = {
  "OK": "text-ok border-ok/40",
  "NO MOVEMENT": "text-warn border-warn/40",
  "STALLED": "text-alert border-alert/40",
  "No check-in": "text-muted border-border",
};

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-block rounded border px-2 py-0.5 text-xs whitespace-nowrap ${STATUS_TONE[status] ?? STATUS_TONE["No check-in"]}`}>
      {status}
    </span>
  );
}

export function Bar({ percent }: { percent: number | null }) {
  const pct = percent === null ? 0 : Math.max(0, Math.min(1, percent));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full min-w-16 overflow-hidden rounded-full bg-track">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct * 100}%` }} />
      </div>
      <span className="tnum w-12 shrink-0 text-right text-xs text-muted">
        {percent === null ? "—" : `${(pct * 100).toFixed(1)}%`}
      </span>
    </div>
  );
}
