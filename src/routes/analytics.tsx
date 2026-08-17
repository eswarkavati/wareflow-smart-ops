import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Lightbulb } from "lucide-react";
import { AppShell } from "@/components/wf/AppShell";
import { PageHeader, Panel, StatusBadge, TableShell, Td, Th } from "@/components/wf/ui";
import { useWf } from "@/lib/wf/store";
import {
  biggestBottleneck,
  bottleneckAnalysis,
  inventoryPerformance,
  operationalIntelligence,
  operationalKpis,
  orderTrend,
  periodComparison,
  processingTimes,
  productivityByEmployee,
  productivityByZone,
  RANGE_LABEL,
  slowestStage,
  type RangeKey,
} from "@/lib/wf/analytics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Operational Analytics — WAREFLOW" },
      {
        name: "description",
        content:
          "Bangalore Hub warehouse performance intelligence: fulfilment, processing time, inventory, productivity and bottleneck analysis.",
      },
      { property: "og:title", content: "Operational Analytics — WAREFLOW" },
      { property: "og:description", content: "Warehouse performance intelligence for the Bangalore Hub." },
    ],
  }),
  component: () => (
    <AppShell navKey="analytics">
      <Analytics />
    </AppShell>
  ),
});

const AXIS = { fontSize: 11, fill: "var(--color-muted-foreground)" } as const;
const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  fontSize: 12,
  color: "var(--color-foreground)",
};
const RANGES: RangeKey[] = ["today", "7d", "30d"];

function Delta({ change, goodWhenUp = true }: { change: number; goodWhenUp?: boolean }) {
  const up = change >= 0;
  const good = goodWhenUp ? up : !up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("tabular inline-flex items-center gap-0.5 text-xs font-medium", good ? "text-success" : "text-destructive")}>
      <Icon className="h-3 w-3" />
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

