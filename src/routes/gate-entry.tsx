import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DoorOpen } from "lucide-react";
import { AppShell } from "@/components/wf/AppShell";
import { EmptyState, Kpi, PageHeader, Panel, StatusBadge, TableShell, Td, Th } from "@/components/wf/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWf } from "@/lib/wf/store";
import { fmtAgo, fmtTime } from "@/lib/wf/engine";
import { GATES, gateStats } from "@/lib/wf/insights";
import type { GateEvent, GateId } from "@/lib/wf/types";

export const Route = createFileRoute("/gate-entry")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Gate Entry — WAREFLOW" },
      { name: "description", content: "North and South gate vehicle movement, traffic statistics and live occupancy." },
      { property: "og:title", content: "Gate Entry — WAREFLOW" },
      { property: "og:description", content: "Control vehicle entry and exit across warehouse gates." },
    ],
  }),
  component: () => (
    <AppShell navKey="gate-entry">
      <GateEntry />
    </AppShell>
  ),
});

function GateEntry() {
  const { state, recordGateEntry, recordGateExit } = useWf();
  const stats = gateStats(state);
  const [gate, setGate] = useState<GateId>("NORTH GATE");
  const [vehicleNo, setVehicleNo] = useState("");
  const [driver, setDriver] = useState("");
  const [transporter, setTransporter] = useState("");
  const [purpose, setPurpose] = useState<GateEvent["purpose"]>("Inbound");
  const [shipmentId, setShipmentId] = useState("none");
  const [filter, setFilter] = useState<"all" | GateId>("all");

  const pending = state.inbound.filter((s) => s.status === "Scheduled");
  const inside = state.gateEvents.filter((g) => g.status === "Inside");
  const events = state.gateEvents.filter((g) => filter === "all" || g.gate === filter);

  const submit = () => {
    if (!vehicleNo.trim() || !driver.trim()) return;
    recordGateEntry({
      gate,
      vehicleNo,
      driver,
      transporter: transporter.trim() || "Unassigned",
      purpose,
      ...(shipmentId !== "none" ? { shipmentId } : {}),
    });
    setVehicleNo("");
    setDriver("");
    setTransporter("");
    setShipmentId("none");
  };

  return (
    <>
      <PageHeader title="Gate Entry" subtitle="Vehicle movement control across NORTH GATE and SOUTH GATE" />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Vehicles inside" value={inside.length} tone={inside.length > 4 ? "amber" : "blue"} />
        <Kpi label="Movements logged" value={state.gateEvents.length} />
        <Kpi label="Inbound vehicles" value={state.gateEvents.filter((g) => g.purpose === "Inbound").length} tone="green" />
        <Kpi label="Awaiting arrival" value={pending.length} tone={pending.length ? "amber" : "green"} />
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        {stats.map((s) => (
          <Panel key={s.gate} title={s.gate} description="Traffic statistics for the current operating day">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Inside now", s.inside],
                ["Entries", s.entriesToday],
                ["Exits", s.exitsToday],
                ["Avg dwell", `${s.avgDwell}m`],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
                  <p className="tabular mt-0.5 text-lg font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2 text-[11px] text-muted-foreground">
              <StatusBadge value={`Inbound ${s.inbound}`} tone="blue" />
              <StatusBadge value={`Outbound ${s.outbound}`} tone="gray" />
            </div>
          </Panel>
        ))}
      </div>

      {congestion?.congested && !dismissed ? (
        <Panel
          title="Gate congestion detected"
          description="WAREFLOW Decision Engine — inbound traffic balancing"
          className="mb-4 border-primary/40"
        >
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-[260px] flex-1">
              <p className="text-sm">
                {congestion.deviation > 0 ? "NORTH GATE" : "SOUTH GATE"} traffic is{" "}
                <span className="font-semibold text-primary">{Math.abs(congestion.deviation).toFixed(1)}%</span> above the
                balanced load.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {congestion.deviation > 0 ? "SOUTH GATE" : "NORTH GATE"} currently holds{" "}
                {congestion.deviation > 0 ? congestion.south.inside : congestion.north.inside} vehicles and has spare dock
                capacity. Redirecting inbound vehicles reduces dwell time and protects receiving slots.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setGate(congestion.deviation > 0 ? "SOUTH GATE" : "NORTH GATE");
                  setDismissed(true);
                  toast.success("Inbound vehicles redirected to the gate with spare capacity");
                }}
              >
                Apply Recommendation
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setDismissed(true)}>
                Dismiss
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}


      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Panel title="Log vehicle entry" description="Entry against a scheduled inbound marks it as Arrived">
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Gate</Label>
              <Select value={gate} onValueChange={(v) => setGate(v as GateId)}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GATES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Vehicle number</Label>
              <Input
                className="mt-1 h-8 text-xs"
                value={vehicleNo}
                onChange={(e) => setVehicleNo(e.target.value)}
                placeholder="KA-01-AB-1234"
              />
            </div>
            <div>
              <Label className="text-xs">Driver name</Label>
              <Input className="mt-1 h-8 text-xs" value={driver} onChange={(e) => setDriver(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Transporter</Label>
              <Input
                className="mt-1 h-8 text-xs"
                value={transporter}
                onChange={(e) => setTransporter(e.target.value)}
                placeholder="Delhivery"
              />
            </div>
            <div>
              <Label className="text-xs">Purpose</Label>
              <Select value={purpose} onValueChange={(v) => setPurpose(v as GateEvent["purpose"])}>
                <SelectTrigger className="mt-1 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Inbound", "Outbound", "Visitor", "Service"].map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {purpose === "Inbound" ? (
              <div>
                <Label className="text-xs">Link inbound shipment</Label>
                <Select value={shipmentId} onValueChange={setShipmentId}>
                  <SelectTrigger className="mt-1 h-8 text-xs">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not linked</SelectItem>
                    {pending.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.id} · {s.supplier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <Button className="h-8 w-full text-xs" onClick={submit} disabled={!vehicleNo.trim() || !driver.trim()}>
              Record entry
            </Button>
          </div>
        </Panel>

        <Panel
          title="Vehicle movement log"
          description="Every entry and exit recorded at the gates"
          bodyClassName="p-0"
          action={
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Both gates</SelectItem>
                {GATES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        >
          {events.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No gate movements" hint="Log an entry to start the movement register." icon={<DoorOpen className="h-6 w-6" />} />
            </div>
          ) : (
            <TableShell>
              <thead>
                <tr>
                  <Th>Vehicle</Th>
                  <Th>Gate</Th>
                  <Th>Purpose</Th>
                  <Th>Entry</Th>
                  <Th>Exit</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Action</Th>
                </tr>
              </thead>
              <tbody>
                {events.map((g) => (
                  <tr key={g.id} className="transition-colors hover:bg-muted/50">
                    <Td>
                      <span className="font-mono text-xs font-medium">{g.vehicleNo}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {g.driver} · {g.transporter}
                      </span>
                    </Td>
                    <Td className="text-xs">{g.gate}</Td>
                    <Td className="text-xs">
                      {g.purpose}
                      {g.shipmentId ? (
                        <span className="block font-mono text-[11px] text-muted-foreground">{g.shipmentId}</span>
                      ) : null}
                    </Td>
                    <Td className="tabular text-xs">
                      {fmtTime(g.entryAt)}
                      <span className="block text-[11px] text-muted-foreground">{fmtAgo(g.entryAt)}</span>
                    </Td>
                    <Td className="tabular text-xs">{g.exitAt ? fmtTime(g.exitAt) : "—"}</Td>
                    <Td>
                      <StatusBadge value={g.status} tone={g.status === "Inside" ? "amber" : "green"} />
                    </Td>
                    <Td className="text-right">
                      {g.status === "Inside" ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => recordGateExit(g.id)}>
                          Record exit
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Closed</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </Panel>
      </div>
    </>
  );
}
