import { useState } from "react";
import { Truck } from "lucide-react";
import { EmptyState, Kpi, Meta, Panel, StatusBadge, TableShell, Td, Th } from "@/components/wf/ui";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useWf } from "@/lib/wf/store";
import { fmtTime, minutesUntil } from "@/lib/wf/engine";
import { cn } from "@/lib/utils";

export function DispatchPanel() {
  const { state, dispatchOrder } = useWf();
  const ready = state.orders.filter((o) => o.stage === "QC" && o.qc === "Passed");
  const packed = state.orders.filter((o) => o.stage === "Packed" || (o.stage === "QC" && o.qc !== "Passed"));
  const dispatched = state.orders.filter((o) => o.stage === "Dispatched");
  const delayed = state.orders.filter((o) => o.stage !== "Dispatched" && minutesUntil(o.promisedAt) < 0);
  const [sel, setSel] = useState<string | null>(null);
  const order = state.orders.find((o) => o.id === sel) ?? null;

  const rows = [...ready, ...packed, ...dispatched.slice(0, 10)];

  return (
    <>
      

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Ready to dispatch" value={ready.length} tone={ready.length ? "amber" : "green"} />
        <Kpi label="Awaiting QC" value={packed.length} tone="blue" />
        <Kpi label="Dispatched" value={dispatched.length} tone="green" />
        <Kpi label="Delayed" value={delayed.length} tone={delayed.length ? "red" : "green"} />
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Nothing at the dock" hint="Orders appear here once packed." icon={<Truck className="h-6 w-6" />} />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>Carrier</Th>
              <Th>Tracking</Th>
              <Th>Dispatch SLA</Th>
              <Th>Status</Th>
              <Th className="text-right">Action</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const m = minutesUntil(o.promisedAt);
              return (
                <tr key={o.id} className="transition-colors hover:bg-muted/50">
                  <Td>
                    <button onClick={() => setSel(o.id)} className="font-medium text-info hover:underline">
                      {o.id}
                    </button>
                    <span className="block text-[11px] text-muted-foreground">{o.customer}</span>
                  </Td>
                  <Td className="text-xs">{o.carrier}</Td>
                  <Td className="font-mono text-[11px] text-muted-foreground">{o.tracking ?? "—"}</Td>
                  <Td className={cn("tabular text-xs", m < 0 && "text-destructive")}>
                    {fmtTime(o.promisedAt)} · {m < 0 ? `${Math.abs(m)}m late` : `${m}m`}
                  </Td>
                  <Td>
                    <StatusBadge
                      value={
                        o.stage === "Dispatched"
                          ? "Dispatched"
                          : o.qc === "Passed"
                            ? "Label Generated"
                            : o.stage === "QC"
                              ? "QC"
                              : "Packed"
                      }
                      tone={o.stage === "Dispatched" ? "green" : o.qc === "Passed" ? "amber" : "blue"}
                    />
                  </Td>
                  <Td className="text-right">
                    {o.stage === "Dispatched" ? (
                      <span className="text-xs text-muted-foreground">Handover complete</span>
                    ) : o.qc === "Passed" ? (
                      <Button size="sm" className="h-7 text-xs" onClick={() => dispatchOrder(o.id)}>
                        Mark as dispatched
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Awaiting QC</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      )}

      <Sheet open={!!order} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
          {order ? (
            <>
              <SheetHeader className="border-b border-border">
                <SheetTitle className="text-base">{order.id}</SheetTitle>
                <p className="text-xs text-muted-foreground">
                  {order.customer} · {order.city} · {order.carrier}
                </p>
              </SheetHeader>
              <div className="space-y-4 p-4">
                <div className="grid grid-cols-2 gap-3">
                  <Meta label="Tracking" value={order.tracking ?? "Not generated"} />
                  <Meta label="Promised" value={fmtTime(order.promisedAt)} />
                  <Meta label="Weight" value={`${order.packing?.weight ?? "—"} kg`} />
                  <Meta label="Packaging" value={order.packing?.type ?? "—"} />
                </div>
                <Panel title="Dispatch timeline">
                  <ol className="space-y-2">
                    {["Packed", "QC Passed", "Label Created", "Handover", "Dispatched"].map((s, i) => {
                      const reached =
                        (order.stage === "Dispatched" && true) ||
                        (order.qc === "Passed" && i <= 2) ||
                        (order.stage !== "Packed" && i === 0);
                      return (
                        <li key={s} className="flex items-center gap-2 text-xs">
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              reached ? "bg-success" : "bg-border",
                            )}
                          />
                          <span className={reached ? "text-foreground" : "text-muted-foreground"}>{s}</span>
                        </li>
                      );
                    })}
                  </ol>
                </Panel>
                {order.stage !== "Dispatched" && order.qc === "Passed" ? (
                  <Button className="w-full" onClick={() => dispatchOrder(order.id)}>
                    Mark as dispatched
                  </Button>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