function Analytics() {
  const { state } = useWf();
  const [range, setRange] = useState<RangeKey>("7d");
  const [mode, setMode] = useState<"zone" | "employee">("zone");

  const kpis = operationalKpis(state);
  const trend = orderTrend(state, range);
  const comparison = periodComparison(state, range);
  const timings = processingTimes(state);
  const slowest = slowestStage(timings);
  const invPerf = inventoryPerformance(state);
  const productivity = mode === "zone" ? productivityByZone(state) : productivityByEmployee(state).slice(0, 10);
  const bottlenecks = bottleneckAnalysis(state);
  const worst = biggestBottleneck(bottlenecks);
  const insights = operationalIntelligence(state);

  const invAlert = invPerf.find((r) => r.metric === "Inventory Accuracy")!;
  const invChange = ((invAlert.value - invAlert.previous) / invAlert.previous) * 100;

  return (
    <>
      <PageHeader eyebrow="Intelligence" title="Operational Analytics" subtitle="Bangalore Hub — Warehouse Performance Intelligence" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.key} className="panel px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <p className="tabular mt-1 text-xl font-semibold leading-none">{k.value}</p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Delta change={k.change} goodWhenUp={k.goodWhenUp} />
              <span className="text-[10px] text-muted-foreground">vs {k.previous}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        <Panel
          title="Fulfillment performance"
          description="Orders received, fulfilled, delayed and SLA breaches over time"
          action={
            <div className="flex gap-1">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[11px] transition-colors",
                    range === r
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {RANGE_LABEL[r]}
                </button>
              ))}
            </div>
          }
        >
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="aFulfilled" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} minTickGap={16} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="created" name="Orders received" fill="var(--color-info)" opacity={0.35} radius={[2, 2, 0, 0]} />
                <Area
                  type="monotone"
                  dataKey="fulfilled"
                  name="Orders fulfilled"
                  stroke="var(--color-success)"
                  fill="url(#aFulfilled)"
                  strokeWidth={2}
                />
                <Line type="monotone" dataKey="delayed" name="Orders delayed" stroke="var(--color-warning)" strokeWidth={1.8} dot={false} />
                <Line
                  type="monotone"
                  dataKey="breaches"
                  name="SLA breaches"
                  stroke="var(--color-destructive)"
                  strokeWidth={1.6}
                  strokeDasharray="4 3"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 rounded-md border border-border bg-surface px-3 py-2 text-xs">
            Fulfilment {comparison.change >= 0 ? "improved" : "declined"} by{" "}
            <span className="font-semibold">{Math.abs(comparison.change).toFixed(1)}%</span> compared with the previous{" "}
            {RANGE_LABEL[range].toLowerCase()} period ({comparison.currentFulfilled} vs {comparison.prevFulfilled} orders
            fulfilled).
          </p>
        </Panel>

        <div className="grid gap-4 xl:grid-cols-2">
          <Panel title="Processing time analysis" description="Average, median and peak minutes per fulfilment stage">
            <div className="h-[268px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={timings} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="stage" tick={{ ...AXIS, fontSize: 10 }} tickLine={false} axisLine={false} interval={0} angle={-14} height={44} textAnchor="end" />
                  <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} unit="m" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="average" name="Average" radius={[2, 2, 0, 0]}>
                    {timings.map((t) => (
                      <Cell key={t.stage} fill={t.stage === slowest.stage ? "var(--color-destructive)" : "var(--color-info)"} />
                    ))}
                  </Bar>
                  <Bar dataKey="median" name="Median" fill="var(--color-success)" opacity={0.5} radius={[2, 2, 0, 0]} />
                  <Line type="monotone" dataKey="peak" name="Peak" stroke="var(--color-warning)" strokeWidth={1.8} dot={{ r: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-xs font-semibold text-destructive">Largest delay · {slowest.stage}</p>
              <div className="tabular mt-1.5 grid grid-cols-3 gap-2 text-xs">
                <span>Average: {slowest.average} min</span>
                <span>Median: {slowest.median} min</span>
                <span>Peak: {slowest.peak} min</span>
              </div>
            </div>
          </Panel>

          <Panel title="Inventory performance" description="Accuracy, turnover and availability against the previous period">
            <div className="h-[268px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={invPerf} layout="vertical" margin={{ top: 8, right: 16, left: 40, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="metric" tick={{ ...AXIS, fontSize: 10 }} tickLine={false} axisLine={false} width={110} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="previous" name="Previous period" fill="var(--color-muted-foreground)" opacity={0.35} radius={[0, 2, 2, 0]} />
                  <Bar dataKey="value" name="Current" fill="var(--color-info)" radius={[0, 2, 2, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 rounded-md border border-border bg-surface px-3 py-2 text-xs">
              Inventory accuracy {invChange >= 0 ? "rose" : "dropped"} {Math.abs(invChange).toFixed(1)}% this period
              {state.exceptions.filter((e) => e.type === "Stock Mismatch").length > 0
                ? ` driven by ${state.exceptions.filter((e) => e.type === "Stock Mismatch").length} stock mismatch exception(s).`
                : " with no open stock mismatches."}
            </p>
          </Panel>
        </div>

        <Panel
          title="Warehouse productivity"
          description="Tasks, processing time, efficiency and capacity utilisation"
          action={
            <div className="flex gap-1">
              {(["zone", "employee"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[11px] capitalize transition-colors",
                    mode === m
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  By {m}
                </button>
              ))}
            </div>
          }
        >
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={productivity} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" tick={{ ...AXIS, fontSize: 10 }} tickLine={false} axisLine={false} interval={0} angle={-14} height={44} textAnchor="end" />
                  <YAxis yAxisId="l" tick={AXIS} tickLine={false} axisLine={false} width={40} />
                  <YAxis yAxisId="r" orientation="right" tick={AXIS} tickLine={false} axisLine={false} width={36} unit="%" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="l" dataKey="tasks" name="Tasks completed" fill="var(--color-info)" radius={[2, 2, 0, 0]} />
                  <Line yAxisId="r" type="monotone" dataKey="efficiency" name="Efficiency %" stroke="var(--color-success)" strokeWidth={2} dot={{ r: 2 }} />
                  <Line yAxisId="r" type="monotone" dataKey="utilisation" name="Capacity %" stroke="var(--color-warning)" strokeWidth={1.6} strokeDasharray="4 3" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="overflow-hidden rounded-md border border-border">
              <TableShell>
                <thead>
                  <tr>
                    <Th>{mode === "zone" ? "Zone" : "Employee"}</Th>
                    <Th>Tasks</Th>
                    <Th>Avg time</Th>
                    <Th>Efficiency</Th>
                  </tr>
                </thead>
                <tbody>
                  {productivity.map((r) => (
                    <tr key={r.name} className="transition-colors hover:bg-muted/50">
                      <Td>
                        <span className="block text-sm font-medium">{r.name}</span>
                        <span className="block text-[11px] text-muted-foreground">{r.detail}</span>
                      </Td>
                      <Td className="tabular">{r.tasks}</Td>
                      <Td className="tabular text-xs">{r.avgMin} min</Td>
                      <Td>
                        <StatusBadge
                          value={`${r.efficiency}%`}
                          tone={r.efficiency >= 95 ? "green" : r.efficiency >= 85 ? "blue" : "amber"}
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableShell>
            </div>
          </div>
        </Panel>

        <Panel title="Bottleneck analysis" description="Queue, processing time, capacity and delay across every stage">
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={bottlenecks} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="stage" tick={{ ...AXIS, fontSize: 10 }} tickLine={false} axisLine={false} interval={0} />
                  <YAxis yAxisId="l" tick={AXIS} tickLine={false} axisLine={false} width={40} />
                  <YAxis yAxisId="r" orientation="right" tick={AXIS} tickLine={false} axisLine={false} width={36} unit="%" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine yAxisId="r" y={85} stroke="var(--color-destructive)" strokeDasharray="4 3" />
                  <Bar yAxisId="l" dataKey="queue" name="Queue size" radius={[2, 2, 0, 0]}>
                    {bottlenecks.map((b) => (
                      <Cell key={b.stage} fill={b.stage === worst.stage ? "var(--color-destructive)" : "var(--color-info)"} />
                    ))}
                  </Bar>
                  <Line yAxisId="l" type="monotone" dataKey="avgMin" name="Avg processing (min)" stroke="var(--color-warning)" strokeWidth={1.8} dot={{ r: 2 }} />
                  <Line yAxisId="r" type="monotone" dataKey="capacity" name="Capacity %" stroke="var(--color-success)" strokeWidth={1.6} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              <div className="h-[186px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={bottlenecks} outerRadius={68}>
                    <PolarGrid stroke="var(--color-border)" />
                    <PolarAngleAxis dataKey="stage" tick={{ ...AXIS, fontSize: 10 }} />
                    <PolarRadiusAxis tick={false} axisLine={false} />
                    <Radar name="Capacity %" dataKey="capacity" stroke="var(--color-info)" fill="var(--color-info)" fillOpacity={0.25} />
                    <Tooltip contentStyle={tooltipStyle} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-md border border-warning/40 bg-warning/5 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Current bottleneck</p>
                <p className="mt-0.5 text-sm font-semibold">{worst.stage}</p>
                <dl className="tabular mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Queue</dt>
                    <dd className="font-medium">{worst.queue}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Avg processing</dt>
                    <dd className="font-medium">{worst.avgMin} min</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Capacity</dt>
                    <dd className="font-medium">{worst.capacity}%</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Delay</dt>
                    <dd className="font-medium">
                      {worst.delayPct > 0 ? "+" : ""}
                      {worst.delayPct}%
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Operational intelligence" description="Rule-based recommendations computed from live warehouse data">
          <div className="grid gap-3 lg:grid-cols-2">
            {insights.map((i, idx) => (
              <div key={i.id} className="rounded-md border border-border bg-surface p-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Insight {String(idx + 1).padStart(2, "0")}
                  </span>
                  <StatusBadge
                    className="ml-auto"
                    value={i.severity}
                    tone={i.severity === "Critical" ? "red" : i.severity === "High" ? "amber" : i.severity === "Positive" ? "green" : "blue"}
                  />
                </div>
                <p className="mt-1.5 text-sm font-semibold text-foreground">{i.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{i.detail}</p>
                {i.recommendation ? (
                  <p className="mt-2 flex items-start gap-1.5 border-t border-border pt-2 text-xs">
                    <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                    <span>
                      <span className="font-medium">Recommendation: </span>
                      {i.recommendation}
                    </span>
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}
