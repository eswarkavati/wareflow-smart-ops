import type { WfState } from "./types";
import { stockStatus } from "./engine";

/** Deterministic pseudo-random in [0,1) from a string seed (stable series across renders). */
function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h % 1000) / 1000;
}

export type RangeKey = "today" | "7d" | "30d";

export const RANGE_LABEL: Record<RangeKey, string> = {
  today: "Today",
  "7d": "7 Days",
  "30d": "30 Days",
};

export interface TrendRow {
  label: string;
  created: number;
  fulfilled: number;
  atRisk: number;
  delayed: number;
  breaches: number;
}

function liveCounts(state: WfState) {
  const created = state.orders.length;
  const fulfilled = state.orders.filter((o) => o.stage === "Dispatched").length;
  const atRisk = state.orders.filter((o) => o.atRisk && o.stage !== "Dispatched").length;
  const breaches = state.orders.filter(
    (o) => new Date(o.promisedAt).getTime() < Date.now() && o.stage !== "Dispatched",
  ).length;
  return { created, fulfilled, atRisk, breaches };
}

/**
 * Operational trend. The final bucket is the live state; earlier buckets are
 * derived deterministically from the same volumes so the series is stable and
 * consistent with the rest of the application data.
 */
export function orderTrend(state: WfState, range: RangeKey): TrendRow[] {
  const live = liveCounts(state);
  const out: TrendRow[] = [];

  if (range === "today") {
    const hours = [8, 10, 12, 14, 16, 18, 20];
    const perSlot = Math.max(2, Math.round(live.created / hours.length));
    hours.forEach((h, i) => {
      const w = hash(`h${h}${live.created}`);
      const created = Math.max(1, Math.round(perSlot * (0.7 + w * 0.7)));
      const fulfilled = Math.round(created * (0.62 + hash(`f${h}`) * 0.3) * ((i + 2) / (hours.length + 1)));
      const atRisk = Math.max(0, Math.round(created * (0.06 + hash(`r${h}`) * 0.14)));
      out.push({
        label: `${String(h).padStart(2, "0")}:00`,
        created,
        fulfilled,
        atRisk,
        delayed: atRisk,
        breaches: Math.round(atRisk * 0.4),
      });
    });
    const last = out[out.length - 1]!;
    last.created = live.created;
    last.fulfilled = live.fulfilled;
    last.atRisk = live.atRisk;
    last.delayed = live.atRisk;
    last.breaches = live.breaches;
    return out;
  }

  const days = range === "7d" ? 7 : 30;
  const base = Math.max(20, live.created);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const weekend = d.getDay() === 0 || d.getDay() === 6 ? 0.8 : 1;
    const created = Math.round(base * weekend * (0.85 + hash(key) * 0.35));
    const fulfilled = Math.round(created * (0.84 + hash(key + "f") * 0.13));
    const atRisk = Math.max(0, Math.round(created * (0.05 + hash(key + "r") * 0.12)));
    out.push({
      label: d.toLocaleDateString([], { day: "2-digit", month: "short" }),
      created,
      fulfilled,
      atRisk,
      delayed: atRisk,
      breaches: Math.round(atRisk * 0.45),
    });
  }
  const last = out[out.length - 1]!;
  last.created = live.created;
  last.fulfilled = live.fulfilled;
  last.atRisk = live.atRisk;
  last.delayed = live.atRisk;
  last.breaches = live.breaches;
  return out;
}

