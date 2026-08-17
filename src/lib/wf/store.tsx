import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { buildSeed, DEMO_ACCOUNTS } from "./seed";
import { allocationPlan, scoreOrder, stockStatus } from "./engine";
import { simulateOperations } from "./simulate";
import type {
  Employee,
  GateEvent,
  GateId,
  InboundShipment,
  Notification,
  Order,
  Product,
  WfException,
  WfState,
} from "./types";

const KEY = "wareflow.state.v1";

let idc = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}${(idc++).toString(36)}`;

interface Ctx {
  state: WfState;
  hydrated: boolean;
  user: Employee | null;
  login: (email: string) => boolean;
  logout: () => void;
  update: (fn: (draft: WfState) => void, opts?: { toast?: string }) => void;
  log: (draft: WfState, action: string, entity: string, from?: string, to?: string) => void;
  notify: (draft: WfState, kind: Notification["kind"], title: string, body: string) => void;
  reseed: () => void;
  // workflows
  acceptAllocation: (orderId: string, overrides?: Record<string, number>) => void;
  backorder: (orderId: string) => void;
  startPicking: (taskId: string) => void;
  markPicked: (taskId: string, sku: string) => void;
  reportMissing: (taskId: string, sku: string) => void;
  completePacking: (orderId: string) => void;
  runQc: (orderId: string, result: "Passed" | "Failed") => void;
  dispatchOrder: (orderId: string) => void;
  resolveException: (id: string, resolution: string) => void;
  setExceptionStatus: (id: string, status: WfException["status"]) => void;
  createReplenishment: (sku: string, qty: number) => void;
  updateEmployee: (id: string, patch: Partial<Employee>) => void;
  markNotification: (id?: string) => void;
  // gate entry & inbound
  recordGateEntry: (payload: {
    gate: GateId;
    vehicleNo: string;
    driver: string;
    transporter: string;
    purpose: GateEvent["purpose"];
    shipmentId?: string;
  }) => void;
  recordGateExit: (id: string) => void;
  advanceInbound: (id: string) => void;
  setInboundReceived: (id: string, sku: string, received: number, damaged: number) => void;
  completeInbound: (id: string) => void;
  // live sync
  lastSyncAt: string;
  nextSyncAt: string;
  syncing: boolean;
  refreshNow: () => void;
}

const SYNC_INTERVAL_MS = 30 * 60 * 1000;
const SIM_INTERVAL_MS = 90 * 1000;

const WfCtx = createContext<Ctx | null>(null);

function rescore(draft: WfState) {
  draft.orders.forEach((o) => Object.assign(o, scoreOrder(o, draft.products)));
  draft.updatedAt = new Date().toISOString();
}

export function WfProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WfState | null>(null);
  const stateRef = useRef<WfState | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState(() => new Date().toISOString());
  const [nextSyncAt, setNextSyncAt] = useState(() => new Date(Date.now() + SYNC_INTERVAL_MS).toISOString());
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let initial: WfState | null = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) initial = JSON.parse(raw) as WfState;
    } catch {
      initial = null;
    }
    if (!initial || !initial.orders?.length) initial = buildSeed();
    if (!initial.inbound || !initial.gateEvents) {
      const fresh = buildSeed();
      initial.inbound = initial.inbound ?? fresh.inbound;
      initial.gateEvents = initial.gateEvents ?? fresh.gateEvents;
      initial.employees = fresh.employees.reduce<typeof fresh.employees>((acc, e) => {
        if (!acc.some((x) => x.id === e.id)) acc.push(e);
        return acc;
      }, [...initial.employees]);
    }
    rescore(initial);
    stateRef.current = initial;
    setState({ ...initial });
  }, []);

  const commit = useCallback((next: WfState) => {
    stateRef.current = next;
    setState({ ...next });
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage full — in-memory state still authoritative */
    }
  }, []);

  const simulate = useCallback(() => {
    const base = stateRef.current;
    if (!base) return;
    const draft: WfState = JSON.parse(JSON.stringify(base));
    simulateOperations(draft);
    rescore(draft);
    commit(draft);
  }, [commit]);

  const refreshNow = useCallback(() => {
    setSyncing(true);
    simulate();
    setLastSyncAt(new Date().toISOString());
    setNextSyncAt(new Date(Date.now() + SYNC_INTERVAL_MS).toISOString());
    window.setTimeout(() => setSyncing(false), 600);
  }, [simulate]);

  // Live operational simulation — small, realistic increments without reloads.
  useEffect(() => {
    if (!state) return;
    const sim = window.setInterval(simulate, SIM_INTERVAL_MS);
    const sync = window.setInterval(() => {
      setSyncing(true);
      simulate();
      setLastSyncAt(new Date().toISOString());
      setNextSyncAt(new Date(Date.now() + SYNC_INTERVAL_MS).toISOString());
      window.setTimeout(() => setSyncing(false), 600);
    }, SYNC_INTERVAL_MS);
    return () => {
      window.clearInterval(sim);
      window.clearInterval(sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!state, simulate]);

  const log: Ctx["log"] = (draft, action, entity, from, to) => {
    draft.audit.unshift({
      id: uid("AUD"),
      ts: new Date().toISOString(),
      user: draft.employees.find((e) => e.id === draft.currentUserId)?.name ?? "System",
      action,
      entity,
      from,
      to,
    });
  };

  const notify: Ctx["notify"] = (draft, kind, title, body) => {
    draft.notifications.unshift({
      id: uid("N"),
      ts: new Date().toISOString(),
      kind,
      title,
      body,
      read: false,
    });
  };

  const update: Ctx["update"] = useCallback(
    (fn, opts) => {
      const base = stateRef.current;
      if (!base) return;
      const draft: WfState = JSON.parse(JSON.stringify(base));
      fn(draft);
      rescore(draft);
      commit(draft);
      if (opts?.toast) toast.success(opts.toast);
    },
    [commit],
  );

  const value = useMemo<Ctx | null>(() => {
    if (!state) return null;
    const user = state.employees.find((e) => e.id === state.currentUserId) ?? null;

    const txn = (
      draft: WfState,
      sku: string,
      action: WfState["txns"][number]["action"],
      qty: number,
      reference: string,
    ) => {
      draft.txns.unshift({
        id: uid("TX"),
        ts: new Date().toISOString(),
        sku,
        action,
        qty,
        reference,
        employee: draft.employees.find((e) => e.id === draft.currentUserId)?.name ?? "System",
      });
    };

    const ctx: Ctx = {
      state,
      hydrated: true,
      user,
      login: (email) => {
        const acc = DEMO_ACCOUNTS.find((a) => a.email === email.trim().toLowerCase());
        const emp =
          state.employees.find((e) => e.id === acc?.id) ??
          state.employees.find((e) => e.email === email.trim().toLowerCase());
        if (!emp) return false;
        update((d) => {
          d.currentUserId = emp.id;
          d.audit.unshift({
            id: uid("AUD"),
            ts: new Date().toISOString(),
            user: emp.name,
            action: "Signed In",
            entity: emp.role,
          });
        });
        return true;
      },
      logout: () => update((d) => void (d.currentUserId = null)),
      update,
      log,
      notify,
      reseed: () => {
        const fresh = buildSeed();
        fresh.currentUserId = stateRef.current?.currentUserId ?? null;
        rescore(fresh);
        commit(fresh);
        toast.success("Demo data reset to baseline");
      },

      acceptAllocation: (orderId, overrides) => {
        update(
          (d) => {
            const o = d.orders.find((x) => x.id === orderId);
            if (!o) return;
            const plan = allocationPlan(o, d);
            let anyShort = false;
            plan.lines.forEach((l) => {
              const qty = overrides?.[l.sku] ?? l.allocate;
              const p = d.products.find((x) => x.sku === l.sku);
              const item = o.items.find((x) => x.sku === l.sku);
              if (!p || !item || qty <= 0) {
                if (l.required > 0) anyShort = true;
                return;
              }
              const take = Math.min(qty, p.available, l.required);
              p.available -= take;
              p.reserved += take;
              item.allocated += take;
              if (item.allocated < item.qty) anyShort = true;
              txn(d, l.sku, "Allocated", -take, orderId);
            });
            o.allocation = anyShort ? "Partial" : "Allocated";
            o.stage = "Allocated";
            const picker = d.employees.filter((e) => e.role === "Picker")[d.pickTasks.length % 6];
            const zoneOf = (sku: string) => d.products.find((p) => p.sku === sku)?.zone ?? "A-12";
            d.pickTasks.unshift({
              id: uid("PT"),
              orderId: o.id,
              picker: picker?.name ?? "Rahul Kumar",
              zone: zoneOf(o.items[0]!.sku),
              route: [...new Set(o.items.map((it) => zoneOf(it.sku)))],
              priority: o.priority,
              etaMin: 5 + o.items.length * 3,
              status: "Pending",
              items: o.items
                .filter((it) => it.allocated > 0)
                .map((it) => ({
                  sku: it.sku,
                  name: it.name,
                  qty: it.allocated,
                  picked: false,
                  location: zoneOf(it.sku),
                })),
            });
            if (anyShort) {
              d.exceptions.unshift({
                id: uid("EXC"),
                type: "Stock Mismatch",
                orderId: o.id,
                problem: `Partial allocation on ${o.id}; residual quantity backordered.`,
                impact: "Order will ship short unless replenished.",
                recommendation: "Raise purchase request for the shortfall SKU.",
                owner: "Sunita Rao",
                slaMin: 120,
                severity: "High",
                status: "Open",
                createdAt: new Date().toISOString(),
              });
            }
            d.exceptions
              .filter((e) => e.orderId === o.id && e.type === "Stock Mismatch" && e.status === "Open")
              .slice(1)
              .forEach((e) => {
                e.status = "Resolved";
                e.resolution = "Allocation decision accepted.";
              });
            const conflict = d.exceptions.find(
              (e) => e.orderId === o.id && e.type === "Stock Mismatch" && e.status === "Open",
            );
            if (conflict && !anyShort) {
              conflict.status = "Resolved";
              conflict.resolution = "Stock allocated in full.";
            }
            log(d, "Inventory Allocated", o.id, "Unallocated", anyShort ? "Partial" : "Allocated");
            notify(d, "info", `Allocation applied to ${o.id}`, "Pick task created and stock reserved.");
          },
          { toast: `Allocation applied to ${orderId}` },
        );
      },

      backorder: (orderId) => {
        update(
          (d) => {
            const o = d.orders.find((x) => x.id === orderId);
            if (!o) return;
            o.allocation = "Backorder";
            d.exceptions.unshift({
              id: uid("EXC"),
              type: "Stock Mismatch",
              orderId: o.id,
              problem: `${o.id} placed on backorder pending replenishment.`,
              impact: "Customer promise date will move.",
              recommendation: "Create purchase request and notify customer.",
              owner: "Sunita Rao",
              slaMin: 240,
              severity: "Normal",
              status: "Open",
              createdAt: new Date().toISOString(),
            });
            log(d, "Order Backordered", o.id, "Unallocated", "Backorder");
          },
          { toast: `${orderId} moved to backorder` },
        );
      },

      startPicking: (taskId) =>
        update(
          (d) => {
            const t = d.pickTasks.find((x) => x.id === taskId);
            if (!t) return;
            t.status = "Picking";
            const o = d.orders.find((x) => x.id === t.orderId);
            if (o) o.stage = "Picking";
            log(d, "Picking Started", t.orderId, "Pending", "Picking");
          },
          { toast: "Picking started" },
        ),

      markPicked: (taskId, sku) =>
        update((d) => {
          const t = d.pickTasks.find((x) => x.id === taskId);
          if (!t) return;
          const line = t.items.find((i) => i.sku === sku);
          if (!line || line.picked) return;
          line.picked = true;
          t.status = "Picking";
          const p = d.products.find((x) => x.sku === sku);
          if (p) p.reserved = Math.max(0, p.reserved - line.qty);
          txn(d, sku, "Picked", -line.qty, t.orderId);
          const o = d.orders.find((x) => x.id === t.orderId);
          if (o) {
            const item = o.items.find((i) => i.sku === sku);
            if (item) item.picked = line.qty;
            o.stage = "Picking";
          }
          if (t.items.every((i) => i.picked)) {
            t.status = "Completed";
            if (o) {
              o.stage = "Packed";
              o.packing = {
                type: o.items.length > 2 ? "Large Box" : "Medium Box",
                weight: Math.round(o.items.reduce((w, i) => w + i.qty * 0.45, 0.3) * 10) / 10,
                station: "PACK-1",
                checklist: [],
              };
            }
            log(d, "Picking Completed", t.orderId, "Picking", "Ready to Pack");
            notify(d, "info", `${t.orderId} picked`, "Order moved to the packing station.");
          }
        }),

      reportMissing: (taskId, sku) =>
        update(
          (d) => {
            const t = d.pickTasks.find((x) => x.id === taskId);
            if (!t) return;
            t.status = "Blocked";
            const line = t.items.find((i) => i.sku === sku);
            const o = d.orders.find((x) => x.id === t.orderId);
            if (o) o.atRisk = true;
            d.exceptions.unshift({
              id: uid("EXC"),
              type: "Missing Item",
              orderId: t.orderId,
              sku,
              problem: `${line?.name ?? sku} not found at ${line?.location ?? t.zone}.`,
              impact: "Pick task blocked; order at risk of partial shipment.",
              recommendation: `Cycle count ${line?.location ?? t.zone} and substitute from overflow rack.`,
              owner: "Vivek Sharma",
              slaMin: 45,
              severity: "High",
              status: "Open",
              createdAt: new Date().toISOString(),
            });
            log(d, "Missing Item Reported", t.orderId, sku, "Exception raised");
            notify(d, "critical", `Missing item on ${t.orderId}`, `${sku} not found during picking.`);
          },
          { toast: "Exception created for missing item" },
        ),

      completePacking: (orderId) =>
        update(
          (d) => {
            const o = d.orders.find((x) => x.id === orderId);
            if (!o) return;
            o.stage = "QC";
            o.qc = "Needs Review";
            o.packing = {
              ...(o.packing ?? { type: "Medium Box", weight: 1.2, station: "PACK-1", checklist: [] }),
              checklist: ["Items scanned", "Quantity verified", "Packaging selected", "Final seal"],
            };
            log(d, "Packing Completed", o.id, "Packed", "QC");
          },
          { toast: `${orderId} sent to quality check` },
        ),

      runQc: (orderId, result) =>
        update(
          (d) => {
            const o = d.orders.find((x) => x.id === orderId);
            if (!o) return;
            o.qc = result;
            if (result === "Passed") {
              o.stage = "QC";
              log(d, "QC Passed", o.id, "Needs Review", "Passed");
            } else {
              o.stage = "Packed";
              o.atRisk = true;
              d.exceptions.unshift({
                id: uid("EXC"),
                type: "QC Failure",
                orderId: o.id,
                problem: `Quality check failed for ${o.id}.`,
                impact: "Dispatch blocked until re-packed and re-verified.",
                recommendation: "Repack order, reprint label and re-run QC checklist.",
                owner: "Imran Sheikh",
                slaMin: 60,
                severity: "High",
                status: "Open",
                createdAt: new Date().toISOString(),
              });
              notify(d, "critical", `QC failed on ${o.id}`, "Order returned to packing.");
              log(d, "QC Failed", o.id, "Needs Review", "Failed");
            }
          },
          { toast: result === "Passed" ? `${orderId} passed QC` : `${orderId} failed QC` },
        ),

      dispatchOrder: (orderId) =>
        update(
          (d) => {
            const o = d.orders.find((x) => x.id === orderId);
            if (!o) return;
            o.stage = "Dispatched";
            o.atRisk = false;
            o.tracking =
              o.tracking ?? `${o.carrier.slice(0, 2).toUpperCase()}${Math.floor(1e8 + Math.random() * 9e8)}`;
            o.items.forEach((it) => {
              const p = d.products.find((x) => x.sku === it.sku);
              if (p) p.reserved = Math.max(0, p.reserved - Math.max(0, it.allocated - it.picked));
              txn(d, it.sku, "Picked", 0, `${o.id} dispatched`);
            });
            log(d, "Order Dispatched", o.id, "QC Passed", `Dispatched via ${o.carrier}`);
            notify(d, "info", `${o.id} dispatched`, `Handover complete — ${o.carrier} ${o.tracking}`);
          },
          { toast: `${orderId} dispatched` },
        ),

      resolveException: (id, resolution) =>
        update(
          (d) => {
            const e = d.exceptions.find((x) => x.id === id);
            if (!e) return;
            e.status = "Resolved";
            e.resolution = resolution;
            if (e.type === "Damaged Item" && e.sku) {
              const p = d.products.find((x) => x.sku === e.sku);
              if (p) {
                p.damaged += 0;
                txn(d, e.sku, "Damaged", -0, e.id);
              }
            }
            const o = d.orders.find((x) => x.id === e.orderId);
            if (o && !d.exceptions.some((x) => x.orderId === o.id && x.status !== "Resolved")) o.atRisk = false;
            log(d, "Exception Resolved", e.id, "Open", resolution);
          },
          { toast: "Exception resolved" },
        ),

      setExceptionStatus: (id, status) =>
        update(
          (d) => {
            const e = d.exceptions.find((x) => x.id === id);
            if (!e) return;
            const prev = e.status;
            e.status = status;
            log(d, status === "In Review" ? "Exception Escalated" : "Exception Updated", e.id, prev, status);
          },
          { toast: "Exception updated" },
        ),

      createReplenishment: (sku, qty) =>
        update(
          (d) => {
            d.replenishments.unshift({
              id: uid("PR"),
              sku,
              qty,
              status: "Requested",
              createdAt: new Date().toISOString(),
              requestedBy: d.employees.find((e) => e.id === d.currentUserId)?.name ?? "System",
            });
            log(d, "Purchase Request Created", sku, undefined, `${qty} units`);
            notify(d, "info", `Purchase request raised`, `${qty} units of ${sku} requested from supplier.`);
          },
          { toast: `Purchase request created for ${sku}` },
        ),

      updateEmployee: (id, patch) =>
        update(
          (d) => {
            const e = d.employees.find((x) => x.id === id);
            if (!e) return;
            const before = { role: e.role, zone: e.zone, status: e.status };
            Object.assign(e, patch);
            if (patch.role && patch.role !== before.role) log(d, "Changed Role", e.name, before.role, patch.role);
            if (patch.zone && patch.zone !== before.zone) log(d, "Assigned Zone", e.name, before.zone, patch.zone);
            if (patch.status && patch.status !== before.status)
              log(d, "Changed Status", e.name, before.status, patch.status);
          },
          { toast: "Employee updated" },
        ),


      recordGateEntry: (payload) =>
        update(
          (d) => {
            const ev: GateEvent = {
              id: uid("GT"),
              gate: payload.gate,
              vehicleNo: payload.vehicleNo.toUpperCase(),
              driver: payload.driver,
              transporter: payload.transporter,
              purpose: payload.purpose,
              shipmentId: payload.shipmentId,
              entryAt: new Date().toISOString(),
              status: "Inside",
              guard: d.employees.find((e) => e.id === d.currentUserId)?.name ?? "Gate Desk",
            };
            d.gateEvents.unshift(ev);
            log(d, "Gate Entry Recorded", `${ev.vehicleNo} · ${ev.gate}`, undefined, ev.purpose);
            const sh = d.inbound.find(
              (x) => x.id === payload.shipmentId || x.vehicleNo.toUpperCase() === ev.vehicleNo,
            );
            if (sh && sh.status === "Scheduled") {
              sh.status = "Arrived";
              sh.arrivedAt = ev.entryAt;
              ev.shipmentId = sh.id;
              log(d, "Inbound Arrived", sh.id, "Scheduled", "Arrived");
              notify(d, "info", `${sh.id} arrived at ${ev.gate}`, `${sh.supplier} · vehicle ${ev.vehicleNo}.`);
            }
          },
          { toast: `${payload.vehicleNo.toUpperCase()} logged in at ${payload.gate}` },
        ),

      recordGateExit: (id) =>
        update(
          (d) => {
            const ev = d.gateEvents.find((g) => g.id === id);
            if (!ev || ev.status === "Exited") return;
            ev.status = "Exited";
            ev.exitAt = new Date().toISOString();
            log(d, "Gate Exit Recorded", `${ev.vehicleNo} · ${ev.gate}`, "Inside", "Exited");
          },
          { toast: "Vehicle exit recorded" },
        ),

      advanceInbound: (id) =>
        update((d) => {
          const sh = d.inbound.find((x) => x.id === id);
          if (!sh) return;
          const order: InboundShipment["status"][] = ["Scheduled", "Arrived", "At Dock", "Unloading", "Verification"];
          const i = order.indexOf(sh.status);
          if (i < 0 || i >= order.length - 1) return;
          const prev = sh.status;
          sh.status = order[i + 1]!;
          if (sh.status === "Arrived") sh.arrivedAt = new Date().toISOString();
          if (sh.status === "Unloading") sh.lines.forEach((l) => (l.receivedQty = l.receivedQty || l.expectedQty));
          log(d, "Inbound Step Advanced", sh.id, prev, sh.status);
          toast.success(`${sh.id} moved to ${sh.status}`);
        }),

      setInboundReceived: (id, sku, received, damaged) =>
        update((d) => {
          const sh = d.inbound.find((x) => x.id === id);
          const line = sh?.lines.find((l) => l.sku === sku);
          if (!line) return;
          line.receivedQty = Math.max(0, received);
          line.damagedQty = Math.max(0, damaged);
        }),

      completeInbound: (id) =>
        update(
          (d) => {
            const sh = d.inbound.find((x) => x.id === id);
            if (!sh || sh.status === "Received") return;
            let mismatch = false;
            sh.lines.forEach((l) => {
              const good = Math.max(0, l.receivedQty - l.damagedQty);
              const p = d.products.find((x) => x.sku === l.sku);
              if (p) {
                p.available += good;
                p.damaged += l.damagedQty;
              }
              if (good > 0) txn(d, l.sku, "Received", good, `${sh.id} · ${sh.po}`);
              if (l.damagedQty > 0) txn(d, l.sku, "Damaged", l.damagedQty, `${sh.id} · ${sh.po}`);
              if (l.receivedQty !== l.expectedQty || l.damagedQty > 0) mismatch = true;
            });
            sh.receivedAt = new Date().toISOString();
            sh.status = mismatch ? "Discrepancy" : "Received";
            log(d, "Inbound Received", sh.id, "Verification", sh.status);

            if (mismatch) {
              const detail = sh.lines
                .filter((l) => l.receivedQty !== l.expectedQty || l.damagedQty > 0)
                .map((l) => `${l.sku}: expected ${l.expectedQty}, received ${l.receivedQty}, damaged ${l.damagedQty}`)
                .join("; ");
              d.exceptions.unshift({
                id: uid("EXC"),
                type: "Stock Mismatch",
                sku: sh.lines[0]?.sku,
                problem: `Receiving mismatch on ${sh.id} (${sh.po}) from ${sh.supplier}. ${detail}.`,
                impact: "Inventory position and supplier invoice will not reconcile.",
                recommendation: "Raise a supplier claim, quarantine damaged units and re-count the pallet.",
                owner: "Sunita Rao",
                slaMin: 120,
                severity: "High",
                status: "Open",
                createdAt: new Date().toISOString(),
              });
              notify(d, "critical", `Receiving mismatch on ${sh.id}`, detail);
            } else {
              notify(d, "info", `${sh.id} received`, `${sh.supplier} stock added to inventory.`);
            }
          },
          { toast: `Receiving completed for ${id}` },
        ),

      markNotification: (id) =>
        update((d) => {
          d.notifications.forEach((n) => {
            if (!id || n.id === id) n.read = true;
          });
        }),
    };
    return ctx;
  }, [state, update, commit]);

  if (!state || !value) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
          Loading WAREFLOW workspace…
        </div>
      </div>
    );
  }

  return <WfCtx.Provider value={value}>{children}</WfCtx.Provider>;
}

export function useWf() {
  const ctx = useContext(WfCtx);
  if (!ctx) throw new Error("useWf must be used inside WfProvider");
  return ctx;
}

export type { Order, Product, WfException, Employee };
export { stockStatus, allocationPlan };
