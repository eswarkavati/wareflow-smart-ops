import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { AppShell } from "@/components/wf/AppShell";
import { OrderDrawer } from "@/components/wf/OrderDrawer";
import { EmptyState, PageHeader, StatusBadge, TableShell, Td, Th } from "@/components/wf/ui";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useWf } from "@/lib/wf/store";
import { fmtAgo, fmtTime, inr, minutesUntil } from "@/lib/wf/engine";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orders")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Orders — WAREFLOW" },
      { name: "description", content: "Search, filter and action every fulfilment order with SLA and priority context." },
      { property: "og:title", content: "Orders — WAREFLOW" },
      { property: "og:description", content: "Operational order management with priority scoring and SLA tracking." },
    ],
  }),
  component: () => (
    <AppShell navKey="orders">
      <Orders />
    </AppShell>
  ),
});

const FILTERS = [
  "All",
  "Critical",
  "High",
  "Normal",
  "Delayed",
  "Unallocated",
  "Picking",
  "Packing",
  "Dispatched",
] as const;

const PAGE = 12;

function Orders() {
  const { state } = useWf();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [sort, setSort] = useState<"score" | "sla" | "created">("score");
  const [page, setPage] = useState(0);
  const [open, setOpen] = useState<string | null>(null);

  const rows = useMemo(() => {
    let list = state.orders.filter((o) => {
      const t = `${o.id} ${o.customer} ${o.items.map((i) => i.name).join(" ")}`.toLowerCase();
      return t.includes(q.toLowerCase());
    });
    if (filter === "Critical" || filter === "High" || filter === "Normal")
      list = list.filter((o) => o.priority === filter.toUpperCase());
    if (filter === "Delayed") list = list.filter((o) => o.atRisk && o.stage !== "Dispatched");
    if (filter === "Unallocated") list = list.filter((o) => o.allocation === "Unallocated");
    if (filter === "Picking") list = list.filter((o) => o.stage === "Picking");
    if (filter === "Packing") list = list.filter((o) => o.stage === "Packed" || o.stage === "QC");
    if (filter === "Dispatched") list = list.filter((o) => o.stage === "Dispatched");
    return [...list].sort((a, b) =>
      sort === "score"
        ? b.score - a.score
        : sort === "sla"
          ? minutesUntil(a.promisedAt) - minutesUntil(b.promisedAt)
          : b.createdAt.localeCompare(a.createdAt),
    );
  }, [state.orders, q, filter, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const view = rows.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <>
      <PageHeader title="Orders" subtitle={`${rows.length} orders matching current view`} />

      <div className="sticky top-[52px] z-10 -mx-4 mb-3 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 px-4 py-2.5 shadow-sm backdrop-blur lg:-mx-6 lg:px-6">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Search orders, customers, products…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setPage(0);
              }}
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
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="ml-auto h-8 rounded-md border border-border bg-card px-2 text-xs"
        >
          <option value="score">Sort: Priority score</option>
          <option value="sla">Sort: SLA urgency</option>
          <option value="created">Sort: Newest</option>
        </select>
      </div>

      {view.length === 0 ? (
        <EmptyState title="No orders match this view" hint="Try clearing the search or switching filters." />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Order</Th>
              <Th>Customer</Th>
              <Th>Items</Th>
              <Th>Priority</Th>
              <Th>SLA</Th>
              <Th>Allocation</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {view.map((o) => {
              const m = minutesUntil(o.promisedAt);
              return (
                <tr key={o.id} className="transition-colors hover:bg-muted/50">
                  <Td>
                    <button onClick={() => setOpen(o.id)} className="font-medium text-info hover:underline">
                      {o.id}
                    </button>
                    <span className="tabular block text-[11px] text-muted-foreground">{inr(o.value)}</span>
                  </Td>
                  <Td>
                    <span className="block text-sm">{o.customer}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {o.city} · {o.customerTier}
                    </span>
                  </Td>
                  <Td className="tabular">{o.items.reduce((n, i) => n + i.qty, 0)}</Td>
                  <Td>
                    <StatusBadge value={o.priority} />
                    <span className="tabular ml-1.5 text-[11px] text-muted-foreground">{o.score}</span>
                  </Td>
                  <Td>
                    <span className={cn("tabular text-xs", m < 0 ? "text-destructive" : m < 60 ? "text-warning" : "")}>
                      {fmtTime(o.promisedAt)} · {m < 0 ? `${Math.abs(m)}m late` : `${m}m`}
                    </span>
                  </Td>
                  <Td>
                    <StatusBadge value={o.allocation} />
                  </Td>
                  <Td>
                    <StatusBadge value={o.stage} />
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-muted-foreground">{fmtAgo(o.createdAt)}</Td>
                  <Td className="text-right">
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(o.id)}>
                      Open
                    </Button>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Page {page + 1} of {pages}
        </span>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </Button>
          <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <OrderDrawer orderId={open} onClose={() => setOpen(null)} />
    </>
  );
}
