import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PackageCheck } from "lucide-react";
import { AppShell } from "@/components/wf/AppShell";
import { EmptyState, Meta, PageHeader, Panel, StatusBadge } from "@/components/wf/ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useWf } from "@/lib/wf/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/packing")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Packing & QC — WAREFLOW" },
      { name: "description", content: "Packing station checklist and quality gate before dispatch handover." },
      { property: "og:title", content: "Packing & QC — WAREFLOW" },
      { property: "og:description", content: "Pack, verify and quality-check orders before dispatch." },
    ],
  }),
  component: () => (
    <AppShell navKey="packing">
      <Packing />
    </AppShell>
  ),
});

const CHECKS = ["Items scanned", "Quantity verified", "Packaging selected", "Final seal"];
const QC_CHECKS = ["Correct items", "Correct quantity", "Item condition", "Packaging integrity", "Shipping label"];

function Packing() {
  const { state, completePacking, runQc } = useWf();
  const packQueue = state.orders.filter((o) => o.stage === "Packed");
  const qcQueue = state.orders.filter((o) => o.stage === "QC" && o.qc !== "Passed");
  const [checked, setChecked] = useState<Record<string, string[]>>({});
  const [qcChecked, setQcChecked] = useState<Record<string, string[]>>({});

  const toggle = (
    map: Record<string, string[]>,
    set: (v: Record<string, string[]>) => void,
    id: string,
    key: string,
  ) => {
    const cur = map[id] ?? [];
    set({ ...map, [id]: cur.includes(key) ? cur.filter((c) => c !== key) : [...cur, key] });
  };

  return (
    <>
      <PageHeader
        title="Packing & Quality Check"
        subtitle={`${packQueue.length} orders at the packing station · ${qcQueue.length} awaiting QC`}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Packing station" description="Complete the checklist to release an order into QC">
          {packQueue.length === 0 ? (
            <EmptyState title="Packing queue clear" hint="Picked orders arrive here automatically." icon={<PackageCheck className="h-6 w-6" />} />
          ) : (
            <div className="space-y-3">
              {packQueue.map((o) => {
                const list = checked[o.id] ?? ["Items scanned", "Quantity verified", "Packaging selected"];
                const ready = CHECKS.every((c) => list.includes(c));
                return (
                  <div key={o.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{o.id}</span>
                      <StatusBadge value={o.priority} />
                      <span className="ml-auto text-xs text-muted-foreground">{o.customer}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Meta label="Items" value={o.items.reduce((n, i) => n + i.qty, 0)} />
                      <Meta label="Packaging" value={o.packing?.type ?? "Medium Box"} />
                      <Meta label="Weight" value={`${o.packing?.weight ?? 1.2} kg`} />
                      <Meta label="Station" value={o.packing?.station ?? "PACK-1"} />
                    </div>
                    <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
                      {CHECKS.map((c) => (
                        <label key={c} className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={list.includes(c)}
                            onCheckedChange={() => toggle(checked, setChecked, o.id, c)}
                          />
                          <span className={cn(list.includes(c) && "text-muted-foreground line-through")}>{c}</span>
                        </label>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      className="mt-3"
                      disabled={!ready}
                      onClick={() => completePacking(o.id)}
                    >
                      Complete packing
                    </Button>
                    {!ready ? (
                      <span className="ml-2 text-[11px] text-muted-foreground">Complete all checks to release.</span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Quality gate" description="A failed check returns the order to packing and raises an exception">
          {qcQueue.length === 0 ? (
            <EmptyState title="No orders awaiting QC" hint="Everything is running smoothly." />
          ) : (
            <div className="space-y-3">
              {qcQueue.map((o) => {
                const list = qcChecked[o.id] ?? [];
                return (
                  <div key={o.id} className="rounded-md border border-border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{o.id}</span>
                      <StatusBadge value={o.qc ?? "Needs Review"} />
                      <span className="ml-auto text-xs text-muted-foreground">
                        {o.packing?.type} · {o.packing?.weight} kg
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                      {QC_CHECKS.map((c) => (
                        <label key={c} className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={list.includes(c)}
                            onCheckedChange={() => toggle(qcChecked, setQcChecked, o.id, c)}
                          />
                          {c}
                        </label>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        disabled={list.length !== QC_CHECKS.length}
                        onClick={() => runQc(o.id, "Passed")}
                      >
                        Pass QC
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => runQc(o.id, "Failed")}>
                        Fail QC
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
