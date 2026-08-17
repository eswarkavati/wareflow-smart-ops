import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { Panel, EmptyState, StatusBadge } from "@/components/wf/ui";
import { Button } from "@/components/ui/button";
import { useWf } from "@/lib/wf/store";
import { operationsBrief, recommendations, type Recommendation } from "@/lib/wf/decisions";
import { stockStatus, bottleneck } from "@/lib/wf/engine";
import { cn } from "@/lib/utils";

const TONE_DOT = {
  green: "bg-success",
  amber: "bg-warning",
  red: "bg-destructive",
  blue: "bg-info",
  gray: "bg-muted-foreground/50",
} as const;

export function OpsBrief() {
  const { state } = useWf();
  const brief = operationsBrief(state);
  return (
    <section className="panel mb-4 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">Today's Operations Brief</h2>
        <StatusBadge value="Bangalore Hub" tone="gray" />
        <p className="ml-auto text-xs text-muted-foreground">{brief.headline}</p>
      </div>
      {brief.items.length ? (
        <ol className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {brief.items.map((i) => (
            <li key={i.text}>
              <Link to={i.to} className="group flex items-start gap-2 text-xs">
                <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", TONE_DOT[i.tone])} />
                <span className="font-medium text-muted-foreground">Priority {i.priority}</span>
                <span className="text-foreground group-hover:underline">{i.text}</span>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">All operating areas are within tolerance.</p>
      )}
    </section>
  );
}

export function RequiresAttention() {
  const { state } = useWf();
  const bn = bottleneck(state);
  const lowSkus = state.products.filter((p) => ["Low Stock", "Critical", "Out of Stock"].includes(stockStatus(p)));
  const critical = state.exceptions.filter((e) => e.status !== "Resolved").slice(0, 2);
  const riskOrders = state.orders
    .filter((o) => o.atRisk && o.stage !== "Dispatched")
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);

  const rows = [
    ...riskOrders.map((o) => ({
      tone: "red" as const,
      title: "Critical order",
      entity: o.id,
      detail: `${o.priority} · ${o.allocation === "Unallocated" ? "Inventory conflict" : o.stage} · ${o.customer}`,
      to: "/orders",
      cta: "View",
    })),
    ...(bn.worst.queue
      ? [
          {
            tone: "amber" as const,
            title: `${bn.worst.stage} bottleneck`,
            entity: bn.worst.stage === "Picking" ? "Zone C" : bn.worst.stage,
            detail: `${bn.worst.queue} pending tasks · ${bn.detail}`,
            to: "/analytics",
            cta: "View",
          },
        ]
      : []),
    ...(lowSkus.length
      ? [
          {
            tone: "amber" as const,
            title: "Inventory risk",
            entity: `${lowSkus.length} SKUs`,
            detail: "Below or approaching reorder threshold",
            to: "/replenishment",
            cta: "Resolve",
          },
        ]
      : []),
    ...critical.map((e) => ({
      tone: e.severity === "Critical" ? ("red" as const) : ("amber" as const),
      title: e.type,
      entity: e.orderId ?? e.sku ?? e.id,
      detail: e.problem,
      to: "/exceptions",
      cta: "Resolve",
    })),
  ];

  return (
    <Panel title="Requires Attention" description="Operational issues that need a decision now">
      {rows.length === 0 ? (
        <EmptyState title="All clear" hint="No unresolved operational issues." icon={<ShieldCheck className="h-6 w-6" />} />
      ) : (
        <div className="divide-y divide-border">
          {rows.map((r, i) => (
            <div key={`${r.title}-${r.entity}-${i}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className={cn("h-2 w-2 shrink-0 rounded-full", TONE_DOT[r.tone])} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {r.title} <span className="font-mono text-xs text-muted-foreground">· {r.entity}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">{r.detail}</p>
              </div>
              <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                <Link to={r.to}>{r.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const { acceptAllocation } = useWf();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [showWhatIf, setShowWhatIf] = useState(false);

  const accept = () => {
    if (!rec.execute) return;
    setBusy(true);
    window.setTimeout(() => {
      acceptAllocation(rec.execute!.orderId);
      setBusy(false);
      setDone(true);
    }, 450);
  };

  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-primary" />
        <span className="text-sm font-semibold">{rec.headline}</span>
        <span className="font-mono text-[11px] text-muted-foreground">{rec.entity}</span>
        <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
          Confidence
          <span className="tabular rounded bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
            {rec.confidence}%
          </span>
        </span>
      </div>

      <p className="mt-2 text-sm text-foreground">{rec.decision}</p>

      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Why</p>
          <ul className="mt-1 space-y-0.5">
            {rec.why.map((w) => (
              <li key={w} className="flex gap-1.5 text-xs text-muted-foreground">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60" />
                {w}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Impact</p>
          <p className="mt-1 text-xs text-muted-foreground">{rec.impact}</p>
        </div>
      </div>

      {showWhatIf ? (
        <div className="mt-3 rounded-md border border-dashed border-border bg-surface p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            What happens if you accept this?
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {rec.whatIf.map((w) => (
              <div key={w.label} className="flex items-center gap-2 rounded border border-border bg-card px-2 py-1.5">
                <span className={cn("h-1.5 w-1.5 rounded-full", TONE_DOT[w.tone])} />
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium">{w.label}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{w.outcome}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {rec.execute ? (
          <Button size="sm" className="h-8 text-xs" onClick={accept} disabled={busy || done}>
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : done ? <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> : null}
            {done ? "Decision executed" : "Accept Recommendation"}
          </Button>
        ) : (
          <Button asChild size="sm" className="h-8 text-xs">
            <Link to={rec.to}>Apply Decision</Link>
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setShowWhatIf((v) => !v)}>
          {showWhatIf ? "Hide simulation" : "What-if simulation"}
        </Button>
        <Button asChild size="sm" variant="ghost" className="h-8 text-xs">
          <Link to={rec.to}>
            View details <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export function DecisionConsole() {
  const { state } = useWf();
  const recs = recommendations(state);
  return (
    <Panel
      title="Recommended Actions"
      description="WAREFLOW Decision Engine — what to do next, why, and what it changes"
    >
      {recs.length === 0 ? (
        <EmptyState title="No decisions pending" hint="Operations are within tolerance across all zones." />
      ) : (
        <div className="space-y-3">
          {recs.map((r) => (
            <RecommendationCard key={r.id} rec={r} />
          ))}
        </div>
      )}
    </Panel>
  );
}
