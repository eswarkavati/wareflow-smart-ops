import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, MapPin, Route as RouteIcon } from "lucide-react";
import { AppShell } from "@/components/wf/AppShell";
import { EmptyState, Meta, PageHeader, Panel, StatusBadge } from "@/components/wf/ui";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useWf } from "@/lib/wf/store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/picking")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Picking Operations — WAREFLOW" },
      { name: "description", content: "Pick queue, optimised routes and missing-item exception capture." },
      { property: "og:title", content: "Picking Operations — WAREFLOW" },
      { property: "og:description", content: "Task workspace for warehouse pickers and picking managers." },
    ],
  }),
  component: () => (
    <AppShell navKey="picking">
      <Picking />
    </AppShell>
  ),
});

function Picking() {
  const { state, startPicking, markPicked, reportMissing } = useWf();
  const tasks = [...state.pickTasks].sort(
    (a, b) =>
      Number(b.status === "Blocked") - Number(a.status === "Blocked") ||
      Number(a.status === "Completed") - Number(b.status === "Completed"),
  );
  const [sel, setSel] = useState<string | null>(tasks[0]?.id ?? null);
  const task = state.pickTasks.find((t) => t.id === (sel ?? tasks[0]?.id)) ?? null;
  const [missing, setMissing] = useState<string | null>(null);

  if (!task) {
    return (
      <>
        <PageHeader title="Picking Operations" subtitle="Task workspace" />
        <EmptyState title="Pick queue is empty" hint="Allocated orders will generate pick tasks automatically." />
      </>
    );
  }

  const done = task.items.filter((i) => i.picked).length;

  return (
    <>
      <PageHeader
        title="Picking Operations"
        subtitle={`${state.pickTasks.filter((t) => t.status !== "Completed").length} open tasks in the pick queue`}
      />

      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <Panel title="Pick queue" bodyClassName="p-0">
          <div className="max-h-[70vh] divide-y divide-border overflow-y-auto">
            {tasks.map((t) => (
              <button
                key={t.id}
                onClick={() => setSel(t.id)}
                className={cn(
                  "w-full px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
                  t.id === task.id && "border-l-2 border-l-info bg-info/5",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t.orderId}</span>
                  <StatusBadge className="ml-auto" value={t.status} />
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t.picker} · Zone {t.zone} · {t.items.length} lines
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t.priority} · est. {t.etaMin} min
                </p>
              </button>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel
            title={`Task ${task.id} · ${task.orderId}`}
            description={`Assigned to ${task.picker}`}
            action={<StatusBadge value={task.status} />}
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Meta label="Zone" value={task.zone} />
              <Meta label="Priority" value={<StatusBadge value={task.priority} />} />
              <Meta label="Estimated" value={`${task.etaMin} min`} />
              <Meta label="Progress" value={`${done}/${task.items.length} lines`} />
            </div>

            <div className="mt-4 rounded-md border border-info/25 bg-info/5 p-3">
              <div className="flex items-center gap-2">
                <RouteIcon className="h-4 w-4 text-info" />
                <p className="text-xs font-semibold text-info">Pick route recommendation</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-xs">
                {task.route.map((z, i) => (
                  <span key={z} className="flex items-center gap-1.5">
                    <span className="rounded border border-border bg-card px-1.5 py-0.5">{z}</span>
                    {i < task.route.length - 1 ? <span className="text-muted-foreground">→</span> : null}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Optimised serpentine route reduces walking distance by approximately 18% versus sequential picking.
              </p>
            </div>

            <div className="mt-4 space-y-2">
              {task.items.map((it) => (
                <div
                  key={it.sku}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 py-2"
                >
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <div className="min-w-[180px]">
                    <p className="text-sm">{it.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {it.sku} · {it.location}
                    </p>
                  </div>
                  <span className="tabular text-xs text-muted-foreground">Qty {it.qty}</span>
                  <div className="ml-auto flex gap-1.5">
                    {it.picked ? (
                      <span className="flex items-center gap-1 text-xs text-success">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Picked
                      </span>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          disabled={task.status === "Pending"}
                          onClick={() => markPicked(task.id, it.sku)}
                        >
                          Mark picked
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setMissing(it.sku)}
                        >
                          Report missing
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2 border-t border-border pt-4">
              {task.status === "Pending" || task.status === "Blocked" ? (
                <Button onClick={() => startPicking(task.id)}>Start picking</Button>
              ) : null}
              {task.status === "Completed" ? (
                <p className="text-xs text-success">
                  Task complete — {task.orderId} has moved to the packing station.
                </p>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>

      <AlertDialog open={!!missing} onOpenChange={(o) => !o && setMissing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Report missing item?</AlertDialogTitle>
            <AlertDialogDescription>
              This blocks the pick task, flags {task.orderId} as at risk and raises a Missing Item exception with a
              recommended resolution.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (missing) reportMissing(task.id, missing);
                setMissing(null);
              }}
            >
              Report missing item
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
