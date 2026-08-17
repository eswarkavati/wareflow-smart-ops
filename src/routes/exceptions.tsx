import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { AppShell } from "@/components/wf/AppShell";
import { EmptyState, Meta, PageHeader, Panel, StatusBadge } from "@/components/wf/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useWf } from "@/lib/wf/store";
import { fmtAgo } from "@/lib/wf/engine";
import type { ExceptionType } from "@/lib/wf/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/exceptions")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Exception Command Center — WAREFLOW" },
      { name: "description", content: "Triage, decide and resolve warehouse exceptions with recommended actions." },
      { property: "og:title", content: "Exception Command Center — WAREFLOW" },
      { property: "og:description", content: "Resolution workspace for warehouse exceptions." },
    ],
  }),
  component: () => (
    <AppShell navKey="exceptions">
      <Exceptions />
    </AppShell>
  ),
});

const TYPES: (ExceptionType | "All" | "Resolved")[] = [
  "All",
  "Missing Item",
  "Damaged Item",
  "Stock Mismatch",
  "Allocation Conflict",
  "Delayed Order",
  "Picking Issue",
  "QC Failure",
  "Dispatch Delay",
  "Resolved",
];

function Exceptions() {
  const { state, resolveException, setExceptionStatus, acceptAllocation } = useWf();
  const [filter, setFilter] = useState<(typeof TYPES)[number]>("All");
  const [sel, setSel] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const list = state.exceptions.filter((e) =>
    filter === "All" ? e.status !== "Resolved" : filter === "Resolved" ? e.status === "Resolved" : e.type === filter,
  );
  const exc = state.exceptions.find((e) => e.id === (sel ?? list[0]?.id)) ?? null;

  return (
    <>
      <PageHeader
        title="Exception Command Center"
        subtitle={`${state.exceptions.filter((e) => e.status !== "Resolved").length} open · resolution required before SLA expiry`}
      />

      <div className="mb-3 flex flex-wrap gap-1">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => {
              setFilter(t);
              setSel(null);
            }}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition-colors",
              filter === t
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState
          title="No exceptions"
          hint="Everything is running smoothly."
          icon={<CheckCircle2 className="h-6 w-6 text-success" />}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
          <Panel title="Queue" bodyClassName="p-0">
            <div className="max-h-[70vh] divide-y divide-border overflow-y-auto">
              {list.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSel(e.id)}
                  className={cn(
                    "w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
                    exc?.id === e.id && "border-l-2 border-l-info bg-info/5",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <StatusBadge value={e.severity} />
                    <span className="text-xs font-medium">{e.type}</span>
                    <StatusBadge className="ml-auto" value={e.status} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{e.problem}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {e.orderId ?? e.sku} · {fmtAgo(e.createdAt)}
                  </p>
                </button>
              ))}
            </div>
          </Panel>

          {exc ? (
            <Panel
              title={`${exc.type} · ${exc.id}`}
              description={`Owner ${exc.owner} · SLA ${exc.slaMin} minutes`}
              action={<StatusBadge value={exc.status} />}
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Meta label="Order" value={exc.orderId ?? "—"} />
                <Meta label="SKU" value={exc.sku ?? "—"} />
                <Meta label="Severity" value={<StatusBadge value={exc.severity} />} />
                <Meta label="Raised" value={fmtAgo(exc.createdAt)} />
              </div>

              <div className="mt-4 space-y-3">
                <div className="rounded-md border border-border p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Problem</p>
                  <p className="mt-1 text-sm">{exc.problem}</p>
                </div>
                <div className="rounded-md border border-warning/30 bg-warning/5 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Impact</p>
                  <p className="mt-1 text-sm">{exc.impact}</p>
                </div>
                <div className="rounded-md border border-info/30 bg-info/5 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-info">Recommended action</p>
                  <p className="mt-1 text-sm">{exc.recommendation}</p>
                </div>
              </div>

              {exc.status === "Resolved" ? (
                <p className="mt-4 rounded-md border border-success/30 bg-success/5 p-3 text-sm text-success">
                  Resolved — {exc.resolution}
                </p>
              ) : (
                <>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Resolution note (optional)"
                    className="mt-4 h-20 text-sm"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        if (exc.type === "Stock Mismatch" && exc.orderId) acceptAllocation(exc.orderId);
                        resolveException(exc.id, note || exc.recommendation);
                        setNote("");
                      }}
                    >
                      Accept recommendation
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        resolveException(exc.id, note || "Resolved with manual intervention.");
                        setNote("");
                      }}
                    >
                      Resolve manually
                    </Button>
                    <Button variant="outline" onClick={() => setExceptionStatus(exc.id, "In Review")}>
                      Escalate
                    </Button>
                  </div>
                </>
              )}
            </Panel>
          ) : null}
        </div>
      )}
    </>
  );
}