/** Sum of a series field over the current window vs the previous window of equal length. */
export function periodComparison(state: WfState, range: RangeKey) {
  const days = range === "today" ? 1 : range === "7d" ? 7 : 30;
  const current = orderTrend(state, range);
  const currentFulfilled = current.reduce((s, r) => s + r.fulfilled, 0);
  const currentCreated = current.reduce((s, r) => s + r.created, 0);

  // Previous window built with the same deterministic generator, shifted back.
  let prevFulfilled = 0;
  let prevCreated = 0;
  const base = Math.max(20, state.orders.length);
  for (let i = days * 2 - 1; i >= days; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = d.toISOString().slice(0, 10);
    const weekend = d.getDay() === 0 || d.getDay() === 6 ? 0.8 : 1;
    const created = Math.round(base * weekend * (0.85 + hash(key) * 0.35));
    prevCreated += created;
    prevFulfilled += Math.round(created * (0.84 + hash(key + "f") * 0.13));
  }
  if (range === "today") {
    prevCreated = Math.max(1, prevCreated);
    prevFulfilled = Math.max(1, prevFulfilled);
  }
  const change = prevFulfilled ? ((currentFulfilled - prevFulfilled) / prevFulfilled) * 100 : 0;
  return { currentCreated, currentFulfilled, prevCreated, prevFulfilled, change };
}

export interface KpiStat {
  key: string;
  label: string;
  value: string;
  raw: number;
  previous: string;
  change: number;
  goodWhenUp: boolean;
}

function pct(n: number, d: number) {
  return d ? (n / d) * 100 : 0;
}

/** Six headline operational KPIs with a previous-period comparison. */
export function operationalKpis(state: WfState): KpiStat[] {
  const orders = state.orders;
  const dispatched = orders.filter((o) => o.stage === "Dispatched");
  const onTime = dispatched.filter((o) => new Date(o.promisedAt).getTime() >= Date.now());
  const fulfilment = pct(dispatched.length, orders.length);
  const onTimePct = dispatched.length ? pct(onTime.length, dispatched.length) : 100;

  const avgFulfilMin =
    dispatched.length
      ? dispatched.reduce((s, o) => s + (Date.now() - new Date(o.createdAt).getTime()) / 60000, 0) /
        dispatched.length
      : 0;

  const totalUnits = state.products.reduce((s, p) => s + p.available + p.reserved, 0);
  const mismatch = state.exceptions.filter((e) => e.type === "Stock Mismatch").length;
  const accuracy = Math.max(80, 100 - pct(mismatch * 40, Math.max(1, totalUnits)) * 10 - mismatch * 0.4);

  const tasks = state.pickTasks;
  const done = tasks.filter((t) => t.status === "Completed").length;
  const pickEff = tasks.length ? pct(done, tasks.length) : 0;

  const exceptionRate = pct(state.exceptions.length, Math.max(1, orders.length));

  // Previous period baselines derived deterministically from the same data set.
  const seed = (k: string) => 0.85 + hash(k + orders.length) * 0.3;
  const mk = (
    key: string,
    label: string,
    value: number,
    fmt: (n: number) => string,
    goodWhenUp: boolean,
  ): KpiStat => {
    const prev = value * seed(key);
    return {
      key,
      label,
      value: fmt(value),
      raw: value,
      previous: fmt(prev),
      change: prev ? ((value - prev) / prev) * 100 : 0,
      goodWhenUp,
    };
  };
  const p1 = (n: number) => `${n.toFixed(1)}%`;

  return [
    mk("fulfilment", "Fulfillment Rate", fulfilment, p1, true),
    mk("ontime", "On-Time Shipment", onTimePct, p1, true),
    mk("avgtime", "Avg Fulfillment Time", avgFulfilMin, (n) => `${(n / 60).toFixed(1)} h`, false),
    mk("accuracy", "Inventory Accuracy", accuracy, p1, true),
    mk("picking", "Picking Efficiency", pickEff, p1, true),
    mk("exceptions", "Exception Rate", exceptionRate, p1, false),
  ];
}

export interface StageTiming {
  stage: string;
  average: number;
  median: number;
  peak: number;
  queue: number;
}

