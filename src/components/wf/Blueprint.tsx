import { useState, type ReactElement } from "react";
import { Panel, StatusBadge } from "@/components/wf/ui";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useWf } from "@/lib/wf/store";
import { floorZones, type FloorZone, type ZoneStatus } from "@/lib/wf/insights";
import { cn } from "@/lib/utils";

const DOT: Record<ZoneStatus, string> = {
  Normal: "var(--color-success)",
  "High Activity": "var(--color-warning)",
  Issue: "var(--color-destructive)",
  "Active Operation": "var(--color-info)",
};

const BADGE_TONE: Record<ZoneStatus, "green" | "amber" | "red" | "blue"> = {
  Normal: "green",
  "High Activity": "amber",
  Issue: "red",
  "Active Operation": "blue",
};

interface Box {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  caption?: string;
  racks?: "h" | "v" | "pallet" | "dock" | "station";
}

const BOXES: Box[] = [
  { key: "dock01", x: 40, y: 108, w: 190, h: 92, caption: "Inbound bay", racks: "dock" },
  { key: "dock02", x: 240, y: 108, w: 190, h: 92, caption: "Inbound bay", racks: "dock" },
  { key: "import", x: 448, y: 108, w: 268, h: 92, caption: "Verification & putaway", racks: "pallet" },
  { key: "returns", x: 730, y: 108, w: 270, h: 92, caption: "Reverse logistics", racks: "pallet" },

  { key: "storageA", x: 40, y: 232, w: 300, h: 172, caption: "Fast movers · Aisles A1–A6", racks: "h" },
  { key: "storageB", x: 356, y: 232, w: 300, h: 172, caption: "Bulk racks · Aisles B1–B6", racks: "h" },
  { key: "storageC", x: 672, y: 232, w: 328, h: 172, caption: "Slow movers · Aisles C1–C6", racks: "h" },

  { key: "picking", x: 40, y: 436, w: 396, h: 116, caption: "Pick faces · serpentine route", racks: "v" },
  { key: "packing", x: 452, y: 436, w: 264, h: 116, caption: "PACK-1 · PACK-2", racks: "station" },
  { key: "qc", x: 730, y: 436, w: 270, h: 116, caption: "QC-1 · QC-2", racks: "station" },

  { key: "shipping", x: 40, y: 580, w: 396, h: 96, caption: "Outbound staging", racks: "pallet" },
  { key: "loading", x: 452, y: 580, w: 264, h: 96, caption: "SHIP-01 / 02 / 03", racks: "dock" },
  { key: "damaged", x: 730, y: 580, w: 270, h: 96, caption: "Quarantine", racks: "pallet" },
];

function Racks({ box }: { box: Box }) {
  const { x, y, w, h, racks } = box;
  const items: ReactElement[] = [];
  if (racks === "h") {
    for (let i = 0; i < 5; i++) {
      const ry = y + 46 + i * 22;
      if (ry + 10 > y + h - 8) break;
      items.push(<rect key={i} x={x + 14} y={ry} width={w - 28} height={9} className="fill-foreground/[0.07] stroke-foreground/25" strokeWidth={0.7} />);
    }
  } else if (racks === "v") {
    for (let i = 0; i < 10; i++) {
      const rx = x + 16 + i * ((w - 32) / 10);
      items.push(<rect key={i} x={rx} y={y + 46} width={(w - 32) / 10 - 8} height={h - 62} className="fill-foreground/[0.07] stroke-foreground/25" strokeWidth={0.7} />);
    }
  } else if (racks === "pallet") {
    for (let i = 0; i < 6; i++) {
      const rx = x + 16 + (i % 3) * ((w - 32) / 3);
      const ry = y + 46 + Math.floor(i / 3) * 22;
      if (ry + 16 > y + h - 6) break;
      items.push(<rect key={i} x={rx} y={ry} width={(w - 32) / 3 - 12} height={15} className="fill-foreground/[0.05] stroke-foreground/25" strokeWidth={0.7} strokeDasharray="2 2" />);
    }
  } else if (racks === "dock") {
    for (let i = 0; i < 3; i++) {
      const bw = (w - 32) / 3;
      items.push(
        <g key={i}>
          <rect x={x + 16 + i * bw} y={y + h - 26} width={bw - 10} height={16} className="fill-foreground/[0.05] stroke-foreground/30" strokeWidth={0.7} />
          <line x1={x + 16 + i * bw} y1={y + h - 10} x2={x + 16 + i * bw + bw - 10} y2={y + h - 10} className="stroke-foreground/40" strokeWidth={1.4} strokeDasharray="4 3" />
        </g>,
      );
    }
  } else if (racks === "station") {
    for (let i = 0; i < 2; i++) {
      items.push(
        <rect key={i} x={x + 20 + i * ((w - 40) / 2)} y={y + 48} width={(w - 40) / 2 - 16} height={h - 66} rx={2} className="fill-foreground/[0.06] stroke-foreground/25" strokeWidth={0.7} />,
      );
    }
  }
  return <>{items}</>;
}

