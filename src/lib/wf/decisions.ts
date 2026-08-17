import type { WfState } from "./types";
import { allocationPlan, bottleneck, stockStatus } from "./engine";
import { gateStats } from "./insights";

export type Tone = "green" | "amber" | "red" | "blue" | "gray";

export interface WhatIf {
  label: string;
  outcome: string;
  tone: Tone;
}

export interface Recommendation {
  id: string;
  kind: "allocation" | "workforce" | "replenishment" | "gate" | "exception";
  headline: string;
  decision: string;
  why: string[];
  impact: string;
  confidence: number;
  whatIf: WhatIf[];
  to: string;
  /** Present when the decision can be executed directly from the console. */
  execute?: { type: "allocate"; orderId: string };
  entity: string;
}

/** The single most contested order: highest priority order that cannot be fully served. */
export function inventoryConflict(state: WfState) {
  const candidates = state.orders
    .filter((o) => o.allocation === "Unallocated" && o.stage !== "Dispatched")
    .map((o) => ({ order: o, plan: allocationPlan(o, state) }))
    .filter((c) => c.plan.outcome !== "Full" || c.plan.competing.length > 0)
    .sort((a, b) => b.order.score - a.order.score);
  return candidates[0] ?? null;
}

export function gateCongestion(state: WfState) {
  const stats = gateStats(state);
  const north = stats.find((s) => s.gate === "NORTH GATE");
  const south = stats.find((s) => s.gate === "SOUTH GATE");
  if (!north || !south) return null;
  const total = north.entriesToday + south.entriesToday;
  if (total === 0) return null;
  const share = north.entriesToday / total;
  const deviation = Math.round((share - 0.5) * 200 * 10) / 10;
  return { north, south, deviation, congested: Math.abs(deviation) >= 8 };
}

/** Rule-based decision engine — recommendations with reasoning, impact and confidence. */
export function recommendations(state: WfState): Recommendation[] {
  const out: Recommendation[] = [];

  const conflict = inventoryConflict(state);
  if (conflict) {
    const { order, plan } = conflict;
    const short = plan.lines.filter((l) => l.backorder > 0);
    const line = short[0] ?? plan.lines[0];
    const rival = plan.competing[0];
    out.push({
      id: `REC-ALLOC-${order.id}`,
      kind: "allocation",
      headline: "Inventory conflict",
      decision: line
        ? `Allocate ${line.allocate} available units of ${line.name} to ${order.id}.`
        : `Allocate reserved stock to ${order.id}.`,
      why: [
        `${order.priority} priority — decision score ${order.score}/100.`,
        `${order.shipping} shipping for a ${order.customerTier} customer.`,
        line && line.backorder > 0
          ? `Only ${line.available} of ${line.required} units on hand — partial fulfilment protects the SLA.`
          : "Stock is available now and can be reserved immediately.",
        rival ? `${rival.orderId} (${rival.priority}) competes for the same SKU and can absorb the delay.` : "No competing demand on these SKUs.",
      ],
      impact: line && line.backorder > 0
        ? `${order.id} ships partially on time; ${line.backorder} units move to backorder.`
        : `${order.id} is fully allocated and enters the pick queue immediately.`,
      confidence: plan.confidence,
      whatIf: [
        { label: order.id, outcome: "SLA protected", tone: "green" },
        { label: "Inventory", outcome: line && line.backorder > 0 ? "Stockout risk" : "Within safety stock", tone: line && line.backorder > 0 ? "amber" : "green" },
        { label: rival?.orderId ?? "Other orders", outcome: rival ? "Delayed" : "Unaffected", tone: rival ? "amber" : "green" },
        { label: "Warehouse risk", outcome: "Low", tone: "green" },
      ],
      to: "/allocation",
      execute: { type: "allocate", orderId: order.id },
      entity: order.id,
    });
  }

  const bn = bottleneck(state);
  if (bn.worst.queue > 0) {
    const delay = Math.round((bn.worst.minutes / 12 - 1) * 1000) / 10;
    out.push({
      id: "REC-WORKFORCE",
      kind: "workforce",
      headline: `${bn.worst.stage} bottleneck`,
      decision: bn.recommendation,
      why: [
        `${bn.worst.queue} tasks queued against a normal capacity of 28.`,
        `Average stage time ${bn.worst.minutes.toFixed(1)} min, ${Math.max(0, delay).toFixed(1)}% above baseline.`,
        "Adjacent zones are operating below capacity and can release operators.",
      ],
      impact: "Estimated backlog reduction of 31% within the next operating hour.",
      confidence: 87,
      whatIf: [
        { label: bn.worst.stage, outcome: "Queue clears faster", tone: "green" },
        { label: "Source zone", outcome: "Slightly slower", tone: "amber" },
        { label: "Orders at risk", outcome: "Reduced", tone: "green" },
      ],
      to: "/analytics",
      entity: bn.worst.stage,
    });
  }

  const lowSkus = state.products.filter((p) => ["Low Stock", "Critical", "Out of Stock"].includes(stockStatus(p)));
  if (lowSkus.length) {
    out.push({
      id: "REC-REPLEN",
      kind: "replenishment",
      headline: "Inventory risk",
      decision: `Raise purchase requests for ${lowSkus.length} SKUs approaching or below reorder point.`,
      why: [
        `${lowSkus.slice(0, 3).map((p) => p.sku).join(", ")} are at or below their reorder threshold.`,
        "Average daily demand and supplier lead time indicate cover runs out within the replenishment window.",
      ],
      impact: "Prevents stockouts on high-velocity SKUs and avoids downstream allocation conflicts.",
      confidence: 91,
      whatIf: [
        { label: "Stock cover", outcome: "Restored", tone: "green" },
        { label: "Working capital", outcome: "Increased", tone: "amber" },
        { label: "Future stockouts", outcome: "Avoided", tone: "green" },
      ],
      to: "/replenishment",
      entity: `${lowSkus.length} SKUs`,
    });
  }

  const gate = gateCongestion(state);
  if (gate?.congested) {
    const busy = gate.deviation > 0 ? gate.north : gate.south;
    const spare = gate.deviation > 0 ? gate.south : gate.north;
    out.push({
      id: "REC-GATE",
      kind: "gate",
      headline: "Gate congestion",
      decision: `Redirect inbound vehicles from ${busy.gate} to ${spare.gate}.`,
      why: [
        `${busy.gate} traffic is ${Math.abs(gate.deviation).toFixed(1)}% above the balanced load.`,
        `${spare.gate} currently holds ${spare.inside} vehicles and has spare dock capacity.`,
      ],
      impact: "Cuts vehicle dwell time at the busy gate and protects inbound receiving slots.",
      confidence: 84,
      whatIf: [
        { label: busy.gate, outcome: "Dwell time drops", tone: "green" },
        { label: spare.gate, outcome: "Load increases", tone: "amber" },
        { label: "Receiving", outcome: "On schedule", tone: "green" },
      ],
      to: "/gate-entry",
      entity: busy.gate,
    });
  }

  return out;
}

