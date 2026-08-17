import type { Order, Priority, Product, Role, WfState } from "./types";

export function minutesUntil(iso: string) {
  return Math.round((new Date(iso).getTime() - Date.now()) / 60000);
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function fmtAgo(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function inr(v: number) {
  return `₹${v.toLocaleString("en-IN")}`;
}

/** Smart priority engine: explainable scoring. */
export function scoreOrder(
  order: Order,
  products: Product[],
): { score: number; priority: Priority; reasons: string[]; atRisk: boolean } {
  const reasons: string[] = [];
  const mins = minutesUntil(order.promisedAt);

  let sla = 0;
  if (mins < 0) {
    sla = 40;
    reasons.push(`SLA breached ${Math.abs(mins)} min ago (+40)`);
  } else if (mins <= 60) {
    sla = 38;
    reasons.push(`SLA expires in ${mins} minutes (+38)`);
  } else if (mins <= 180) {
    sla = 26;
    reasons.push(`SLA due in ${Math.round(mins / 60)}h (+26)`);
  } else {
    sla = 10;
    reasons.push(`Comfortable SLA window (+10)`);
  }

  const tier = order.customerTier === "Prime" ? 18 : order.customerTier === "Business" ? 12 : 5;
  reasons.push(`${order.customerTier} customer (+${tier})`);

  const ageH = Math.max(0, (Date.now() - new Date(order.createdAt).getTime()) / 3600000);
  const age = Math.min(12, Math.round(ageH * 2));
  reasons.push(`Order age ${ageH.toFixed(1)}h (+${age})`);

  const ship = order.shipping === "Express" ? 16 : order.shipping === "Standard" ? 8 : 3;
  reasons.push(`${order.shipping} shipping (+${ship})`);

  const shortfall = order.items.some((it) => {
    const p = products.find((x) => x.sku === it.sku);
    return !p || p.available < it.qty - it.allocated;
  });
  const feas = shortfall ? 4 : 12;
  reasons.push(shortfall ? "Inventory shortfall detected (+4)" : "Inventory fully available (+12)");

  const val = order.value > 20000 ? 8 : order.value > 8000 ? 5 : 2;
  reasons.push(`Order value ${inr(order.value)} (+${val})`);

  const score = Math.min(100, sla + tier + age + ship + feas + val);
  const priority: Priority =
    score >= 90 ? "CRITICAL" : score >= 70 ? "HIGH" : score >= 40 ? "NORMAL" : "LOW";
  const atRisk =
    order.stage !== "Dispatched" && (mins < 0 || (mins <= 90 && order.stage !== "Packed"));

  return { score, priority, reasons, atRisk };
}

export interface AllocationPlan {
  orderId: string;
  lines: {
    sku: string;
    name: string;
    required: number;
    available: number;
    allocate: number;
    backorder: number;
  }[];
  competing: { orderId: string; sku: string; qty: number; priority: Priority }[];
  confidence: number;
  rationale: string[];
  outcome: "Full" | "Partial" | "Blocked";
}

/** Smart allocation: decides how scarce stock should be split across competing orders. */
export function allocationPlan(order: Order, state: WfState): AllocationPlan {
  const lines = order.items.map((it) => {
    const p = state.products.find((x) => x.sku === it.sku);
    const required = it.qty - it.allocated;
    const available = p?.available ?? 0;
    const allocate = Math.max(0, Math.min(required, available));
    return { sku: it.sku, name: it.name, required, available, allocate, backorder: required - allocate };
  });

  const competing = state.orders
    .filter(
      (o) =>
        o.id !== order.id &&
        o.allocation !== "Allocated" &&
        o.stage === "Created" &&
        o.items.some((it) => order.items.some((x) => x.sku === it.sku)),
    )
    .flatMap((o) =>
      o.items
        .filter((it) => order.items.some((x) => x.sku === it.sku))
        .map((it) => ({ orderId: o.id, sku: it.sku, qty: it.qty, priority: o.priority })),
    );

  const rationale: string[] = [];
  const short = lines.filter((l) => l.backorder > 0);
  if (short.length === 0) rationale.push("All requested lines are fully available in stock.");
  short.forEach((l) =>
    rationale.push(`${l.sku}: ${l.available} of ${l.required} units available — partial fulfilment possible.`),
  );
  rationale.push(`Priority ${order.priority} (score ${order.score}/100).`);
  if (competing.length)
    rationale.push(
      `${competing.length} lower-or-equal priority order line(s) compete for the same SKUs and can absorb the delay.`,
    );
  if (short.length) rationale.push("Backorder raised for the residual quantity; supplier lead time applies.");

  const outcome: AllocationPlan["outcome"] =
    lines.every((l) => l.allocate === l.required) ? "Full" : lines.some((l) => l.allocate > 0) ? "Partial" : "Blocked";

  const base = outcome === "Full" ? 96 : outcome === "Partial" ? 88 : 62;
  const confidence = Math.max(
    55,
    Math.min(99, base + (order.priority === "CRITICAL" ? 6 : 0) - competing.length),
  );

  return { orderId: order.id, lines, competing, confidence, rationale, outcome };
}

export function replenishmentFor(p: Product) {
  const target = Math.round(p.avgDailyDemand * p.leadTimeDays + p.safetyStock);
  const onHand = p.available;
  const recommended = Math.max(0, target - onHand);
  return { target, recommended: Math.ceil(recommended / 4) * 4 };
}

export function stockStatus(p: Product) {
  if (p.available === 0) return "Out of Stock" as const;
  if (p.available <= p.reorderPoint * 0.5) return "Critical" as const;
  if (p.available <= p.reorderPoint) return "Low Stock" as const;
  if (p.available > p.reorderPoint * 6) return "Overstock" as const;
  return "Healthy" as const;
}

export function stageCounts(orders: Order[]) {
  const c = { Created: 0, Allocated: 0, Picking: 0, Packed: 0, QC: 0, Dispatched: 0 };
  orders.forEach((o) => {
    if (o.stage === "Prioritized") c.Created++;
    else c[o.stage as keyof typeof c]++;
  });
  return c;
}

export function bottleneck(state: WfState) {
  const picking = state.pickTasks.filter((t) => t.status !== "Completed").length;
  const stages = [
    { stage: "Picking", minutes: 12 + Math.min(6, picking / 3), queue: picking },
    { stage: "Packing", minutes: 6, queue: state.orders.filter((o) => o.stage === "Picking").length },
    { stage: "QC", minutes: 3, queue: state.orders.filter((o) => o.stage === "Packed").length },
    { stage: "Dispatch", minutes: 5, queue: state.orders.filter((o) => o.stage === "QC").length },
  ];
  const worst = [...stages].sort((a, b) => b.minutes - a.minutes)[0]!;
  return {
    stages,
    worst,
    detail:
      worst.stage === "Picking"
        ? "Zone C processing time increased by 22% against the warehouse baseline."
        : `${worst.stage} queue is above the operating threshold.`,
    recommendation:
      worst.stage === "Picking"
        ? "Reassign 2 pickers from Zone A to Zone C."
        : `Add one operator to ${worst.stage} for the next 60 minutes.`,
  };
}

export function healthScore(state: WfState) {
  const lowSkus = state.products.filter((p) => stockStatus(p) !== "Healthy" && stockStatus(p) !== "Overstock").length;
  const openExc = state.exceptions.filter((e) => e.status !== "Resolved").length;
  const atRisk = state.orders.filter((o) => o.atRisk && o.stage !== "Dispatched").length;
  const inventory = Math.max(40, 100 - lowSkus * 3);
  const picking = Math.max(40, 100 - state.pickTasks.filter((t) => t.status === "Blocked").length * 12 - atRisk);
  const packing = Math.max(40, 100 - state.orders.filter((o) => o.stage === "Picking").length * 3);
  const dispatch = Math.max(40, 100 - state.orders.filter((o) => o.stage === "QC").length * 4);
  const score = Math.round((inventory + picking + packing + dispatch) / 4 - openExc);
  const band = (v: number) => (v >= 85 ? "Healthy" : v >= 70 ? "Warning" : "Critical");
  return {
    score: Math.max(0, Math.min(100, score)),
    label: band(score),
    parts: [
      { name: "Inventory", value: inventory, label: band(inventory) },
      { name: "Picking", value: picking, label: band(picking) },
      { name: "Packing", value: packing, label: band(packing) },
      { name: "Dispatch", value: dispatch, label: band(dispatch) },
    ],
  };
}

/* ---------------- Role based access ---------------- */

export const NAV_KEYS = [
  "overview",
  "orders",
  "inventory",
  "allocation",
  "picking",
  "packing",
  "shipping",
  "gate-entry",
  "exceptions",
  "replenishment",
  "analytics",
  "employees",
  "users",
  "audit",
  "settings",
] as const;
export type NavKey = (typeof NAV_KEYS)[number];

const ACCESS: Record<Role, NavKey[] | "all"> = {
  Admin: "all",
  "Warehouse Manager": [
    "overview",
    "orders",
    "inventory",
    "allocation",
    "picking",
    "packing",
    "shipping",
    "gate-entry",
    "exceptions",
    "replenishment",
    "analytics",
    "employees",
    "audit",
  ],
  "Inventory Manager": ["overview", "inventory", "allocation", "replenishment", "exceptions", "analytics", "audit"],
  "Picking Manager": ["overview", "orders", "picking", "exceptions", "employees", "analytics"],
  "Packing Manager": ["overview", "orders", "packing", "exceptions", "analytics"],
  "QC Manager": ["overview", "packing", "exceptions", "analytics"],
  Dispatcher: ["overview", "shipping", "gate-entry", "orders", "exceptions"],
  "Gate Manager": ["overview", "gate-entry", "shipping", "exceptions"],
  Picker: ["overview", "picking"],
  Packer: ["overview", "packing"],
  "QC Operator": ["overview", "packing"],
};

export function canAccess(role: Role | undefined, key: NavKey) {
  if (!role) return false;
  const a = ACCESS[role];
  return a === "all" || a.includes(key);
}
