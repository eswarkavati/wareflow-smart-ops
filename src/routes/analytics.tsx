import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/wf/AppShell";
import { Kpi, PageHeader, Panel, StatusBadge, TableShell, Td, Th } from "@/components/wf/ui";
import { useWf } from "@/lib/wf/store";
import { bottleneck, healthScore, inr, minutesUntil, stageCounts } from "@/lib/wf/engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Operations Analytics — WAREFLOW" },
      { name: "description", content: "Throughput, SLA performance, bottleneck detection and workforce productivity." },
      { property: "og:title", content: "Operations Analytics — WAREFLOW" },
      { property: "og:description", content: "Warehouse performance analytics and bottleneck detection." },
    ],
  }),
  component: () => (
    <AppShell navKey="analytics">
      <Analytics />
    </AppShell>
  ),
});

function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular font-medium">{value}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

function Analytics() {
  const { state } = useWf();
  const counts = stageCounts(state.orders);
  const bn = bottleneck(state);
  const health = healthScore(state);

  const dispatched = state.orders.filter((o) => o.stage === "Dispatched");
  const onTime = dispatched.filter((o) => minutesUntil(o.promisedAt) >= 0).length;
  const slaPct = dispatched.length ? Math.round((onTime / dispatched.length) * 100) : 100;
  const revenue = state.orders.reduce((s, o) => s + o.value, 0);
  const maxStage = Math.max(...Object.values(counts), 1);

  const pickers = [...state.employees]
    .filter((e) => ["Picker", "Packer", "QC Operator"].includes(e.role))
    .sort((a, b) => b.efficiency - a.efficiency);

  const exByType = Object.entries(
    state.exceptions.reduce<Record<string, number>>((acc, e) => {
      acc[e.type] = (acc[e.type] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const maxEx = Math.max(...exByType.map(([, n]) => n), 1);

  return (
    <>
      <PageHeader title="Operations Analytics" subtitle="Throughput, SLA and workforce performance" />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Orders processed" value={dispatched.length} hint="Dispatched today" tone="green" />
        <Kpi label="On-time SLA" value={`${slaPct}%`} tone={slaPct >= 95 ? "green" : slaPct >= 85 ? "amber" : "red"} />
        <Kpi label="Order book value" value={inr(revenue)} />
        <Kpi
          label="Warehouse health"
          value={health.score}
          hint={health.label}
          tone={health.label === "Healthy" ? "green" : health.label === "Warning" ? "amber" : "red"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Order flow by stage" description="Live work-in-progress distribution">
          <div className="space-y-3">
            {Object.entries(counts).map(([k, v]) => (
              <Bar key={k} label={k} value={v} max={maxStage} tone="bg-info" />
            ))}
          </div>
        </Panel>

        <Panel title="Bottleneck detection" description="Average processing time per stage">
          <div className="space-y-3">
            {bn.stages.map((s) => (
              <Bar
                key={s.stage}
                label={`${s.stage} · ${s.queue} in queue`}
                value={Math.round(s.minutes)}
                max={Math.max(...bn.stages.map((x) => x.minutes))}
                tone={s.stage === bn.worst.stage ? "bg-destructive" : "bg-success"}
              />
            ))}
          </div>
          <div className="mt-4 rounded-md border border-warning/30 bg-warning/5 p-3">
            <p className="text-xs font-semibold text-warning">Bottleneck: {bn.worst.stage}</p>
            <p className="mt-1 text-xs text-muted-foreground">{bn.detail}</p>
            <p className="mt-1 text-xs">
              <span className="font-medium">Recommendation:</span> {bn.recommendation}
            </p>
          </div>
        </Panel>

        <Panel title="Exceptions by type" description="Rolling exception distribution">
          <div className="space-y-3">
            {exByType.map(([t, n]) => (
              <Bar key={t} label={t} value={n} max={maxEx} tone="bg-warning" />
            ))}
          </div>
        </Panel>

        <Panel title="Workforce productivity" description="Ranked by efficiency index" bodyClassName="p-0">
          <TableShell>
            <thead>
              <tr>
                <Th>Employee</Th>
                <Th>Role</Th>
                <Th>Tasks</Th>
                <Th>Avg time</Th>
                <Th>Efficiency</Th>
              </tr>
            </thead>
            <tbody>
              {pickers.slice(0, 8).map((e) => (
                <tr key={e.id} className="transition-colors hover:bg-muted/50">
                  <Td className="font-medium">{e.name}</Td>
                  <Td className="text-xs text-muted-foreground">{e.role}</Td>
                  <Td className="tabular">{e.tasksCompleted}</Td>
                  <Td className="tabular text-xs">{e.avgTaskMin} min</Td>
                  <Td>
                    <StatusBadge
                      value={`${e.efficiency}%`}
                      tone={e.efficiency >= 95 ? "green" : e.efficiency >= 85 ? "blue" : "amber"}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        </Panel>
      </div>
    </>
  );
}
