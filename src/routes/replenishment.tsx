import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/wf/AppShell";
import { EmptyState, Kpi, PageHeader, Panel, StatusBadge, TableShell, Td, Th } from "@/components/wf/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWf } from "@/lib/wf/store";
import { fmtAgo, inr, replenishmentFor, stockStatus } from "@/lib/wf/engine";

export const Route = createFileRoute("/replenishment")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Replenishment Planning — WAREFLOW" },
      { name: "description", content: "Reorder recommendations, purchase requests and supplier lead-time planning." },
      { property: "og:title", content: "Replenishment Planning — WAREFLOW" },
      { property: "og:description", content: "Plan reorders before stockouts hit fulfilment." },
    ],
  }),
  component: () => (
    <AppShell navKey="replenishment">
      <Replenishment />
    </AppShell>
  ),
});

function Replenishment() {
  const { state, createReplenishment, update, user } = useWf();
  const [qty, setQty] = useState<Record<string, string>>({});

  const needs = state.products
    .map((p) => ({ p, ...replenishmentFor(p), status: stockStatus(p) }))
    .filter((r) => r.status === "Out of Stock" || r.status === "Critical" || r.status === "Low Stock")
    .sort((a, b) => a.p.available / (a.p.reorderPoint || 1) - b.p.available / (b.p.reorderPoint || 1));

  const openReqs = state.replenishments.filter((r) => r.status !== "Received");
  const cost = needs.reduce((s, r) => s + r.recommended * r.p.price, 0);

  const setStatus = (id: string, status: "Approved" | "Received") =>
    update(
      (d) => {
        const r = d.replenishments.find((x) => x.id === id);
        if (!r) return;
        r.status = status;
        if (status === "Received") {
          const p = d.products.find((x) => x.sku === r.sku);
          if (p) p.available += r.qty;
          d.txns.unshift({
            id: `TXN-${Date.now().toString(36)}`,
            ts: new Date().toISOString(),
            sku: r.sku,
            action: "Received",
            qty: r.qty,
            reference: r.id,
            employee: user?.name ?? "System",
          });
        }
      },
      { toast: status === "Received" ? "Stock received and added to inventory" : "Purchase request approved" },
    );

  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Replenishment Planning"
        subtitle="Demand-driven reorder recommendations across suppliers"
      />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="SKUs needing reorder" value={needs.length} tone={needs.length ? "amber" : "green"} />
        <Kpi label="Open purchase requests" value={openReqs.length} tone="blue" />
        <Kpi label="Est. purchase value" value={inr(cost)} hint="At current unit cost" />
        <Kpi
          label="Out of stock"
          value={state.products.filter((p) => p.available === 0).length}
          tone={state.products.some((p) => p.available === 0) ? "red" : "green"}
        />
      </div>

      <Panel
        title="Reorder recommendations"
        description="Target = average daily demand × supplier lead time + safety stock"
        bodyClassName="p-0"
        className="mb-4"
      >
        {needs.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No reorders required" hint="All SKUs are above their reorder point." />
          </div>
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>SKU</Th>
                <Th>Status</Th>
                <Th>On hand</Th>
                <Th>Reorder point</Th>
                <Th>Lead time</Th>
                <Th>Recommended</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {needs.map(({ p, recommended, target, status }) => (
                <tr key={p.sku} className="transition-colors hover:bg-muted/50">
                  <Td>
                    <span className="font-medium">{p.name}</span>
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      {p.sku} · {p.supplier}
                    </span>
                  </Td>
                  <Td>
                    <StatusBadge value={status} />
                  </Td>
                  <Td className="tabular">{p.available}</Td>
                  <Td className="tabular text-muted-foreground">{p.reorderPoint}</Td>
                  <Td className="text-xs text-muted-foreground">{p.leadTimeDays} days</Td>
                  <Td>
                    <span className="tabular font-medium">{recommended}</span>
                    <span className="block text-[11px] text-muted-foreground">target {target}</span>
                  </Td>
                  <Td>
                    <div className="flex items-center justify-end gap-2">
                      <Input
                        value={qty[p.sku] ?? String(recommended)}
                        onChange={(e) => setQty({ ...qty, [p.sku]: e.target.value })}
                        className="h-7 w-20 text-xs"
                      />
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => createReplenishment(p.sku, Number(qty[p.sku] ?? recommended) || recommended)}
                      >
                        Raise PR
                      </Button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>

      <Panel title="Purchase requests" description="Approve and receive incoming supplier stock" bodyClassName="p-0">
        {state.replenishments.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No purchase requests" hint="Raise one from the recommendations above." />
          </div>
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Request</Th>
                <Th>SKU</Th>
                <Th>Qty</Th>
                <Th>Requested by</Th>
                <Th>Raised</Th>
                <Th>Status</Th>
                <Th className="text-right">Action</Th>
              </tr>
            </thead>
            <tbody>
              {state.replenishments.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-muted/50">
                  <Td className="font-mono text-[11px]">{r.id}</Td>
                  <Td className="font-mono text-[11px]">{r.sku}</Td>
                  <Td className="tabular">{r.qty}</Td>
                  <Td className="text-xs text-muted-foreground">{r.requestedBy}</Td>
                  <Td className="text-xs text-muted-foreground">{fmtAgo(r.createdAt)}</Td>
                  <Td>
                    <StatusBadge
                      value={r.status}
                      tone={r.status === "Received" ? "green" : r.status === "Approved" ? "blue" : "amber"}
                    />
                  </Td>
                  <Td className="text-right">
                    {r.status === "Requested" ? (
                      <Button size="sm" className="h-7 text-xs" onClick={() => setStatus(r.id, "Approved")}>
                        Approve
                      </Button>
                    ) : r.status === "Approved" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setStatus(r.id, "Received")}
                      >
                        Mark received
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Stock added</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Panel>
    </>
  );
}
