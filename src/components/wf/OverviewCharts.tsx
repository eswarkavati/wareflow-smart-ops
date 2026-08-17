import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Panel } from "@/components/wf/ui";
import { useWf } from "@/lib/wf/store";
import { orderTrend, RANGE_LABEL, type RangeKey } from "@/lib/wf/analytics";
import { stockStatus } from "@/lib/wf/engine";
import type { Product } from "@/lib/wf/types";
import { cn } from "@/lib/utils";

const AXIS = { fontSize: 11, fill: "var(--color-muted-foreground)" } as const;

export const tooltipStyle = {
  background: "var(--color-card)",
  border: "1px solid var(--color-border)",
  borderRadius: 6,
  fontSize: 12,
  color: "var(--color-foreground)",
};

const RANGES: RangeKey[] = ["today", "7d", "30d"];

function inventoryBuckets(products: Product[]) {
  const b = { Healthy: 0, "Low Stock": 0, "Out of Stock": 0, Damaged: 0 };
  products.forEach((p) => {
    if (p.damaged > 0) b.Damaged++;
    const s = stockStatus(p);
    if (s === "Out of Stock") b["Out of Stock"]++;
    else if (s === "Low Stock" || s === "Critical") b["Low Stock"]++;
    else b.Healthy++;
  });
  return b;
}

export function OverviewCharts() {
  const { state } = useWf();
  const [range, setRange] = useState<RangeKey>("7d");
  const trend = orderTrend(state, range);

  const buckets = inventoryBuckets(state.products);
  const totalSkus = state.products.length;
  const healthyPct = totalSkus ? Math.round((buckets.Healthy / totalSkus) * 100) : 0;
  const critical = buckets["Out of Stock"] + buckets["Low Stock"];

  const donut = [
    { name: "Healthy", value: buckets.Healthy, fill: "var(--color-success)" },
    { name: "Low Stock", value: buckets["Low Stock"], fill: "var(--color-warning)" },
    { name: "Out of Stock", value: buckets["Out of Stock"], fill: "var(--color-destructive)" },
    { name: "Damaged", value: buckets.Damaged, fill: "var(--color-info)" },
  ].filter((d) => d.value > 0);

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_1fr]">
      <Panel
        title="Order fulfillment trend"
        description="Orders created, fulfilled and at risk across the selected window"
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
        <div className="h-[236px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-info)" stopOpacity={0.32} />
                  <stop offset="100%" stopColor="var(--color-info)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gFulfilled" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-success)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-success)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} width={44} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="created"
                name="Orders created"
                stroke="var(--color-info)"
                fill="url(#gCreated)"
                strokeWidth={1.8}
              />
              <Area
                type="monotone"
                dataKey="fulfilled"
                name="Orders fulfilled"
                stroke="var(--color-success)"
                fill="url(#gFulfilled)"
                strokeWidth={1.8}
              />
              <Area
                type="monotone"
                dataKey="atRisk"
                name="Orders at risk"
                stroke="var(--color-destructive)"
                fill="transparent"
                strokeWidth={1.6}
                strokeDasharray="4 3"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Inventory health" description="SKU distribution across stock condition">
        <div className="grid grid-cols-[1fr_auto] items-center gap-3">
          <div className="h-[190px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={donut} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="none">
                  {donut.map((d) => (
                    <Cell key={d.name} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <dl className="space-y-2 pr-1">
            {donut.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: d.fill }} />
                <dt className="text-[11px] text-muted-foreground">{d.name}</dt>
                <dd className="tabular ml-auto text-xs font-medium">{d.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 border-t border-border pt-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total SKUs</p>
            <p className="tabular text-lg font-semibold">{totalSkus}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Healthy</p>
            <p className="tabular text-lg font-semibold text-success">{healthyPct}%</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Critical SKUs</p>
            <p className="tabular text-lg font-semibold text-destructive">{critical}</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
