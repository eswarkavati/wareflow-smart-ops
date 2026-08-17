import { useState } from "react";
import { Panel, StatusBadge } from "@/components/wf/ui";
import { useWf } from "@/lib/wf/store";
import { zoneActivity, type ZoneActivity } from "@/lib/wf/insights";
import { cn } from "@/lib/utils";

type ZoneKey = keyof ZoneActivity;

const ZONES: { key: ZoneKey; label: string; sub: string; area: string }[] = [
  { key: "northGate", label: "North Gate", sub: "Vehicle entry", area: "ng" },
  { key: "receiving", label: "Receiving", sub: "Inbound docks", area: "rec" },
  { key: "storageA", label: "Storage A", sub: "Fast movers", area: "sa" },
  { key: "storageB", label: "Storage B", sub: "Bulk racks", area: "sb" },
  { key: "storageC", label: "Storage C", sub: "Slow movers", area: "sc" },
  { key: "picking", label: "Picking", sub: "Pick faces", area: "pick" },
  { key: "packing", label: "Packing", sub: "PACK-1 / PACK-2", area: "pack" },
  { key: "qc", label: "Quality Control", sub: "QC-1 / QC-2", area: "qc" },
  { key: "shipping", label: "Shipping", sub: "Outbound docks", area: "ship" },
  { key: "returns", label: "Returns", sub: "Reverse logistics", area: "ret" },
  { key: "damaged", label: "Damaged", sub: "Quarantine", area: "dmg" },
  { key: "staff", label: "Staff Area", sub: "Break & muster", area: "stf" },
  { key: "southGate", label: "South Gate", sub: "Vehicle exit", area: "sg" },
];

function loadTone(load: number) {
  return load >= 80 ? "red" : load >= 50 ? "amber" : load > 0 ? "blue" : "green";
}

function loadLabel(load: number) {
  return load >= 80 ? "Congested" : load >= 50 ? "Busy" : load > 0 ? "Active" : "Idle";
}

export function Blueprint() {
  const { state } = useWf();
  const activity = zoneActivity(state);
  const [sel, setSel] = useState<ZoneKey>("picking");
  const selected = ZONES.find((z) => z.key === sel)!;
  const data = activity[sel];

  return (
    <Panel title="Warehouse Blueprint" description="Live Warehouse Layout & Operational Zones">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <div
          className="grid gap-2 rounded-lg border border-dashed border-border bg-surface p-3"
          style={{
            gridTemplateAreas: `
              "ng ng rec rec sa sa"
              "pick pick pick sb sb sc"
              "pack pack qc qc ship ship"
              "stf ret dmg dmg sg sg"
            `,
          }}
        >
          {ZONES.map((z) => {
            const a = activity[z.key];
            const active = sel === z.key;
            return (
              <button
                key={z.key}
                style={{ gridArea: z.area }}
                onMouseEnter={() => setSel(z.key)}
                onClick={() => setSel(z.key)}
                className={cn(
                  "group relative min-h-[74px] overflow-hidden rounded-md border px-2.5 py-2 text-left transition-all",
                  active
                    ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                    : "border-border bg-card hover:border-primary/40",
                )}
              >
                <p className="text-[12px] font-semibold leading-tight text-foreground">{z.label}</p>
                <p className="text-[10px] text-muted-foreground">{z.sub}</p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      a.load >= 80 ? "bg-destructive" : a.load >= 50 ? "bg-warning" : "bg-success",
                    )}
                    style={{ width: `${Math.max(4, a.load)}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] tabular text-muted-foreground">{a.load}% load</p>
              </button>
            );
          })}
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{selected.label}</p>
              <p className="text-xs text-muted-foreground">{selected.sub}</p>
            </div>
            <StatusBadge value={loadLabel(data.load)} tone={loadTone(data.load)} />
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full",
                data.load >= 80 ? "bg-destructive" : data.load >= 50 ? "bg-warning" : "bg-success",
              )}
              style={{ width: `${Math.max(4, data.load)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Utilisation {data.load}% of designed zone capacity
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3">
            {data.metrics.map((m) => (
              <div key={m.label}>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</dt>
                <dd className="tabular mt-0.5 text-sm font-medium text-foreground">{m.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 border-t border-border pt-3 text-[11px] text-muted-foreground">
            Hover or click any zone on the layout to inspect live activity, load and performance.
          </p>
        </div>
      </div>
    </Panel>
  );
}
