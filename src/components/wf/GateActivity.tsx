import { Link } from "@tanstack/react-router";
import { DoorOpen } from "lucide-react";
import { EmptyState, Panel, StatusBadge } from "@/components/wf/ui";
import { Button } from "@/components/ui/button";
import { useWf } from "@/lib/wf/store";
import { fmtAgo } from "@/lib/wf/engine";
import { gateStats } from "@/lib/wf/insights";

export function GateActivity() {
  const { state } = useWf();
  const stats = gateStats(state);
  const inside = state.gateEvents.filter((g) => g.status === "Inside").slice(0, 4);

  return (
    <Panel
      title="Gate activity"
      description="Live vehicle movement at NORTH GATE and SOUTH GATE"
      action={
        <Button asChild size="sm" variant="ghost">
          <Link to="/gate-entry">Gate desk</Link>
        </Button>
      }
    >
      <div className="grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.gate} className="rounded-md border border-border p-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.gate}</p>
            <p className="tabular mt-1 text-xl font-semibold">{s.inside}</p>
            <p className="text-[11px] text-muted-foreground">
              inside · {s.entriesToday} entries · {s.exitsToday} exits
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 space-y-1.5">
        {inside.map((g) => (
          <div key={g.id} className="flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5">
            <DoorOpen className="h-3.5 w-3.5 shrink-0 text-info" />
            <span className="font-mono text-[11px] font-medium">{g.vehicleNo}</span>
            <StatusBadge value={g.purpose} tone={g.purpose === "Inbound" ? "blue" : "gray"} />
            <span className="ml-auto text-[11px] text-muted-foreground">{fmtAgo(g.entryAt)}</span>
          </div>
        ))}
        {inside.length === 0 ? <EmptyState title="No vehicles inside" hint="The yard is currently clear." /> : null}
      </div>
    </Panel>
  );
}
