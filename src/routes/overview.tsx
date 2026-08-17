import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/wf/AppShell";
import { OrderDrawer } from "@/components/wf/OrderDrawer";
import { EmptyState, Kpi, Panel, PageHeader, StatusBadge } from "@/components/wf/ui";
import { Button } from "@/components/ui/button";
import { useWf } from "@/lib/wf/store";
import { fmtTime, healthScore, minutesUntil, stageCounts, stockStatus } from "@/lib/wf/engine";

import { Blueprint } from "@/components/wf/Blueprint";
import { OverviewCharts } from "@/components/wf/OverviewCharts";
import { GateActivity } from "@/components/wf/GateActivity";
import { DecisionConsole, OpsBrief, RequiresAttention } from "@/components/wf/DecisionEngine";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/overview")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Control Tower — WAREFLOW" },
      { name: "description", content: "Live warehouse control tower: order flow, priority queue, alerts and health." },
      { property: "og:title", content: "Control Tower — WAREFLOW" },
      { property: "og:description", content: "Live warehouse control tower for fulfilment operations." },
    ],
  }),
  component: () => (
    <AppShell navKey="overview">
      <Overview />
    </AppShell>
  ),
});

function Overview() {
  const { state, setExceptionStatus } = useWf();
  const [open, setOpen] = useState<string | null>(null);

  const orders = state.orders;
  const today = orders.length;
  const pending = orders.filter((o) => o.stage !== "Dispatched").length;
  const atRisk = orders.filter((o) => o.atRisk && o.stage !== "Dispatched").length;
  const lowSkus = state.products.filter((p) => ["Low Stock", "Critical", "Out of Stock"].includes(stockStatus(p)))
    .length;
  const pickQueue = state.pickTasks.filter((t) => t.status !== "Completed").length;
  const dispatchDue = orders.filter((o) => o.stage === "QC" && o.qc === "Passed").length;
  const openExc = state.exceptions.filter((e) => e.status !== "Resolved").length;

  const flow = stageCounts(orders);
  const health = healthScore(state);

  const queue = [...orders]
    .filter((o) => o.stage !== "Dispatched")
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);



  return (
    <>
      <PageHeader
        eyebrow="Command"
        title="Warehouse Control Tower"
        subtitle="Bangalore Hub · Live warehouse operations"

        action={
          <Button asChild size="sm" variant="outline">
            <Link to="/allocation">Open Allocation Center</Link>
          </Button>
        }
      />

      <OpsBrief />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Orders Today" value={today} tone="blue" delta={8.4} to="/orders" />
        <Kpi label="Orders At Risk" value={atRisk} tone={atRisk ? "red" : "green"} delta={-2.1} to="/orders" />
        <Kpi label="Inventory Risk" value={`${lowSkus} SKUs`} tone={lowSkus > 5 ? "amber" : "green"} to="/replenishment" />
        <Kpi label="Active Picking" value={pickQueue} tone="blue" delta={5.2} to="/picking" />
        <Kpi label="Ready to Ship" value={dispatchDue} tone="amber" to="/shipping" />
        <Kpi label="Open Exceptions" value={openExc} tone={openExc ? "red" : "green"} to="/exceptions" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <DecisionConsole />

          <Panel title="Order flow" description="Volume currently sitting at each stage of fulfilment">

            <div className="flex flex-wrap items-stretch gap-2">
              {(
                [
                  ["Orders", flow.Created, "gray"],
                  ["Allocated", flow.Allocated, "blue"],
                  ["Picking", flow.Picking, "blue"],
                  ["Packing", flow.Packed, "blue"],
                  ["QC", flow.QC, "amber"],
                  ["Dispatch", flow.Dispatched, "green"],
                ] as const
              ).map(([label, count], i, arr) => (
                <div key={label} className="flex flex-1 items-center gap-2">
                  <div className="min-w-[92px] flex-1 rounded-md border border-border bg-surface px-3 py-2">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
                    <p className="tabular text-xl font-semibold">{count}</p>
                  </div>
                  {i < arr.length - 1 ? <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Priority queue"
            description="Highest scoring orders requiring an operational decision now"
            action={
              <Button asChild size="sm" variant="ghost">
                <Link to="/orders">All orders</Link>
              </Button>
            }
          >
            <div className="divide-y divide-border">
              {queue.map((o) => (
                <div key={o.id} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-[150px]">
                    <p className="text-sm font-medium">{o.id}</p>
                    <p className="text-xs text-muted-foreground">{o.customer}</p>
                  </div>
                  <StatusBadge value={o.priority} />
                  <span className="text-xs text-muted-foreground">{o.items.length} items</span>
                  <span className="tabular text-xs text-muted-foreground">
                    Promised {fmtTime(o.promisedAt)} · {minutesUntil(o.promisedAt)}m
                  </span>
                  <StatusBadge
                    value={o.allocation === "Unallocated" ? "Allocation Required" : o.stage}
                    tone={o.allocation === "Unallocated" ? "amber" : undefined}
                  />
                  <div className="ml-auto flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => setOpen(o.id)}>
                      View
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/allocation">Allocate</Link>
                    </Button>
                  </div>
                </div>
              ))}
              {queue.length === 0 ? <EmptyState title="Queue clear" hint="No orders require attention." /> : null}
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <RequiresAttention />

          <Panel title="Warehouse health">
            <div className="flex items-baseline gap-2">
              <span className="tabular text-4xl font-semibold">{health.score}</span>
              <span className="text-sm text-muted-foreground">/ 100</span>
              <StatusBadge className="ml-auto" value={health.label} />
            </div>
            <div className="mt-4 space-y-2">
              {health.parts.map((p) => (
                <div key={p.name} className="flex items-center gap-2">
                  <span className="w-20 text-xs text-muted-foreground">{p.name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        p.label === "Healthy" ? "bg-success" : p.label === "Warning" ? "bg-warning" : "bg-destructive",
                      )}
                      style={{ width: `${p.value}%` }}
                    />
                  </div>
                  <StatusBadge value={p.label} />
                </div>
              ))}
            </div>
          </Panel>


          <GateActivity />

          <Panel title="Critical exceptions">
            <div className="space-y-2">
              {state.exceptions
                .filter((e) => e.status === "Open")
                .slice(0, 3)
                .map((e) => (
                  <div key={e.id} className="rounded-md border border-border p-2.5">
                    <div className="flex items-center gap-2">
                      <StatusBadge value={e.severity} />
                      <span className="text-xs font-medium">{e.type}</span>
                      <span className="ml-auto font-mono text-[10px] text-muted-foreground">{e.orderId ?? e.sku}</span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">{e.problem}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 text-xs"
                      onClick={() => setExceptionStatus(e.id, "In Review")}
                    >
                      Take ownership
                    </Button>
                  </div>
                ))}
              {state.exceptions.filter((e) => e.status === "Open").length === 0 ? (
                <EmptyState title="No open exceptions" hint="Everything is running smoothly." />
              ) : null}
            </div>
          </Panel>
        </div>
      </div>

      <OverviewCharts />

      <div className="mt-4">
        <Blueprint />
      </div>

      <OrderDrawer orderId={open} onClose={() => setOpen(null)} />
    </>
  );
}