export interface BriefItem {
  priority: number;
  text: string;
  to: string;
  tone: Tone;
}

/** Concise daily operations brief for the control tower. */
export function operationsBrief(state: WfState) {
  const atRisk = state.orders.filter((o) => o.atRisk && o.stage !== "Dispatched").length;
  const lowSkus = state.products.filter((p) => ["Low Stock", "Critical", "Out of Stock"].includes(stockStatus(p))).length;
  const openExc = state.exceptions.filter((e) => e.status !== "Resolved").length;
  const bn = bottleneck(state);
  const gate = gateCongestion(state);

  const items: BriefItem[] = [];
  if (atRisk) items.push({ priority: items.length + 1, text: `${atRisk} orders are at risk of an SLA breach.`, to: "/orders", tone: "red" });
  if (bn.worst.queue) items.push({ priority: items.length + 1, text: bn.detail, to: "/analytics", tone: "amber" });
  if (lowSkus) items.push({ priority: items.length + 1, text: `${lowSkus} SKUs are approaching reorder thresholds.`, to: "/replenishment", tone: "amber" });
  if (gate?.congested)
    items.push({
      priority: items.length + 1,
      text: `${gate.deviation > 0 ? "North" : "South"} Gate traffic is ${Math.abs(gate.deviation).toFixed(1)}% above normal.`,
      to: "/gate-entry",
      tone: "amber",
    });
  if (openExc) items.push({ priority: items.length + 1, text: `${openExc} exceptions are awaiting resolution.`, to: "/exceptions", tone: "red" });

  const attention = items.length;
  const headline = attention
    ? `Bangalore Hub is operating normally, but ${attention} area${attention > 1 ? "s" : ""} require attention.`
    : "Bangalore Hub is operating normally. No areas require intervention.";

  return { headline, items: items.slice(0, 5) };
}