/** Processing time distribution across the fulfilment chain. */
export function processingTimes(state: WfState): StageTiming[] {
  const q = {
    Allocation: state.orders.filter((o) => o.allocation === "Unallocated" && o.stage !== "Dispatched").length,
    Picking: state.pickTasks.filter((t) => t.status !== "Completed").length,
    Packing: state.orders.filter((o) => o.stage === "Packed").length,
    QC: state.orders.filter((o) => o.stage === "QC" && o.qc !== "Passed").length,
    Shipping: state.orders.filter((o) => o.stage === "QC" && o.qc === "Passed").length,
  };
  const created = state.orders.filter((o) => o.stage === "Created" || o.stage === "Prioritized").length;

  const rows: { stage: string; baseline: number; queue: number }[] = [
    { stage: "Order Created", baseline: 2.4, queue: created },
    { stage: "Allocation", baseline: 4.2, queue: q.Allocation },
    { stage: "Picking", baseline: 7.4, queue: q.Picking },
    { stage: "Packing", baseline: 5.6, queue: q.Packing },
    { stage: "QC", baseline: 3.4, queue: q.QC },
    { stage: "Shipping", baseline: 4.8, queue: q.Shipping },
  ];

  return rows.map((r) => {
    const pressure = 1 + Math.min(1.4, r.queue * 0.06);
    const average = +(r.baseline * pressure).toFixed(1);
    return {
      stage: r.stage,
      average,
      median: +(average * 0.86).toFixed(1),
      peak: +(average * (1.65 + hash(r.stage) * 0.35)).toFixed(1),
      queue: r.queue,
    };
  });
}

export function slowestStage(rows: StageTiming[]) {
  return [...rows].sort((a, b) => b.average - a.average)[0]!;
}

export interface InventoryPerf {
  metric: string;
  value: number;
  previous: number;
  unit: string;
}

export function inventoryPerformance(state: WfState): InventoryPerf[] {
  const products = state.products;
  const onHand = products.reduce((s, p) => s + p.available, 0);
  const reserved = products.reduce((s, p) => s + p.reserved, 0);
  const damaged = products.reduce((s, p) => s + p.damaged, 0);
  const demand = products.reduce((s, p) => s + p.avgDailyDemand, 0);
  const mismatch = state.exceptions.filter((e) => e.type === "Stock Mismatch").length;

  const accuracy = Math.max(80, 100 - mismatch * 0.9);
  const turnover = +((demand * 30) / Math.max(1, onHand)).toFixed(2);
  const availability = pct(
    products.filter((p) => stockStatus(p) === "Healthy" || stockStatus(p) === "Overstock").length,
    Math.max(1, products.length),
  );
  const reservedPct = pct(reserved, Math.max(1, onHand + reserved));
  const damagedPct = pct(damaged, Math.max(1, onHand + reserved + damaged));

  const prev = (v: number, k: string) => +(v * (0.92 + hash(k + products.length) * 0.16)).toFixed(2);
  return [
    { metric: "Inventory Accuracy", value: +accuracy.toFixed(1), previous: prev(accuracy, "acc"), unit: "%" },
    { metric: "Stock Turnover", value: turnover, previous: prev(turnover, "turn"), unit: "x" },
    { metric: "Stock Availability", value: +availability.toFixed(1), previous: prev(availability, "avail"), unit: "%" },
    { metric: "Reserved Stock", value: +reservedPct.toFixed(1), previous: prev(reservedPct, "res"), unit: "%" },
    { metric: "Damaged Stock", value: +damagedPct.toFixed(1), previous: prev(damagedPct, "dmg"), unit: "%" },
  ];
}

export interface ProductivityRow {
  name: string;
  detail: string;
  tasks: number;
  avgMin: number;
  efficiency: number;
  utilisation: number;
}

export function productivityByEmployee(state: WfState): ProductivityRow[] {
  return state.employees
    .filter((e) => ["Picker", "Packer", "QC Operator", "Dispatcher"].includes(e.role))
    .map((e) => ({
      name: e.name,
      detail: `${e.role} · ${e.zone}`,
      tasks: e.tasksCompleted,
      avgMin: e.avgTaskMin,
      efficiency: e.efficiency,
      utilisation: Math.min(100, Math.round(e.efficiency * 0.9 + e.tasksCompleted / 4)),
    }))
    .sort((a, b) => b.efficiency - a.efficiency);
}

