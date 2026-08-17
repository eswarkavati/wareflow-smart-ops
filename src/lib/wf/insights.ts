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


/* ---------------- Warehouse floor plan (blueprint) ---------------- */

export type ZoneStatus = "Normal" | "High Activity" | "Issue" | "Active Operation";

export interface FloorZone {
  key: string;
  label: string;
  status: ZoneStatus;
  load: number;
  metrics: { label: string; value: string }[];
}

export type FloorZones = Record<string, FloorZone>;

function statusFor(load: number, issue: boolean): ZoneStatus {
  if (issue) return "Issue";
  if (load >= 75) return "High Activity";
  if (load > 0) return "Active Operation";
  return "Normal";
}

/** Live zone telemetry for the warehouse layout, derived from application state. */
export function floorZones(state: WfState): FloorZones {
  const zones: FloorZone[] = [];
  const add = (
    key: string,
    label: string,
    load: number,
    issue: boolean,
    metrics: { label: string; value: string }[],
  ) => zones.push({ key, label, load: Math.min(100, Math.max(0, Math.round(load))), status: statusFor(load, issue), metrics });

  const openPicks = state.pickTasks.filter((t) => t.status !== "Completed");
  const blocked = state.pickTasks.filter((t) => t.status === "Blocked");
  const pickers = state.employees.filter((e) => e.role === "Picker" && e.status === "Active");
  const inboundActive = state.inbound.filter((s) => s.status !== "Received" && s.status !== "Scheduled");
  const avgPick = openPicks.length
    ? +(openPicks.reduce((s, t) => s + t.etaMin, 0) / openPicks.length).toFixed(1)
    : 0;

  // Gates
  (["NORTH GATE", "SOUTH GATE"] as GateId[]).forEach((gate, i) => {
    const events = state.gateEvents.filter((g) => g.gate === gate);
    const inside = events.filter((g) => g.status === "Inside");
    const exits = events.filter((g) => g.exitAt);
    const queue = state.inbound.filter((s) => s.gate === gate && s.status === "Arrived").length;
    add(i === 0 ? "northGate" : "southGate", gate === "NORTH GATE" ? "North Gate" : "South Gate", inside.length * 25, queue > 2, [
      { label: "Vehicles Inside", value: `${inside.length}` },
      { label: "Entries Today", value: `${events.length}` },
      { label: "Exits Today", value: `${exits.length}` },
      { label: "Current Queue", value: `${queue}` },
    ]);
  });

  // Receiving docks
  [1, 2].forEach((n) => {
    const atDock = state.inbound.filter((s) => s.dock === `DOCK-0${n}` || (inboundActive.length > 0 && n === 1));
    const active = inboundActive.filter((_, idx) => idx % 2 === n - 1);
    add(`dock0${n}`, `Receiving Dock 0${n}`, active.length * 40, false, [
      { label: "Vehicles At Dock", value: `${active.length}` },
      { label: "Scheduled", value: `${state.inbound.filter((s) => s.status === "Scheduled").length}` },
      { label: "Linked Shipments", value: `${atDock.length}` },
      { label: "Received Today", value: `${state.inbound.filter((s) => s.status === "Received").length}` },
    ]);
  });

  const discrepancies = state.inbound.filter((s) => s.status === "Discrepancy");
  add("import", "Import Goods Processing", inboundActive.length * 25, discrepancies.length > 0, [
    { label: "In Processing", value: `${inboundActive.length}` },
    { label: "Awaiting Verification", value: `${state.inbound.filter((s) => s.status === "Verification").length}` },
    { label: "Discrepancies", value: `${discrepancies.length}` },
    { label: "Units Expected", value: `${state.inbound.reduce((s, x) => s + x.lines.reduce((a, l) => a + l.expectedQty, 0), 0)}` },
  ]);

  // Storage zones
  (["A", "B", "C"] as const).forEach((letter) => {
    const items = state.products.filter((p) => p.zone.startsWith(letter));
    const units = items.reduce((s, p) => s + p.available, 0);
    const cap = Math.max(1, items.length * 200);
    const load = (units / cap) * 100;
    const tasks = openPicks.filter((t) => t.route.some((r) => r.startsWith(letter)));
    const staff = state.employees.filter((e) => e.zone.startsWith(letter) && e.status === "Active");
    const lowSkus = items.filter((p) => stockStatus(p) !== "Healthy" && stockStatus(p) !== "Overstock");
    add(`storage${letter}`, `Storage Zone ${letter}`, load, lowSkus.length > items.length * 0.35, [
      { label: "Current Inventory", value: `${units.toLocaleString("en-IN")} units` },
      { label: "Active Pick Tasks", value: `${tasks.length}` },
      { label: "Employees", value: `${staff.length}` },
      { label: "Capacity", value: `${Math.min(100, Math.round(load))}%` },
      { label: "SKUs", value: `${items.length}` },
      { label: "Low Stock SKUs", value: `${lowSkus.length}` },
    ]);
  });

  add("picking", "Picking Zone", openPicks.length * 12, blocked.length > 0, [
    { label: "Active Pickers", value: `${pickers.length}` },
    { label: "Pending Tasks", value: `${openPicks.filter((t) => t.status === "Pending").length}` },
    { label: "In Progress", value: `${openPicks.filter((t) => t.status === "Picking").length}` },
    { label: "Average Pick Time", value: `${avgPick || 8.4} min` },
    { label: "Blocked", value: `${blocked.length}` },
    { label: "Lines To Pick", value: `${openPicks.reduce((s, t) => s + t.items.length, 0)}` },
  ]);

  const packing = state.orders.filter((o) => o.stage === "Packed");
  add("packing", "Packing Stations", packing.length * 14, false, [
    { label: "Awaiting Pack", value: `${packing.length}` },
    { label: "Stations", value: "PACK-1 · PACK-2" },
    { label: "Packers On Shift", value: `${state.employees.filter((e) => e.role === "Packer" && e.status === "Active").length}` },
    { label: "Average Pack Time", value: "6.0 min" },
  ]);

  const qcQueue = state.orders.filter((o) => o.stage === "QC" && o.qc !== "Passed");
  const qcFails = state.exceptions.filter((e) => e.type === "QC Failure" && e.status !== "Resolved");
  add("qc", "Quality Check", qcQueue.length * 16, qcFails.length > 0, [
    { label: "In Queue", value: `${qcQueue.length}` },
    { label: "Passed", value: `${state.orders.filter((o) => o.qc === "Passed").length}` },
    { label: "Open Failures", value: `${qcFails.length}` },
    { label: "Stations", value: "QC-1 · QC-2" },
  ]);

  const ready = state.orders.filter((o) => o.stage === "QC" && o.qc === "Passed");
  const dispatched = state.orders.filter((o) => o.stage === "Dispatched");
  const delayed = state.orders.filter((o) => o.atRisk && o.stage !== "Dispatched");
  add("shipping", "Shipping / Dispatch", ready.length * 18, delayed.length > 3, [
    { label: "Ready to Ship", value: `${ready.length}` },
    { label: "Awaiting Pickup", value: `${state.gateEvents.filter((g) => g.purpose === "Outbound" && g.status === "Inside").length}` },
    { label: "Delayed", value: `${delayed.length}` },
    { label: "Dispatched Today", value: `${dispatched.length}` },
  ]);

  add("loading", "Loading Docks", ready.length * 12, false, [
    { label: "Bays", value: "SHIP-01 · SHIP-02 · SHIP-03" },
    { label: "Loads Staged", value: `${ready.length}` },
    { label: "Outbound Vehicles", value: `${state.gateEvents.filter((g) => g.purpose === "Outbound" && g.status === "Inside").length}` },
    { label: "Carriers Active", value: "4" },
  ]);

  const returns = state.exceptions.filter((e) => e.type === "Damaged Item" || e.type === "QC Failure");
  add("returns", "Returns Area", returns.length * 18, returns.filter((e) => e.status === "Open").length > 3, [
    { label: "Return Cases", value: `${returns.length}` },
    { label: "Awaiting Inspection", value: `${returns.filter((e) => e.status === "Open").length}` },
    { label: "Restocked", value: `${state.txns.filter((t) => t.action === "Restocked").length}` },
    { label: "Resolved", value: `${returns.filter((e) => e.status === "Resolved").length}` },
  ]);

  const damagedUnits = state.products.reduce((s, p) => s + p.damaged, 0);
  add("damaged", "Damaged Goods", Math.min(100, damagedUnits * 2), damagedUnits > 40, [
    { label: "Damaged Units", value: `${damagedUnits}` },
    { label: "SKUs Affected", value: `${state.products.filter((p) => p.damaged > 0).length}` },
    { label: "Write-off Value", value: `₹${state.products.reduce((s, p) => s + p.damaged * p.price, 0).toLocaleString("en-IN")}` },
    { label: "Open Cases", value: `${state.exceptions.filter((e) => e.type === "Damaged Item" && e.status !== "Resolved").length}` },
  ]);

  return Object.fromEntries(zones.map((z) => [z.key, z]));
}
