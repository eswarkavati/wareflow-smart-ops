import type { GateId, WfState } from "./types";
import { stockStatus } from "./engine";

/** Deterministic pseudo random from a string seed (stable trend series). */
function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h % 1000) / 1000;
}

export interface TrendPoint {
  day: string;
  received: number;
  fulfilled: number;
  onTime: number;
}

/** Order fulfilment trend derived from current volumes, projected across the window. */
export function fulfilmentTrend(state: WfState, days: 7 | 30): TrendPoint[] {
  const base = Math.max(28, state.orders.length * 4);
  const out: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = `${d.toISOString().slice(0, 10)}`;
    const wobble = hash(key);
    const weekend = d.getDay() === 0 || d.getDay() === 6 ? 0.78 : 1;
    const received = Math.round(base * weekend * (0.82 + wobble * 0.4));
    const fulfilled = Math.round(received * (0.86 + hash(key + "f") * 0.12));
    const onTime = Math.round(fulfilled * (0.88 + hash(key + "o") * 0.11));
    out.push({
      day: d.toLocaleDateString([], { day: "2-digit", month: "short" }),
      received,
      fulfilled,
      onTime,
    });
  }
  // Blend today's live mix into the final point without breaking the scale.
  const last = out[out.length - 1];
  const dispatched = state.orders.filter((o) => o.stage === "Dispatched").length;
  const onTimeRatio = dispatched
    ? state.orders.filter((o) => o.stage === "Dispatched" && !o.atRisk).length / dispatched
    : 0.9;
  if (last) {
    last.fulfilled = Math.round(last.received * Math.max(0.6, dispatched / Math.max(1, state.orders.length) + 0.55));
    last.onTime = Math.round(last.fulfilled * Math.max(0.6, onTimeRatio));
  }
  return out;
}

export function inventoryHealth(state: WfState) {
  const buckets: Record<string, number> = {
    Healthy: 0,
    "Low Stock": 0,
    Critical: 0,
    "Out of Stock": 0,
    Overstock: 0,
  };
  state.products.forEach((p) => {
    buckets[stockStatus(p)] = (buckets[stockStatus(p)] ?? 0) + 1;
  });
  const colors: Record<string, string> = {
    Healthy: "var(--color-success)",
    "Low Stock": "var(--color-warning)",
    Critical: "var(--color-destructive)",
    "Out of Stock": "var(--color-destructive)",
    Overstock: "var(--color-info)",
  };
  return Object.entries(buckets)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value, fill: colors[name] ?? "var(--color-muted-foreground)" }));
}

export function pipelineData(state: WfState) {
  const c = {
    Created: 0,
    Allocated: 0,
    Picking: 0,
    Packing: 0,
    QC: 0,
    Dispatch: 0,
  };
  state.orders.forEach((o) => {
    if (o.stage === "Created" || o.stage === "Prioritized") c.Created++;
    else if (o.stage === "Allocated") c.Allocated++;
    else if (o.stage === "Picking") c.Picking++;
    else if (o.stage === "Packed") c.Packing++;
    else if (o.stage === "QC") c.QC++;
    else c.Dispatch++;
  });
  const capacity: Record<string, number> = {
    Created: 40,
    Allocated: 25,
    Picking: 18,
    Packing: 14,
    QC: 12,
    Dispatch: 20,
  };
  return Object.entries(c).map(([stage, orders]) => ({
    stage,
    orders,
    capacity: capacity[stage] ?? 20,
    utilisation: Math.round((orders / (capacity[stage] ?? 20)) * 100),
  }));
}

export function productivityData(state: WfState) {
  return state.employees
    .filter((e) => ["Picker", "Packer", "QC Operator"].includes(e.role))
    .map((e) => ({
      name: e.name.split(" ")[0] ?? e.name,
      tasks: e.tasksCompleted,
      efficiency: e.efficiency,
    }))
    .sort((a, b) => b.tasks - a.tasks)
    .slice(0, 8);
}

export interface Insight {
  severity: "Critical" | "High" | "Normal";
  title: string;
  detail: string;
  action: string;
}

