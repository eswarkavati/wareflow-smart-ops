import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";


const TONES = {
  green: "bg-success/10 text-success border-success/25",
  amber: "bg-warning/15 text-[color:oklch(0.45_0.11_70)] border-warning/35",
  red: "bg-destructive/10 text-destructive border-destructive/25",
  blue: "bg-info/10 text-info border-info/25",
  gray: "bg-muted text-muted-foreground border-border",
} as const;

export type Tone = keyof typeof TONES;

const MAP: Record<string, Tone> = {
  Healthy: "green",
  Completed: "green",
  "In Stock": "green",
  Dispatched: "green",
  Passed: "green",
  Resolved: "green",
  Active: "green",
  Allocated: "green",
  Approved: "green",
  Received: "green",
  Warning: "amber",
  "Low Stock": "amber",
  Delayed: "amber",
  Pending: "amber",
  Partial: "amber",
  "Needs Review": "amber",
  Backorder: "amber",
  "On Break": "amber",
  HIGH: "amber",
  Requested: "amber",
  Overstock: "amber",
  Critical: "red",
  CRITICAL: "red",
  "Out of Stock": "red",
  Damaged: "red",
  Failed: "red",
  Blocked: "red",
  Open: "red",
  Processing: "blue",
  Picking: "blue",
  Packing: "blue",
  Packed: "blue",
  "In Transit": "blue",
  QC: "blue",
  "In Review": "blue",
  Created: "blue",
  NORMAL: "blue",
  Inactive: "gray",
  Archived: "gray",
  LOW: "gray",
  Unallocated: "gray",
};

export function StatusBadge({
  value,
  tone,
  className,
}: {
  value: string;
  tone?: Tone | undefined;
  className?: string | undefined;
}) {
  const t = tone ?? MAP[value] ?? "gray";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-wide",
        TONES[t],
        className,
      )}
    >
      {value}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string | undefined;
  title: string;
  subtitle?: string | undefined;
  action?: ReactNode | undefined;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? (
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">{eyebrow}</p>
        ) : null}
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}


export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string | undefined;
  description?: string | undefined;
  action?: ReactNode | undefined;
  children: ReactNode;
  className?: string | undefined;
  bodyClassName?: string | undefined;
}) {
  return (
    <section className={cn("panel", className)}>
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action}
        </header>
      ) : null}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function EmptyState({
  title,
  hint,
  icon,
}: {
  title: string;
  hint?: string | undefined;
  icon?: ReactNode | undefined;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border py-12 text-center">
      {icon ? <div className="text-muted-foreground">{icon}</div> : null}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {hint ? <p className="max-w-sm text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone = "gray",
  delta,
  to,
}: {
  label: string;
  value: string | number;
  hint?: string | undefined;
  tone?: Tone | undefined;
  delta?: number | undefined;
  to?: string | undefined;
}) {
  const bar = {
    green: "bg-success",
    amber: "bg-warning",
    red: "bg-destructive",
    blue: "bg-info",
    gray: "bg-muted-foreground/40",
  }[tone];
  const body = (
    <>
      <span className={cn("absolute inset-y-0 left-0 w-[3px]", bar)} />
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold leading-none text-foreground">{value}</p>
      {delta !== undefined ? (
        <p
          className={cn(
            "tabular mt-1.5 text-[11px] font-medium",
            delta >= 0 ? "text-success" : "text-destructive",
          )}
        >
          {delta >= 0 ? "↑" : "↓"} {Math.abs(delta).toFixed(1)}% vs yesterday
        </p>
      ) : null}
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </>
  );
  if (to)
    return (
      <Link
        to={to}
        className="panel relative block overflow-hidden px-4 py-3 transition-colors hover:border-primary/40 hover:bg-accent/40"
      >
        {body}
      </Link>
    );
  return <div className="panel relative overflow-hidden px-4 py-3">{body}</div>;
}


export function Meta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-0.5 truncate text-sm text-foreground">{value}</div>
    </div>
  );
}

export function TableShell({ children }: { children: ReactNode }) {
  return (
    <div className="panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-sm">{children}</table>
      </div>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "border-b border-border bg-surface px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("border-b border-border/70 px-3 py-2 align-middle", className)}>{children}</td>;
}
