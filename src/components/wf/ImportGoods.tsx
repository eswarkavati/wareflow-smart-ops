import { useState } from "react";
import { PackagePlus } from "lucide-react";
import { EmptyState, Kpi, Meta, Panel, StatusBadge, TableShell, Td, Th } from "@/components/wf/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useWf } from "@/lib/wf/store";
import { fmtTime } from "@/lib/wf/engine";
import type { InboundStatus } from "@/lib/wf/types";
import { cn } from "@/lib/utils";

const STEPS: InboundStatus[] = ["Scheduled", "Arrived", "At Dock", "Unloading", "Verification"];

const TONE: Record<InboundStatus, "gray" | "blue" | "amber" | "green" | "red"> = {
  Scheduled: "gray",
  Arrived: "blue",
  "At Dock": "blue",
  Unloading: "amber",
  Verification: "amber",
  Received: "green",
  Discrepancy: "red",
};

export function ImportGoods() {
  const { state, advanceInbound, setInboundReceived, completeInbound } = useWf();
  const [sel, setSel] = useState<string | null>(null);
  const shipment = state.inbound.find((s) => s.id === sel) ?? null;

  const scheduled = state.inbound.filter((s) => s.status === "Scheduled").length;
  const atDock = state.inbound.filter((s) => ["Arrived", "At Dock", "Unloading", "Verification"].includes(s.status))
    .length;
  const received = state.inbound.filter((s) => s.status === "Received").length;
  const discrepancy = state.inbound.filter((s) => s.status === "Discrepancy").length;

  const stepIndex = shipment ? STEPS.indexOf(shipment.status) : -1;
  const canComplete = shipment?.status === "Verification";

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Scheduled arrivals" value={scheduled} tone="gray" />
        <Kpi label="At the dock" value={atDock} tone={atDock ? "amber" : "green"} />
        <Kpi label="Received today" value={received} tone="green" />
        <Kpi label="Discrepancies" value={discrepancy} tone={discrepancy ? "red" : "green"} />
      </div>

      {state.inbound.length === 0 ? (
        <EmptyState
          title="No inbound shipments"
          hint="Purchase orders scheduled for delivery appear here."
          icon={<PackagePlus className="h-6 w-6" />}
        />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Shipment</Th>
              <Th>Supplier</Th>
              <Th>Vehicle & driver</Th>
              <Th>Gate / Dock</Th>
              <Th>Expected</Th>
              <Th>Lines</Th>
              <Th>Status</Th>
              <Th className="text-right">Action</Th>
            </tr>
          </thead>
          <tbody>
            {state.inbound.map((s) => (
              <tr key={s.id} className="transition-colors hover:bg-muted/50">
                <Td>
                  <button onClick={() => setSel(s.id)} className="font-medium text-info hover:underline">
                    {s.id}
                  </button>
                  <span className="block font-mono text-[11px] text-muted-foreground">{s.po}</span>
                </Td>
                <Td className="text-xs">{s.supplier}</Td>
                <Td>
                  <span className="font-mono text-xs">{s.vehicleNo}</span>
                  <span className="block text-[11px] text-muted-foreground">{s.driver}</span>
                </Td>
                <Td className="text-xs text-muted-foreground">
                  {s.gate}
                  <span className="block text-[11px]">{s.dock}</span>
                </Td>
                <Td className="tabular text-xs">
                  {fmtTime(s.expectedAt)}
                  {s.arrivedAt ? (
                    <span className="block text-[11px] text-muted-foreground">Arrived {fmtTime(s.arrivedAt)}</span>
                  ) : null}
                </Td>
                <Td className="tabular text-xs">{s.lines.length}</Td>
                <Td>
                  <StatusBadge value={s.status} tone={TONE[s.status]} />
                </Td>
                <Td className="text-right">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setSel(s.id)}>
                    Open receiving
                  </Button>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <Sheet open={!!shipment} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {shipment ? (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {shipment.id}
                  <StatusBadge value={shipment.status} tone={TONE[shipment.status]} />
                </SheetTitle>
              </SheetHeader>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Meta label="Purchase order" value={shipment.po} />
                <Meta label="Supplier" value={shipment.supplier} />
                <Meta label="Vehicle" value={shipment.vehicleNo} />
                <Meta label="Driver" value={`${shipment.driver} · ${shipment.driverPhone}`} />
                <Meta label="Gate" value={shipment.gate} />
                <Meta label="Dock" value={shipment.dock} />
              </div>

              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Receiving workflow
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {STEPS.map((s, i) => (
                    <span
                      key={s}
                      className={cn(
                        "rounded-md border px-2 py-1 text-[11px]",
                        shipment.status === "Received" || shipment.status === "Discrepancy" || i <= stepIndex
                          ? "border-primary/40 bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {i + 1}. {s}
                    </span>
                  ))}
                </div>
                {stepIndex >= 0 && stepIndex < STEPS.length - 1 ? (
                  <Button size="sm" className="mt-3 h-8 text-xs" onClick={() => advanceInbound(shipment.id)}>
                    Advance to {STEPS[stepIndex + 1]}
                  </Button>
                ) : null}
              </div>

              <Panel title="Goods verification" className="mt-5" bodyClassName="p-0">
                <TableShell>
                  <thead>
                    <tr>
                      <Th>SKU</Th>
                      <Th>Expected</Th>
                      <Th>Received</Th>
                      <Th>Damaged</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {shipment.lines.map((l) => (
                      <tr key={l.sku}>
                        <Td>
                          <span className="font-mono text-xs">{l.sku}</span>
                          <span className="block text-[11px] text-muted-foreground">{l.name}</span>
                        </Td>
                        <Td className="tabular text-xs">{l.expectedQty}</Td>
                        <Td>
                          <Input
                            type="number"
                            className="h-7 w-20 text-xs"
                            value={l.receivedQty}
                            disabled={shipment.status === "Received" || shipment.status === "Discrepancy"}
                            onChange={(e) =>
                              setInboundReceived(shipment.id, l.sku, Number(e.target.value), l.damagedQty)
                            }
                          />
                        </Td>
                        <Td>
                          <Input
                            type="number"
                            className="h-7 w-20 text-xs"
                            value={l.damagedQty}
                            disabled={shipment.status === "Received" || shipment.status === "Discrepancy"}
                            onChange={(e) =>
                              setInboundReceived(shipment.id, l.sku, l.receivedQty, Number(e.target.value))
                            }
                          />
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </TableShell>
              </Panel>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  disabled={!canComplete}
                  onClick={() => completeInbound(shipment.id)}
                >
                  Confirm receipt & update inventory
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  {canComplete
                    ? "Any quantity mismatch or damage will raise an exception automatically."
                    : shipment.status === "Received" || shipment.status === "Discrepancy"
                      ? `Closed ${shipment.receivedAt ? fmtTime(shipment.receivedAt) : ""}`
                      : "Advance the workflow to Verification to confirm receipt."}
                </span>
              </div>

              {shipment.notes ? (
                <p className="mt-4 rounded-md border border-border bg-surface p-3 text-xs text-muted-foreground">
                  {shipment.notes}
                </p>
              ) : null}
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