/** Rule-based bottleneck analysis with automated recommendations. */
export function bottleneckInsights(state: WfState): Insight[] {
  const out: Insight[] = [];
  const blocked = state.pickTasks.filter((t) => t.status === "Blocked").length;
  const pickQueue = state.pickTasks.filter((t) => t.status !== "Completed").length;
  const qcQueue = state.orders.filter((o) => o.stage === "QC" && o.qc !== "Passed").length;
  const dispatchQueue = state.orders.filter((o) => o.stage === "QC" && o.qc === "Passed").length;
  const atRisk = state.orders.filter((o) => o.atRisk && o.stage !== "Dispatched").length;
  const lowSkus = state.products.filter((p) => ["Critical", "Out of Stock"].includes(stockStatus(p))).length;
  const unalloc = state.orders.filter((o) => o.allocation === "Unallocated" && o.stage !== "Dispatched").length;
  const insideVehicles = state.gateEvents.filter((g) => g.status === "Inside").length;
  const waitingInbound = state.inbound.filter((s) => s.status === "Arrived" || s.status === "At Dock").length;

  if (pickQueue > 6)
    out.push({
      severity: pickQueue > 12 ? "Critical" : "High",
      title: "Picking is the constraining stage",
      detail: `${pickQueue} pick tasks are open against a sustainable queue of 6. Downstream packing is starved while Zone C accumulates work.`,
      action: "Reassign 2 pickers from Zone A to Zone C and batch multi-line orders.",
    });
  if (blocked > 0)
    out.push({
      severity: "Critical",
      title: `${blocked} pick task(s) blocked on missing stock`,
      detail: "Blocked picks hold reserved inventory and stall the linked orders entirely.",
      action: "Run a cycle count at the flagged locations and substitute from overflow racks.",
    });
  if (unalloc > 3)
    out.push({
      severity: "High",
      title: `${unalloc} orders waiting on allocation`,
      detail: "Unallocated orders never enter the pick wave, so the queue reads artificially healthy downstream.",
      action: "Run the allocation engine and accept the recommended split for the top scoring orders.",
    });
  if (qcQueue > 3)
    out.push({
      severity: "High",
      title: "QC accumulation before dispatch",
      detail: `${qcQueue} packed orders are awaiting quality verification.`,
      action: "Open QC-2 for the next 60 minutes and move one packer to inspection.",
    });
  if (dispatchQueue > 3)
    out.push({
      severity: "Normal",
      title: "Dispatch handover lagging",
      detail: `${dispatchQueue} orders have passed QC but have not left the dock.`,
      action: "Consolidate into the next carrier run and pre-print labels.",
    });
  if (lowSkus > 0)
    out.push({
      severity: lowSkus > 4 ? "Critical" : "High",
      title: `${lowSkus} SKUs at or below critical cover`,
      detail: "Stock-outs on these SKUs will force backorders on incoming demand.",
      action: "Raise purchase requests from the replenishment planner today.",
    });
  if (atRisk > 0)
    out.push({
      severity: "Critical",
      title: `${atRisk} orders at risk of breaching SLA`,
      detail: "Promised times fall inside the remaining processing window.",
      action: "Escalate to expedited picking and prioritise on the next wave.",
    });
  if (waitingInbound > 0)
    out.push({
      severity: "Normal",
      title: `${waitingInbound} inbound vehicle(s) waiting to be unloaded`,
      detail: `${insideVehicles} vehicles are currently inside the facility; dock turnaround time is rising.`,
      action: "Assign a receiving team to the oldest arrival and release the dock.",
    });

  if (out.length === 0)
    out.push({
      severity: "Normal",
      title: "No structural bottleneck detected",
      detail: "Every stage is operating inside its queue threshold.",
      action: "Maintain current staffing and monitor the next wave.",
    });

  return out.sort(
    (a, b) =>
      ({ Critical: 0, High: 1, Normal: 2 })[a.severity] - ({ Critical: 0, High: 1, Normal: 2 })[b.severity],
  );
}

export const GATES: GateId[] = ["NORTH GATE", "SOUTH GATE"];

export function gateStats(state: WfState) {
  return GATES.map((gate) => {
    const events = state.gateEvents.filter((g) => g.gate === gate);
    const inside = events.filter((g) => g.status === "Inside");
    const today = events.filter((g) => Date.now() - new Date(g.entryAt).getTime() < 86400000);
    const durations = events
      .filter((g) => g.exitAt)
      .map((g) => (new Date(g.exitAt!).getTime() - new Date(g.entryAt).getTime()) / 60000);
    const avgDwell = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;
    return {
      gate,
      inside: inside.length,
      entriesToday: today.length,
      exitsToday: today.filter((g) => g.exitAt).length,
      inbound: events.filter((g) => g.purpose === "Inbound").length,
      outbound: events.filter((g) => g.purpose === "Outbound").length,
      avgDwell,
      events,
    };
  });
}