function GateSymbol({
  x,
  y,
  label,
  zone,
  onClick,
}: {
  x: number;
  y: number;
  label: string;
  zone: FloorZone | undefined;
  onClick: () => void;
}) {
  return (
    <g className="cursor-pointer" onClick={onClick}>
      <rect x={x} y={y} width={300} height={44} rx={2} className="fill-surface stroke-foreground/45" strokeWidth={1.2} />
      <line x1={x + 96} y1={y} x2={x + 96} y2={y + 44} className="stroke-foreground/30" strokeWidth={0.8} strokeDasharray="3 3" />
      <line x1={x + 204} y1={y} x2={x + 204} y2={y + 44} className="stroke-foreground/30" strokeWidth={0.8} strokeDasharray="3 3" />
      <text x={x + 48} y={y + 27} textAnchor="middle" className="fill-muted-foreground text-[10px] uppercase tracking-widest">
        Entry
      </text>
      <text x={x + 150} y={y + 27} textAnchor="middle" className="fill-foreground text-[11px] font-semibold tracking-widest">
        {label}
      </text>
      <text x={x + 252} y={y + 27} textAnchor="middle" className="fill-muted-foreground text-[10px] uppercase tracking-widest">
        Exit
      </text>
      {zone ? <circle cx={x + 288} cy={y + 10} r={4} fill={DOT[zone.status]} /> : null}
    </g>
  );
}

