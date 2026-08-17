import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/wf/AppShell";
import { EmptyState, Meta, PageHeader, StatusBadge, TableShell, Td, Th } from "@/components/wf/ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWf } from "@/lib/wf/store";
import { fmtAgo, inr, replenishmentFor, stockStatus } from "@/lib/wf/engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/inventory")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Inventory — WAREFLOW" },
      { name: "description", content: "SKU-level stock position with reserved, damaged and reorder thresholds." },
      { property: "og:title", content: "Inventory — WAREFLOW" },
      { property: "og:description", content: "Warehouse stock position and movement ledger." },
    ],
  }),
  component: () => (
    <AppShell navKey="inventory">
      <Inventory />
    </AppShell>
  ),
});

const FILTERS = ["All", "Healthy", "Low Stock", "Out of Stock", "Reserved", "Damaged", "Overstock"] as const;

function Inventory() {
  const { state, createReplenishment } = useWf();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [sku, setSku] = useState<string | null>(null);

  const rows = useMemo(() => {
    return state.products.filter((p) => {
      const match = `${p.sku} ${p.name} ${p.category}`.toLowerCase().includes(q.toLowerCase());
      if (!match) return false;
      const st = stockStatus(p);
      if (filter === "All") return true;
      if (filter === "Low Stock") return st === "Low Stock" || st === "Critical";
      if (filter === "Reserved") return p.reserved > 0;
      if (filter === "Damaged") return p.damaged > 0;
      return st === filter;
    });
  }, [state.products, q, filter]);

  const product = state.products.find((p) => p.sku === sku) ?? null;
  const ledger = state.txns.filter((t) => t.sku === sku).slice(0, 12);
  const rec = product ? replenishmentFor(product) : null;

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle={`${state.products.length} SKUs across 7 zones · ${rows.length} in current view`}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search SKU, product or category"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                filter === f
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No SKUs match" hint="Adjust the search term or filter." />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>SKU</Th>
              <Th>Product</Th>
              <Th>Category</Th>
              <Th>Zone</Th>
              <Th>Available</Th>
              <Th>Reserved</Th>
              <Th>Damaged</Th>
              <Th>Reorder pt.</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.sku}
                onClick={() => setSku(p.sku)}
                className="cursor-pointer transition-colors hover:bg-muted/50"
              >
                <Td className="font-mono text-xs">{p.sku}</Td>
                <Td>{p.name}</Td>
                <Td className="text-xs text-muted-foreground">{p.category}</Td>
                <Td className="font-mono text-xs">{p.zone}</Td>
                <Td className="tabular font-medium">{p.available}</Td>
                <Td className="tabular text-muted-foreground">{p.reserved}</Td>
                <Td className={cn("tabular", p.damaged > 0 && "text-destructive")}>{p.damaged}</Td>
                <Td className="tabular text-muted-foreground">{p.reorderPoint}</Td>
                <Td>
                  <StatusBadge value={stockStatus(p)} />
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      )}

      <Sheet open={!!product} onOpenChange={(o) => !o && setSku(null)}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-xl">
          {product ? (
            <>
              <SheetHeader className="border-b border-border">
                <SheetTitle className="text-base">{product.name}</SheetTitle>
                <p className="font-mono text-xs text-muted-foreground">
                  {product.sku} · {product.category} · Zone {product.zone}
                </p>
              </SheetHeader>
              <Tabs defaultValue="overview" className="p-4">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="ledger">Stock movement</TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="mt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Meta label="Available" value={<span className="tabular font-semibold">{product.available}</span>} />
                    <Meta label="Reserved" value={<span className="tabular">{product.reserved}</span>} />
                    <Meta label="Damaged" value={<span className="tabular">{product.damaged}</span>} />
                    <Meta label="Reorder point" value={<span className="tabular">{product.reorderPoint}</span>} />
                    <Meta label="Unit price" value={inr(product.price)} />
                    <Meta label="Avg daily demand" value={`${product.avgDailyDemand}/day`} />
                    <Meta label="Lead time" value={`${product.leadTimeDays} days`} />
                    <Meta label="Status" value={<StatusBadge value={stockStatus(product)} />} />
                  </div>
                  <div className="rounded-md border border-border bg-surface p-3">
                    <p className="text-xs font-semibold">Supplier</p>
                    <p className="mt-1 text-sm">{product.supplier}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Cover target {rec?.target} units ({product.avgDailyDemand} × {product.leadTimeDays} days +{" "}
                      {product.safetyStock} safety stock).
                    </p>
                    {rec && rec.recommended > 0 ? (
                      <Button
                        size="sm"
                        className="mt-3"
                        onClick={() => createReplenishment(product.sku, rec.recommended)}
                      >
                        Create purchase request · {rec.recommended} units
                      </Button>
                    ) : (
                      <p className="mt-3 text-xs text-success">Stock cover is sufficient.</p>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="ledger" className="mt-4">
                  {ledger.length === 0 ? (
                    <EmptyState title="No recent movement" hint="Transactions appear as stock is allocated or picked." />
                  ) : (
                    <div className="overflow-hidden rounded-md border border-border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-surface text-left text-muted-foreground">
                            <th className="px-2.5 py-1.5 font-medium">Time</th>
                            <th className="px-2.5 py-1.5 font-medium">Action</th>
                            <th className="px-2.5 py-1.5 font-medium">Qty</th>
                            <th className="px-2.5 py-1.5 font-medium">Reference</th>
                            <th className="px-2.5 py-1.5 font-medium">Employee</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ledger.map((t) => (
                            <tr key={t.id} className="border-t border-border/70">
                              <td className="px-2.5 py-1.5 text-muted-foreground">{fmtAgo(t.ts)}</td>
                              <td className="px-2.5 py-1.5">{t.action}</td>
                              <td className={cn("tabular px-2.5 py-1.5", t.qty < 0 ? "text-destructive" : "text-success")}>
                                {t.qty > 0 ? `+${t.qty}` : t.qty}
                              </td>
                              <td className="px-2.5 py-1.5 font-mono text-[10px]">{t.reference}</td>
                              <td className="px-2.5 py-1.5 text-muted-foreground">{t.employee}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
