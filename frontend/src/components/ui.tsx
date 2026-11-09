import type { ReactNode } from "react";

import { Icon, type IconName } from "./Icon";

/** A page's intro under the header (which holds the page's h1): an optional subtitle, a sentence, actions. */
export function PageHeader({ title, description, children }: { title?: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-header">
      <div className="page-heading">
        {title && <h2 className="page-title">{title}</h2>}
        {description && <p className="page-description">{description}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

interface CardProps {
  title?: ReactNode;
  icon?: IconName;
  /** Controls shown on the right of the title. */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** No inner padding, for tables and maps that reach the edges. */
  flush?: boolean;
  footer?: ReactNode;
  /** The heading level; sections inside a page use h2, nested ones h3. */
  level?: 2 | 3;
  labelledBy?: string;
}

export function Card({ title, icon, actions, children, className, flush, footer, level = 2, labelledBy }: CardProps) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <section className={`card${className ? ` ${className}` : ""}`} aria-labelledby={labelledBy}>
      {(title || actions) && (
        <div className="card-header">
          {title && (
            <Heading id={labelledBy}>
              {icon && <Icon name={icon} />}
              {title}
            </Heading>
          )}
          {actions}
        </div>
      )}
      <div className={`card-body${flush ? " flush" : ""}`}>{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </section>
  );
}

type NoticeTone = "info" | "success" | "warning" | "error";

const NOTICE_ICONS: Record<NoticeTone, IconName> = {
  info: "info",
  success: "check",
  warning: "alert",
  error: "alert",
};

interface NoticeProps {
  tone: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  /** "alert" interrupts screen readers (errors); "status" waits for a pause. */
  live?: "alert" | "status";
}

export function Notice({ tone, title, children, actions, live }: NoticeProps) {
  return (
    <div className={`notice ${tone}`} role={live}>
      <Icon name={NOTICE_ICONS[tone]} />
      <div className="notice-body">
        {title && <div className="notice-title">{title}</div>}
        {children && <div>{children}</div>}
        {actions && <div className="notice-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return <span className="spinner" role={label ? "status" : undefined} aria-label={label} />;
}

export function EmptyState({
  icon = "inbox",
  title,
  children,
  action,
  compact,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`state${compact ? " compact" : ""}`}>
      <div className="state-icon">
        <Icon name={icon} />
      </div>
      <div className="state-title">{title}</div>
      {children && <div className="state-text">{children}</div>}
      {action}
    </div>
  );
}

export function ErrorState({ title = "Could not load this", message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <div className="state error" role="alert">
      <div className="state-icon">
        <Icon name="wifiOff" />
      </div>
      <div className="state-title">{title}</div>
      <div className="state-text">{message}</div>
      {onRetry && (
        <button type="button" className="btn btn-secondary" onClick={onRetry}>
          <Icon name="refresh" size="sm" />
          Retry
        </button>
      )}
    </div>
  );
}

/** Grey placeholder blocks in the shape of the content being loaded. */
export function LoadingState({ rows = 3, height = 56, label = "Loading" }: { rows?: number; height?: number; label?: string }) {
  return (
    <div className="skeleton-stack" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="skeleton" style={{ height }} />
      ))}
    </div>
  );
}

/**
 * The state of polled data: a skeleton on first load, an error with Retry when nothing could be
 * loaded, a warning when what is shown may be out of date. Renders `children` once data exists.
 */
export function DataView<T>({
  data,
  error,
  onRetry,
  children,
  loading,
}: {
  data: T | undefined;
  error: string | null;
  onRetry: () => void;
  children: (data: T) => ReactNode;
  loading?: ReactNode;
}) {
  if (data === undefined) {
    return error ? <ErrorState message={error} onRetry={onRetry} /> : <>{loading ?? <LoadingState />}</>;
  }
  return (
    <>
      {error && <StaleNotice message={error} onRetry={onRetry} />}
      {children(data)}
    </>
  );
}

export function StaleNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Notice
      tone="warning"
      title="Connection problem — this data may be outdated"
      actions={
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          <Icon name="refresh" size="sm" />
          Retry now
        </button>
      }
    >
      {message}
    </Notice>
  );
}

export interface Segment<K extends string> {
  key: K;
  label: string;
  count?: number;
}

/** A row of mutually exclusive filter buttons. */
export function SegmentedControl<K extends string>({
  segments,
  value,
  onChange,
  label,
  block,
}: {
  segments: Segment<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
  block?: boolean;
}) {
  return (
    <div className={`segmented${block ? " block" : ""}`} role="group" aria-label={label}>
      {segments.map((segment) => (
        <button key={segment.key} type="button" aria-pressed={value === segment.key} onClick={() => onChange(segment.key)}>
          {segment.label}
          {segment.count !== undefined && <span className="seg-count">{segment.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Disclosure({ summary, icon, children, defaultOpen }: { summary: ReactNode; icon?: IconName; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="disclosure" open={defaultOpen}>
      <summary>
        {icon && <Icon name={icon} size="sm" />}
        {summary}
        <Icon name="chevronDown" size="sm" className="chevron" />
      </summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}

export function Pagination({ page, pageCount, total, pageSize, onPage }: { page: number; pageCount: number; total: number; pageSize: number; onPage: (page: number) => void }) {
  if (total <= pageSize) return null;
  const first = page * pageSize + 1;
  const last = Math.min(total, first + pageSize - 1);
  return (
    <nav className="pagination" aria-label="Pages">
      <span>
        {first}–{last} of {total}
      </span>
      <div className="pagination-buttons">
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onPage(page - 1)} disabled={page === 0}>
          <Icon name="chevronLeft" size="sm" />
          Previous
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => onPage(page + 1)} disabled={page >= pageCount - 1}>
          Next
          <Icon name="chevronRight" size="sm" />
        </button>
      </div>
    </nav>
  );
}

export interface TabItem<K extends string> {
  key: K;
  label: string;
  icon?: IconName;
}

/**
 * In-page tabs (WAI-ARIA tabs pattern): arrow keys move between tabs, the panel is labelled by
 * its tab. For tabs that are separate pages, use links styled with `.tab` instead.
 */
export function Tabs<K extends string>({
  tabs,
  value,
  onChange,
  label,
  idBase,
  children,
}: {
  tabs: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
  idBase: string;
  children: ReactNode;
}) {
  const move = (from: number, step: number) => {
    const next = tabs[(from + step + tabs.length) % tabs.length];
    if (!next) return;
    onChange(next.key);
    document.getElementById(`${idBase}-tab-${next.key}`)?.focus();
  };
  return (
    <>
      <div className="tabs" role="tablist" aria-label={label}>
        {tabs.map((tab, index) => (
          <button
            key={tab.key}
            id={`${idBase}-tab-${tab.key}`}
            type="button"
            role="tab"
            className="tab"
            aria-selected={value === tab.key}
            aria-controls={`${idBase}-panel`}
            tabIndex={value === tab.key ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") move(index, 1);
              else if (event.key === "ArrowLeft") move(index, -1);
            }}
          >
            {tab.icon && <Icon name={tab.icon} size="sm" />}
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${idBase}-panel`} aria-labelledby={`${idBase}-tab-${value}`} className="stack">
        {children}
      </div>
    </>
  );
}