export function Blueprint() {
  const { state } = useWf();
  const zones = floorZones(state);
  const [sel, setSel] = useState<string | null>(null);
  const selected = sel ? zones[sel] : undefined;

  return (
    <>
      <Panel title="Warehouse Layout" description="Bangalore Hub — Operational Floor Plan">
        <div className="overflow-x-auto">
          <svg viewBox="0 0 1040 760" className="min-w-[820px] w-full" role="img" aria-label="Warehouse floor plan">
            <defs>
              <pattern id="wf-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M20 0 H0 V20" fill="none" className="stroke-foreground/[0.05]" strokeWidth="1" />
              </pattern>
              <marker id="wf-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 z" className="fill-info/70" />
              </marker>
            </defs>

            <rect x={0} y={0} width={1040} height={760} fill="url(#wf-grid)" />

            {/* Building envelope */}
            <rect x={20} y={80} width={1000} height={620} className="fill-none stroke-foreground/60" strokeWidth={2} />
            <rect x={26} y={86} width={988} height={608} className="fill-none stroke-foreground/20" strokeWidth={0.8} />

            {/* Gates */}
            <GateSymbol x={370} y={22} label="NORTH GATE" zone={zones["northGate"]} onClick={() => setSel("northGate")} />
            <GateSymbol x={370} y={708} label="SOUTH GATE" zone={zones["southGate"]} onClick={() => setSel("southGate")} />
            <line x1={520} y1={66} x2={520} y2={80} className="stroke-foreground/50" strokeWidth={1} />
            <line x1={520} y1={700} x2={520} y2={708} className="stroke-foreground/50" strokeWidth={1} />

            {/* Movement path */}
            <polyline
              points="240,200 240,216 520,216 520,224"
              className="fill-none stroke-info/50"
              strokeWidth={1.2}
              strokeDasharray="6 4"
              markerEnd="url(#wf-arrow)"
            />
            <polyline
              points="520,404 520,420 238,420 238,432"
              className="fill-none stroke-info/50"
              strokeWidth={1.2}
              strokeDasharray="6 4"
              markerEnd="url(#wf-arrow)"
            />
            <polyline
              points="436,494 452,494"
              className="fill-none stroke-info/50"
              strokeWidth={1.2}
              strokeDasharray="6 4"
              markerEnd="url(#wf-arrow)"
            />
            <polyline
              points="716,494 730,494"
              className="fill-none stroke-info/50"
              strokeWidth={1.2}
              strokeDasharray="6 4"
              markerEnd="url(#wf-arrow)"
            />
            <polyline
              points="865,552 865,566 238,566 238,576"
              className="fill-none stroke-info/50"
              strokeWidth={1.2}
              strokeDasharray="6 4"
              markerEnd="url(#wf-arrow)"
            />

            {/* Aisle markings */}
            <text x={348} y={324} textAnchor="middle" className="fill-muted-foreground/70 text-[9px] tracking-widest" transform="rotate(-90 348 324)">
              MAIN AISLE
            </text>
            <text x={664} y={324} textAnchor="middle" className="fill-muted-foreground/70 text-[9px] tracking-widest" transform="rotate(-90 664 324)">
              CROSS AISLE
            </text>
            <text x={30} y={100} className="fill-muted-foreground/70 text-[9px] tracking-widest">
              BANGALORE HUB · FLOOR PLAN · SCALE 1:400
            </text>

            {BOXES.map((b) => {
              const z = zones[b.key];
              if (!z) return null;
              const active = sel === b.key;
              return (
                <g key={b.key} className="cursor-pointer" onClick={() => setSel(b.key)}>
                  <rect
                    x={b.x}
                    y={b.y}
                    width={b.w}
                    height={b.h}
                    rx={2}
                    className={cn(
                      "transition-colors",
                      active ? "fill-primary/[0.07] stroke-primary" : "fill-card stroke-foreground/45 hover:stroke-primary/70",
                    )}
                    strokeWidth={active ? 1.8 : 1}
                  />
                  <Racks box={b} />
                  <circle cx={b.x + b.w - 12} cy={b.y + 12} r={4} fill={DOT[z.status]} />
                  <text x={b.x + 12} y={b.y + 20} className="fill-foreground text-[11px] font-semibold">
                    {z.label}
                  </text>
                  {b.caption ? (
                    <text x={b.x + 12} y={b.y + 34} className="fill-muted-foreground text-[9px] uppercase tracking-wider">
                      {b.caption}
                    </text>
                  ) : null}
                  <text x={b.x + b.w - 12} y={b.y + b.h - 8} textAnchor="end" className="fill-muted-foreground text-[9px]">
                    {z.load}% util
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 border-t border-border pt-3 text-[11px] text-muted-foreground">
          {(["Normal", "High Activity", "Issue", "Active Operation"] as ZoneStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: DOT[s] }} />
              {s}
            </span>
          ))}
          <span className="ml-auto">Click any zone or gate to inspect live operational detail.</span>
        </div>
      </Panel>

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {selected ? (
            <>
              <SheetHeader>
                <SheetTitle>{selected.label}</SheetTitle>
                <SheetDescription>Bangalore Hub — live zone telemetry</SheetDescription>
              </SheetHeader>
              <div className="px-4">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge value={selected.status} tone={BADGE_TONE[selected.status]} />
                  <span className="tabular text-xs text-muted-foreground">{selected.load}% capacity</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      selected.load >= 80 ? "bg-destructive" : selected.load >= 50 ? "bg-warning" : "bg-success",
                    )}
                    style={{ width: `${Math.max(3, selected.load)}%` }}
                  />
                </div>
                <dl className="mt-5 grid grid-cols-2 gap-4">
                  {selected.metrics.map((m) => (
                    <div key={m.label}>
                      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</dt>
                      <dd className="tabular mt-0.5 text-sm font-medium text-foreground">{m.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
