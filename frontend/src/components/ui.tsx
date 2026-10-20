import type { ReactNode } from "react";

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

export function Panel({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`panel${className ? ` ${className}` : ""}`}>
      {title && <h2>{title}</h2>}
      {children}
    </section>
  );
}

/** Loading, error and empty states for polled data. */
export function DataState({ error, loading, empty }: { error: string | null; loading: boolean; empty?: string }) {
  if (error) return <div className="notice error">{error}</div>;
  if (loading) return <div className="muted">Loading…</div>;
  if (empty) return <div className="empty">{empty}</div>;
  return null;
}

export function StatTile({ label, value, tone }: { label: string; value: ReactNode; tone?: "danger" | "warning" }) {
  return (
    <div className={`stat-tile${tone ? ` ${tone}` : ""}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
