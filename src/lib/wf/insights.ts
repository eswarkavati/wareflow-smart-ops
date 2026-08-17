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
  // Anchor the final day to today's live numbers.
  const last = out[out.length - 1];
  if (last) {
    last.received = state.orders.length;
    last.fulfilled = state.orders.filter((o) => o.stage === "Dispatched").length;
    last.onTime = state.orders.filter((o) => o.stage === "Dispatched" && !o.atRisk).length;
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

/** Zone level activity for the warehouse blueprint. */
export function zoneActivity(state: WfState) {
  const skuZone = (sku: string) => state.products.find((p) => p.sku === sku)?.zone ?? "";
  const inZone = (prefix: string) => state.products.filter((p) => p.zone.startsWith(prefix));

  const picking = state.pickTasks.filter((t) => t.status !== "Completed");
  const packing = state.orders.filter((o) => o.stage === "Packed");
  const qc = state.orders.filter((o) => o.stage === "QC");
  const shipping = state.orders.filter((o) => o.stage === "Dispatched");
  const damagedUnits = state.products.reduce((s, p) => s + p.damaged, 0);
  const returns = state.exceptions.filter((e) => e.type === "Damaged Item" || e.type === "QC Failure");
  const inboundActive = state.inbound.filter((s) => s.status !== "Received" && s.status !== "Scheduled");
  const staff = state.employees.filter((e) => e.status === "Active");

  const storage = (letter: string) => {
    const items = inZone(letter);
    const units = items.reduce((s, p) => s + p.available, 0);
    const cap = Math.max(1, items.length * 200);
    return {
      load: Math.min(100, Math.round((units / cap) * 100)),
      metrics: [
        { label: "SKUs", value: `${items.length}` },
        { label: "Units on hand", value: `${units}` },
        { label: "Low stock SKUs", value: `${items.filter((p) => stockStatus(p) !== "Healthy").length}` },
        { label: "Pick tasks routed", value: `${picking.filter((t) => t.route.some((r) => r.startsWith(letter))).length}` },
      ],
    };
  };

  const pickersActive = state.employees.filter((e) => e.role === "Picker" && e.status === "Active").length;

  return {
    receiving: {
      load: Math.min(100, inboundActive.length * 30),
      metrics: [
        { label: "Vehicles at dock", value: `${inboundActive.length}` },
        { label: "Scheduled today", value: `${state.inbound.filter((s) => s.status === "Scheduled").length}` },
        { label: "Received", value: `${state.inbound.filter((s) => s.status === "Received").length}` },
        { label: "Discrepancies", value: `${state.inbound.filter((s) => s.status === "Discrepancy").length}` },
      ],
    },
    storageA: storage("A"),
    storageB: storage("B"),
    storageC: storage("C"),
    picking: {
      load: Math.min(100, picking.length * 12),
      metrics: [
        { label: "Open tasks", value: `${picking.length}` },
        { label: "Blocked", value: `${picking.filter((t) => t.status === "Blocked").length}` },
        { label: "Active pickers", value: `${pickersActive}` },
        { label: "Lines to pick", value: `${picking.reduce((s, t) => s + t.items.length, 0)}` },
      ],
    },
    packing: {
      load: Math.min(100, packing.length * 14),
      metrics: [
        { label: "Awaiting pack", value: `${packing.length}` },
        { label: "Stations", value: "PACK-1 · PACK-2" },
        { label: "Packers on shift", value: `${state.employees.filter((e) => e.role === "Packer").length}` },
        { label: "Avg pack time", value: "6 min" },
      ],
    },
    qc: {
      load: Math.min(100, qc.length * 16),
      metrics: [
        { label: "In queue", value: `${qc.filter((o) => o.qc !== "Passed").length}` },
        { label: "Passed", value: `${qc.filter((o) => o.qc === "Passed").length}` },
        { label: "Failures open", value: `${state.exceptions.filter((e) => e.type === "QC Failure" && e.status !== "Resolved").length}` },
        { label: "Stations", value: "QC-1 · QC-2" },
      ],
    },
    shipping: {
      load: Math.min(100, state.orders.filter((o) => o.stage === "QC" && o.qc === "Passed").length * 18),
      metrics: [
        { label: "Ready to dispatch", value: `${state.orders.filter((o) => o.stage === "QC" && o.qc === "Passed").length}` },
        { label: "Dispatched today", value: `${shipping.length}` },
        { label: "Carriers active", value: "4" },
        { label: "Outbound vehicles", value: `${state.gateEvents.filter((g) => g.purpose === "Outbound" && g.status === "Inside").length}` },
      ],
    },
    returns: {
      load: Math.min(100, returns.length * 20),
      metrics: [
        { label: "Return cases", value: `${returns.length}` },
        { label: "Awaiting inspection", value: `${returns.filter((e) => e.status === "Open").length}` },
        { label: "Restocked today", value: `${state.txns.filter((t) => t.action === "Restocked").length}` },
        { label: "Linked SKUs", value: `${new Set(returns.map((r) => r.sku ?? skuZone("")).filter(Boolean)).size}` },
      ],
    },
    damaged: {
      load: Math.min(100, damagedUnits * 2),
      metrics: [
        { label: "Damaged units", value: `${damagedUnits}` },
        { label: "SKUs affected", value: `${state.products.filter((p) => p.damaged > 0).length}` },
        { label: "Write-off value", value: `₹${state.products.reduce((s, p) => s + p.damaged * p.price, 0).toLocaleString("en-IN")}` },
        { label: "Open cases", value: `${state.exceptions.filter((e) => e.type === "Damaged Item" && e.status !== "Resolved").length}` },
      ],
    },
    staff: {
      load: Math.min(100, Math.round((staff.length / Math.max(1, state.employees.length)) * 100)),
      metrics: [
        { label: "On shift", value: `${staff.length}` },
        { label: "On break", value: `${state.employees.filter((e) => e.status === "On Break").length}` },
        { label: "Avg efficiency", value: `${Math.round(state.employees.reduce((s, e) => s + e.efficiency, 0) / Math.max(1, state.employees.length))}%` },
        { label: "Total headcount", value: `${state.employees.length}` },
      ],
    },
    northGate: {
      load: Math.min(100, state.gateEvents.filter((g) => g.gate === "NORTH GATE" && g.status === "Inside").length * 30),
      metrics: [
        { label: "Vehicles inside", value: `${state.gateEvents.filter((g) => g.gate === "NORTH GATE" && g.status === "Inside").length}` },
        { label: "Movements logged", value: `${state.gateEvents.filter((g) => g.gate === "NORTH GATE").length}` },
        { label: "Inbound", value: `${state.gateEvents.filter((g) => g.gate === "NORTH GATE" && g.purpose === "Inbound").length}` },
        { label: "Outbound", value: `${state.gateEvents.filter((g) => g.gate === "NORTH GATE" && g.purpose === "Outbound").length}` },
      ],
    },
    southGate: {
      load: Math.min(100, state.gateEvents.filter((g) => g.gate === "SOUTH GATE" && g.status === "Inside").length * 30),
      metrics: [
        { label: "Vehicles inside", value: `${state.gateEvents.filter((g) => g.gate === "SOUTH GATE" && g.status === "Inside").length}` },
        { label: "Movements logged", value: `${state.gateEvents.filter((g) => g.gate === "SOUTH GATE").length}` },
        { label: "Inbound", value: `${state.gateEvents.filter((g) => g.gate === "SOUTH GATE" && g.purpose === "Inbound").length}` },
        { label: "Outbound", value: `${state.gateEvents.filter((g) => g.gate === "SOUTH GATE" && g.purpose === "Outbound").length}` },
      ],
    },
  };
}

export type ZoneActivity = ReturnType<typeof zoneActivity>;
