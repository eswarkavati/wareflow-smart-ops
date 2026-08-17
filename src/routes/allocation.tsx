import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/wf/AppShell";
import { PriorityExplain } from "@/components/wf/OrderDrawer";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/wf/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useWf } from "@/lib/wf/store";
import { allocationPlan, fmtTime, minutesUntil } from "@/lib/wf/engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/allocation")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Allocation Center — WAREFLOW" },
      {
        name: "description",
        content: "Resolve inventory conflicts with explainable allocation recommendations and confidence scoring.",
      },
      { property: "og:title", content: "Allocation Center — WAREFLOW" },
      { property: "og:description", content: "Decide how scarce inventory is split across competing orders." },
    ],
  }),
  component: () => (
    <AppShell navKey="allocation">
      <Allocation />
    </AppShell>
  ),
});

function Allocation() {
  const { state, acceptAllocation, backorder, setExceptionStatus } = useWf();
  const pending = useMemo(
    () =>
      state.orders
        .filter((o) => o.allocation === "Unallocated" || o.allocation === "Partial")
        .sort((a, b) => b.score - a.score),
    [state.orders],
  );
  const [selected, setSelected] = useState<string | null>(pending[0]?.id ?? null);
  const order = state.orders.find((o) => o.id === (selected ?? pending[0]?.id)) ?? null;
  const plan = order ? allocationPlan(order, state) : null;
  const [modify, setModify] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  const [confirm, setConfirm] = useState(false);

  if (pending.length === 0 || !order || !plan) {
    return (
      <>
        <PageHeader title="Allocation Center" subtitle="Decision workspace for scarce inventory" />
        <EmptyState
          title="No orders awaiting allocation"
          hint="Every open order has reserved stock. New orders will appear here automatically."
          icon={<CheckCircle2 className="h-6 w-6 text-success" />}
        />
      </>
    );
  }

  const conflict = plan.lines.some((l) => l.backorder > 0);

  return (
    <>
      <PageHeader
        title="Allocation Center"
        subtitle={`${pending.length} orders awaiting an allocation decision`}
      />

      <div className="grid gap-4 xl:grid-cols-[300px_1fr]">
        <Panel title="Awaiting allocation" bodyClassName="p-0">
          <div className="max-h-[70vh] divide-y divide-border overflow-y-auto">
            {pending.map((o) => (
              <button
                key={o.id}
                onClick={() => {
                  setSelected(o.id);
                  setOverrides({});
                  setModify(false);
                }}
                className={cn(
                  "w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
                  o.id === order.id && "bg-info/5 border-l-2 border-l-info",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{o.id}</span>
                  <StatusBadge className="ml-auto" value={o.priority} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {o.customer} · {o.items.reduce((n, i) => n + i.qty, 0)} units
                </p>
                <p className="tabular mt-0.5 text-[11px] text-muted-foreground">
                  Promised {fmtTime(o.promisedAt)} · {minutesUntil(o.promisedAt)}m
                </p>
              </button>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          {conflict ? (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
              <div>
                <p className="text-sm font-semibold text-destructive">Inventory conflict detected</p>
                <p className="text-xs text-muted-foreground">
                  {order.id} cannot be fulfilled in full from on-hand stock. WAREFLOW has produced a split
                  recommendation below.
                </p>
              </div>
            </div>
          ) : null}

          <Panel
            title={`Recommended decision · ${order.id}`}
            description={plan.rationale[0]}
            action={
              <span className="flex items-center gap-1.5 rounded-md border border-info/30 bg-info/10 px-2 py-1 text-xs font-medium text-info">
                <Sparkles className="h-3.5 w-3.5" />
                Confidence {plan.confidence}%
              </span>
            }
          >
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-3 py-2 font-semibold">SKU / product</th>
                    <th className="px-3 py-2 font-semibold">Required</th>
                    <th className="px-3 py-2 font-semibold">Available</th>
                    <th className="px-3 py-2 font-semibold">Allocate</th>
                    <th className="px-3 py-2 font-semibold">Backorder</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.lines.map((l) => (
                    <tr key={l.sku} className="border-t border-border/70">
                      <td className="px-3 py-2">
                        <span className="block">{l.name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{l.sku}</span>
                      </td>
                      <td className="tabular px-3 py-2">{l.required}</td>
                      <td className={cn("tabular px-3 py-2", l.available < l.required && "text-destructive")}>
                        {l.available}
                      </td>
                      <td className="tabular px-3 py-2">
                        {modify ? (
                          <Input
                            type="number"
                            min={0}
                            max={Math.min(l.required, l.available)}
                            value={overrides[l.sku] ?? l.allocate}
                            onChange={(e) =>
                              setOverrides((o) => ({ ...o, [l.sku]: Math.max(0, Number(e.target.value)) }))
                            }
                            className="h-7 w-20 text-xs"
                          />
                        ) : (
                          <span className="font-semibold">{l.allocate}</span>
                        )}
                      </td>
                      <td className={cn("tabular px-3 py-2", l.backorder > 0 && "text-warning")}>{l.backorder}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-md border border-border bg-surface p-3">
                <p className="text-xs font-semibold">Reasoning</p>
                <ul className="mt-2 space-y-1">
                  {plan.rationale.map((r) => (
                    <li key={r} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-info" />
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
              <PriorityExplain order={order} />
            </div>

            {plan.competing.length ? (
              <div className="mt-4 rounded-md border border-warning/30 bg-warning/5 p-3">
                <p className="text-xs font-semibold">Competing demand</p>
                <div className="mt-2 space-y-1">
                  {plan.competing.map((c) => (
                    <div key={`${c.orderId}-${c.sku}`} className="flex items-center gap-2 text-xs">
                      <span className="font-medium">{c.orderId}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{c.sku}</span>
                      <span className="text-muted-foreground">needs {c.qty}</span>
                      <StatusBadge className="ml-auto" value={c.priority} />
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  These orders will be re-queued after this decision and can absorb the delay based on their SLA.
                </p>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
              <Button onClick={() => setConfirm(true)}>Accept recommendation</Button>
              <Button variant="outline" onClick={() => setModify((v) => !v)}>
                {modify ? "Cancel modification" : "Modify allocation"}
              </Button>
              {modify ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    acceptAllocation(order.id, overrides);
                    setModify(false);
                    setOverrides({});
                    setSelected(null);
                  }}
                >
                  Apply modified split
                </Button>
              ) : null}
              <Button
                variant="outline"
                onClick={() => {
                  backorder(order.id);
                  setSelected(null);
                }}
              >
                Backorder
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  const exc = state.exceptions.find((e) => e.orderId === order.id && e.status !== "Resolved");
                  if (exc) setExceptionStatus(exc.id, "In Review");
                }}
              >
                Escalate
              </Button>
            </div>
          </Panel>
        </div>
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply allocation to {order.id}?</AlertDialogTitle>
            <AlertDialogDescription>
              {plan.lines
                .filter((l) => l.allocate > 0)
                .map((l) => `${l.allocate} × ${l.name}`)
                .join(", ") || "No stock available"}{" "}
              will be reserved. Inventory, order status, pick tasks and the audit log will be updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                acceptAllocation(order.id);
                setSelected(null);
              }}
            >
              Accept recommendation
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
