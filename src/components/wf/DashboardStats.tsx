import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel, StatusBadge } from "@/components/wf/ui";
import { Button } from "@/components/ui/button";
import { useWf } from "@/lib/wf/store";
import {
  bottleneckInsights,
  fulfilmentTrend,
  inventoryHealth,
  pipelineData,
  productivityData,
} from "@/lib/wf/insights";
import { cn } from "@/lib/utils";

const AXIS = { fontSize: 11, fill: "var(--color-muted-foreground)" } as const;

const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  fontSize: 12,
  color: "var(--color-foreground)",
};

export function DashboardStats() {
  const { state } = useWf();
  const [range, setRange] = useState<7 | 30>(7);
  const trend = fulfilmentTrend(state, range);
  const health = inventoryHealth(state);
  const pipeline = pipelineData(state);
  const productivity = productivityData(state);
  const insights = bottleneckInsights(state);

  return (
    <section className="mt-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold tracking-tight">Warehouse Statistics & Analysis</h2>
          <p className="text-sm text-muted-foreground">
            Rule-based operational analytics computed from live warehouse data
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <Panel
          title="Order fulfilment trend"
          description={`Orders received, fulfilled and delivered on time — last ${range} days`}
          action={
            <div className="flex gap-1">
              {([7, 30] as const).map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={range === r ? "default" : "outline"}
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setRange(r)}
                >
                  {r}d
                </Button>
              ))}
            </div>
          }
        >
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={AXIS} interval={range === 30 ? 4 : 0} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="received" stroke="var(--color-info)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="fulfilled" stroke="var(--color-success)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="onTime" stroke="var(--color-warning)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Inventory health" description="SKU distribution by stock cover">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={health} dataKey="value" nameKey="name" innerRadius={54} outerRadius={82} paddingAngle={2}>
                  {health.map((h) => (
                    <Cell key={h.name} fill={h.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Fulfilment pipeline" description="Order accumulation per stage against sustainable capacity">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipeline} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="stage" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="orders" fill="var(--color-info)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="capacity" fill="var(--color-muted-foreground)" fillOpacity={0.25} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Warehouse productivity" description="Tasks completed and efficiency by operator">
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productivity} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={AXIS} tickLine={false} axisLine={false} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="tasks" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
                <Line type="monotone" dataKey="efficiency" stroke="var(--color-warning)" strokeWidth={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title="Bottleneck analysis" description="Automated recommendations generated from current operating data">
        <div className="grid gap-2 md:grid-cols-2">
          {insights.map((i) => (
            <div key={i.title} className="rounded-md border border-border p-3">
              <div className="flex items-center gap-2">
                <StatusBadge value={i.severity} />
                <p className="text-sm font-medium">{i.title}</p>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{i.detail}</p>
              <p
                className={cn(
                  "mt-2 rounded border-l-2 bg-surface px-2 py-1.5 text-xs",
                  i.severity === "Critical" ? "border-destructive" : "border-warning",
                )}
              >
                <span className="font-medium">Recommended action: </span>
                {i.action}
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </section>
  );
}