export function productivityByZone(state: WfState): ProductivityRow[] {
  const zones: { name: string; roles: string[]; queue: number }[] = [
    {
      name: "Picking",
      roles: ["Picker"],
      queue: state.pickTasks.filter((t) => t.status !== "Completed").length,
    },
    { name: "Packing", roles: ["Packer"], queue: state.orders.filter((o) => o.stage === "Packed").length },
    {
      name: "QC",
      roles: ["QC Operator"],
      queue: state.orders.filter((o) => o.stage === "QC" && o.qc !== "Passed").length,
    },
    {
      name: "Shipping",
      roles: ["Dispatcher"],
      queue: state.orders.filter((o) => o.stage === "QC" && o.qc === "Passed").length,
    },
  ];
  return zones.map((z) => {
    const staff = state.employees.filter((e) => z.roles.includes(e.role));
    const tasks = staff.reduce((s, e) => s + e.tasksCompleted, 0);
    const avgMin = staff.length
      ? +(staff.reduce((s, e) => s + e.avgTaskMin, 0) / staff.length).toFixed(1)
      : 0;
    const efficiency = staff.length
      ? Math.round(staff.reduce((s, e) => s + e.efficiency, 0) / staff.length)
      : 0;
    return {
      name: z.name,
      detail: `${staff.length} operators · ${z.queue} in queue`,
      tasks,
      avgMin,
      efficiency,
      utilisation: Math.min(100, Math.round(40 + z.queue * 8)),
    };
  });
}

export interface BottleneckRow {
  stage: string;
  queue: number;
  avgMin: number;
  capacity: number;
  delayPct: number;
}

export function bottleneckAnalysis(state: WfState): BottleneckRow[] {
  const timings = processingTimes(state);
  const byStage = new Map(timings.map((t) => [t.stage, t]));
  const inboundActive = state.inbound.filter((s) => s.status !== "Received" && s.status !== "Scheduled").length;
  const storageIssues = state.products.filter((p) => stockStatus(p) !== "Healthy").length;

  const rows: BottleneckRow[] = [
    { stage: "Receiving", queue: inboundActive, avgMin: 9.2, capacity: Math.min(100, inboundActive * 22), delayPct: 0 },
    {
      stage: "Storage",
      queue: storageIssues,
      avgMin: 3.6,
      capacity: Math.min(100, Math.round(pct(storageIssues, Math.max(1, state.products.length)) + 45)),
      delayPct: 0,
    },
    ...(["Picking", "Packing", "QC", "Shipping"] as const).map((s) => {
      const t = byStage.get(s)!;
      return {
        stage: s,
        queue: t.queue,
        avgMin: t.average,
        capacity: Math.min(100, Math.round(45 + t.queue * 7)),
        delayPct: 0,
      };
    }),
  ];
  const avg = rows.reduce((s, r) => s + r.avgMin, 0) / rows.length;
  rows.forEach((r) => {
    r.delayPct = +(((r.avgMin - avg) / avg) * 100).toFixed(1);
  });
  return rows;
}

export function biggestBottleneck(rows: BottleneckRow[]) {
  return [...rows].sort((a, b) => b.capacity + b.delayPct - (a.capacity + a.delayPct))[0]!;
}

export interface IntelligenceItem {
  id: string;
  title: string;
  detail: string;
  recommendation?: string | undefined;
  severity: "Critical" | "High" | "Normal" | "Positive";
}

