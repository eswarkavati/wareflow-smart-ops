import { Check, CircleDot } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Meta, StatusBadge } from "@/components/wf/ui";
import { fmtTime, inr, minutesUntil } from "@/lib/wf/engine";
import { useWf } from "@/lib/wf/store";
import type { Order } from "@/lib/wf/types";
import { cn } from "@/lib/utils";

const STAGES = ["Created", "Prioritized", "Allocated", "Picking", "Packed", "QC", "Dispatched"] as const;

export function OrderTimeline({ order }: { order: Order }) {
  const idx = Math.max(
    1,
    STAGES.indexOf(order.stage === "Created" ? "Prioritized" : (order.stage as (typeof STAGES)[number])),
  );
  return (
    <ol className="flex flex-wrap gap-x-1 gap-y-2">
      {STAGES.map((s, i) => {
        const done = i <= idx;
        return (
          <li key={s} className="flex items-center gap-1">
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                done ? "border-success/40 bg-success/10 text-success" : "border-border text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3 w-3" /> : <CircleDot className="h-3 w-3" />}
            </span>
            <span className={cn("text-[11px]", done ? "text-foreground" : "text-muted-foreground")}>{s}</span>
            {i < STAGES.length - 1 ? <span className="mx-0.5 h-px w-3 bg-border" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function PriorityExplain({ order }: { order: Order }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Why this order is {order.priority}</p>
        <span className="tabular text-xs text-muted-foreground">Score {order.score}/100</span>
      </div>
      <ul className="mt-2 space-y-1">
        {order.reasons.map((r) => (
          <li key={r} className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-info" />
            {r}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function OrderDrawer({
  orderId,
  onClose,
}: {
  orderId: string | null;
  onClose: () => void;
}) {
  const { state, acceptAllocation, completePacking, runQc, dispatchOrder } = useWf();
  const order = state.orders.find((o) => o.id === orderId) ?? null;

  return (
    <Sheet open={!!order} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
        {order ? (
          <>
            <SheetHeader className="border-b border-border">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-base">{order.id}</SheetTitle>
                <StatusBadge value={order.priority} />
                <StatusBadge value={order.stage} />
                {order.atRisk ? <StatusBadge value="Delayed" /> : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {order.customer} · {order.city} · {inr(order.value)} · {order.shipping} · {order.customerTier}
              </p>
            </SheetHeader>

            <div className="space-y-5 p-4">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Fulfilment timeline
                </p>
                <OrderTimeline order={order} />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Meta label="Promised" value={`${fmtTime(order.promisedAt)} (${minutesUntil(order.promisedAt)}m)`} />
                <Meta label="Allocation" value={<StatusBadge value={order.allocation} />} />
                <Meta label="QC" value={order.qc ? <StatusBadge value={order.qc} /> : "—"} />
                <Meta label="Carrier" value={order.tracking ? `${order.carrier} · ${order.tracking}` : order.carrier} />
              </div>

              <PriorityExplain order={order} />

              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Items & availability
                </p>
                <div className="overflow-hidden rounded-md border border-border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-surface text-left text-muted-foreground">
                        <th className="px-2.5 py-1.5 font-medium">Product</th>
                        <th className="px-2.5 py-1.5 font-medium">Qty</th>
                        <th className="px-2.5 py-1.5 font-medium">Allocated</th>
                        <th className="px-2.5 py-1.5 font-medium">Picked</th>
                        <th className="px-2.5 py-1.5 font-medium">On hand</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((it) => {
                        const p = state.products.find((x) => x.sku === it.sku);
                        return (
                          <tr key={it.sku} className="border-t border-border/70">
                            <td className="px-2.5 py-1.5">
                              <span className="block">{it.name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">{it.sku}</span>
                            </td>
                            <td className="tabular px-2.5 py-1.5">{it.qty}</td>
                            <td className="tabular px-2.5 py-1.5">{it.allocated}</td>
                            <td className="tabular px-2.5 py-1.5">{it.picked}</td>
                            <td
                              className={cn(
                                "tabular px-2.5 py-1.5",
                                (p?.available ?? 0) < it.qty - it.allocated && "text-destructive",
                              )}
                            >
                              {p?.available ?? 0}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                {order.allocation === "Unallocated" ? (
                  <Button size="sm" onClick={() => acceptAllocation(order.id)}>
                    Allocate stock
                  </Button>
                ) : null}
                {order.stage === "Packed" ? (
                  <Button size="sm" onClick={() => completePacking(order.id)}>
                    Complete packing
                  </Button>
                ) : null}
                {order.stage === "QC" && order.qc !== "Passed" ? (
                  <>
                    <Button size="sm" onClick={() => runQc(order.id, "Passed")}>
                      Pass QC
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => runQc(order.id, "Failed")}>
                      Fail QC
                    </Button>
                  </>
                ) : null}
                {order.stage === "QC" && order.qc === "Passed" ? (
                  <Button size="sm" onClick={() => dispatchOrder(order.id)}>
                    Mark as dispatched
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={onClose}>
                  Close
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
