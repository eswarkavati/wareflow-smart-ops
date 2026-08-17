import type { WfState } from "./types";

let seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}${(seq++).toString(36)}`;

function pick<T>(arr: T[], n: number): T[] {
  return arr.slice(0, Math.max(0, n));
}

/**
 * Controlled operational simulation applied on each automatic refresh.
 * Moves a small, realistic slice of work forward so the warehouse feels live
 * without values jumping around. Mutates the supplied draft in place.
 */
export function simulateOperations(draft: WfState) {
  const now = new Date().toISOString();
  const stamp = (action: string, entity: string, from?: string, to?: string) =>
    draft.audit.unshift({ id: uid("AUD"), ts: now, user: "System (auto-sync)", action, entity, from, to });

  // 1. Pick tasks progress
  pick(
    draft.pickTasks.filter((t) => t.status === "Pending"),
    1,
  ).forEach((t) => {
    t.status = "Picking";
    const order = draft.orders.find((o) => o.id === t.orderId);
    if (order && order.stage === "Allocated") order.stage = "Picking";
    stamp("Picking Started", t.orderId, "Pending", "Picking");
  });

  pick(
    draft.pickTasks.filter((t) => t.status === "Picking"),
    1,
  ).forEach((t) => {
    t.items.forEach((i) => (i.picked = true));
    t.status = "Completed";
    const order = draft.orders.find((o) => o.id === t.orderId);
    if (order && (order.stage === "Picking" || order.stage === "Allocated")) {
      order.stage = "Packed";
      order.items.forEach((it) => (it.picked = it.allocated));
      stamp("Order Packed", order.id, "Picking", "Packed");
    }
  });

  // 2. Packed -> QC
  pick(
    draft.orders.filter((o) => o.stage === "Packed"),
    1,
  ).forEach((o) => {
    o.stage = "QC";
    o.qc = "Needs Review";
    stamp("Sent to Quality Control", o.id, "Packed", "QC");
  });

  // 3. QC pass
  pick(
    draft.orders.filter((o) => o.stage === "QC" && o.qc !== "Passed"),
    1,
  ).forEach((o) => {
    o.qc = "Passed";
    stamp("QC Passed", o.id, "Needs Review", "Passed");
  });

  // 4. Dispatch a QC-passed order
  pick(
    draft.orders.filter((o) => o.stage === "QC" && o.qc === "Passed"),
    1,
  ).forEach((o) => {
    o.stage = "Dispatched";
    o.tracking = o.tracking ?? `${o.carrier.slice(0, 3).toUpperCase()}${Math.floor(Math.random() * 900000 + 100000)}`;
    o.items.forEach((it) => {
      const p = draft.products.find((x) => x.sku === it.sku);
      if (p) p.reserved = Math.max(0, p.reserved - it.allocated);
    });
    draft.txns.unshift({
      id: uid("TX"),
      ts: now,
      sku: o.items[0]?.sku ?? "",
      action: "Released",
      qty: -o.items.reduce((s, i) => s + i.allocated, 0),
      reference: o.id,
      employee: "System (auto-sync)",
    });
    stamp("Order Dispatched", o.id, "QC", "Dispatched");
    draft.notifications.unshift({
      id: uid("N"),
      ts: now,
      kind: "info",
      title: `${o.id} dispatched`,
      body: `Handed to ${o.carrier} at the outbound dock.`,
      read: false,
    });
  });

  // 5. Gate movement: release one vehicle that has been inside the longest
  const inside = draft.gateEvents
    .filter((g) => g.status === "Inside")
    .sort((a, b) => a.entryAt.localeCompare(b.entryAt));
  if (inside.length > 2) {
    const g = inside[0]!;
    g.status = "Exited";
    g.exitAt = now;
    stamp("Vehicle Exit", `${g.gate} · ${g.vehicleNo}`, "Inside", "Exited");
  }

  // 6. Inbound shipment progresses towards the dock
  const scheduled = draft.inbound.find((s) => s.status === "Scheduled");
  if (scheduled && inside.length < 6) {
    scheduled.status = "Arrived";
    scheduled.arrivedAt = now;
    draft.gateEvents.unshift({
      id: uid("GE"),
      gate: scheduled.gate,
      vehicleNo: scheduled.vehicleNo,
      driver: scheduled.driver,
      transporter: scheduled.supplier,
      purpose: "Inbound",
      shipmentId: scheduled.id,
      entryAt: now,
      status: "Inside",
      guard: "Gate Desk (auto)",
    });
    stamp("Vehicle Entry", `${scheduled.gate} · ${scheduled.vehicleNo}`, "Scheduled", "Arrived");
  }

  // 7. Gentle demand drift on the fastest moving SKUs
  draft.products
    .filter((p) => p.avgDailyDemand > 20 && p.available > 0)
    .slice(0, 4)
    .forEach((p) => {
      const consumed = Math.max(1, Math.round(p.avgDailyDemand / 24));
      p.available = Math.max(0, p.available - consumed);
    });

  // 8. Close out one exception that has been in review
  const inReview = draft.exceptions.find((e) => e.status === "In Review");
  if (inReview) {
    inReview.status = "Resolved";
    inReview.resolution = "Auto-closed after operational verification during sync.";
    stamp("Exception Resolved", inReview.id, "In Review", "Resolved");
  }

  draft.updatedAt = now;
}