/** Rule-based operational intelligence generated from the live application state. */
export function operationalIntelligence(state: WfState): IntelligenceItem[] {
  const out: IntelligenceItem[] = [];
  const rows = bottleneckAnalysis(state);
  const worst = biggestBottleneck(rows);
  const avgEff = state.employees.length
    ? Math.round(state.employees.reduce((s, e) => s + e.efficiency, 0) / state.employees.length)
    : 0;

  out.push({
    id: "bottleneck",
    title: `${worst.stage} is currently the primary bottleneck`,
    detail: `${worst.queue} items in queue, average processing ${worst.avgMin} min, capacity utilisation ${worst.capacity}% (${worst.delayPct > 0 ? "+" : ""}${worst.delayPct}% vs warehouse average).`,
    recommendation:
      worst.stage === "Picking"
        ? "Move 2 available pickers from Zone A to Zone C and batch multi-line orders."
        : `Add one operator to ${worst.stage} for the next 60 minutes and re-sequence the queue.`,
    severity: worst.capacity > 85 ? "Critical" : worst.capacity > 65 ? "High" : "Normal",
  });

  const reorder = state.products.filter((p) => p.available <= p.reorderPoint && p.avgDailyDemand > 15);
  if (reorder.length)
    out.push({
      id: "inventory",
      title: "Inventory risk increasing",
      detail: `${reorder.length} high-volume SKUs are at or below their reorder threshold (${reorder
        .slice(0, 3)
        .map((p) => p.sku)
        .join(", ")}${reorder.length > 3 ? "…" : ""}).`,
      recommendation: "Create replenishment requests for the affected SKUs from the planner.",
      severity: reorder.length > 4 ? "Critical" : "High",
    });

  const dispatched = state.orders.filter((o) => o.stage === "Dispatched");
  const onTimeNow = dispatched.length
    ? pct(dispatched.filter((o) => new Date(o.promisedAt).getTime() >= Date.now()).length, dispatched.length)
    : 100;
  const onTimePrev = onTimeNow * (0.9 + hash(`ot${dispatched.length}`) * 0.16);
  out.push({
    id: "shipping",
    title:
      onTimeNow >= onTimePrev ? "Shipping performance improved" : "Shipping performance declining",
    detail: `On-time shipping moved from ${onTimePrev.toFixed(1)}% to ${onTimeNow.toFixed(1)}% across ${dispatched.length} dispatched orders.`,
    severity: onTimeNow >= onTimePrev ? "Positive" : "High",
    ...(onTimeNow >= onTimePrev
      ? {}
      : { recommendation: "Pre-print labels and consolidate the next carrier run to recover the SLA." }),
  });

  const north = state.gateEvents.filter((g) => g.gate === "NORTH GATE").length;
  const south = state.gateEvents.filter((g) => g.gate === "SOUTH GATE").length;
  if (north && south) {
    const diff = ((north - south) / Math.max(1, south)) * 100;
    if (Math.abs(diff) >= 10)
      out.push({
        id: "gates",
        title: "Gate congestion detected",
        detail: `${diff > 0 ? "North" : "South"} Gate traffic is ${Math.abs(diff).toFixed(0)}% higher than the other gate (${north} vs ${south} movements logged).`,
        recommendation: `Redirect incoming vehicles to ${diff > 0 ? "South" : "North"} Gate when capacity permits.`,
        severity: "Normal",
      });
  }

  const blocked = state.pickTasks.filter((t) => t.status === "Blocked").length;
  if (blocked)
    out.push({
      id: "blocked",
      title: `${blocked} pick task(s) blocked on missing stock`,
      detail: "Blocked picks hold reserved inventory and stall the linked orders entirely.",
      recommendation: "Run a cycle count at the flagged locations and substitute from overflow racks.",
      severity: "Critical",
    });

  out.push({
    id: "workforce",
    title: `Workforce efficiency at ${avgEff}%`,
    detail: `${state.employees.filter((e) => e.status === "Active").length} of ${state.employees.length} operators are on shift across the Bangalore Hub floor.`,
    severity: avgEff >= 90 ? "Positive" : "Normal",
    ...(avgEff >= 90 ? {} : { recommendation: "Rebalance task assignment towards the highest performing zones." }),
  });

  const rank = { Critical: 0, High: 1, Normal: 2, Positive: 3 };
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
