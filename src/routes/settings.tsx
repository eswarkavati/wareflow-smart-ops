import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/wf/AppShell";
import { Meta, PageHeader, Panel } from "@/components/wf/ui";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useWf } from "@/lib/wf/store";
import { fmtAgo } from "@/lib/wf/engine";
import { useState } from "react";

export const Route = createFileRoute("/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Platform Settings — WAREFLOW" },
      { name: "description", content: "Warehouse configuration, SLA thresholds and demo data controls." },
      { property: "og:title", content: "Platform Settings — WAREFLOW" },
      { property: "og:description", content: "Configure warehouse thresholds and reset demo data." },
    ],
  }),
  component: () => (
    <AppShell navKey="settings">
      <Settings />
    </AppShell>
  ),
});

const TOGGLES = [
  ["Auto-prioritise incoming orders", "Runs the priority engine on every new order."],
  ["Auto-allocate when stock is sufficient", "Skips manual review for fully coverable orders."],
  ["Escalate critical exceptions", "Notifies the warehouse manager within 5 minutes."],
  ["Block dispatch on failed QC", "Prevents handover until QC passes."],
];

function Settings() {
  const { state, reseed, user } = useWf();
  const [on, setOn] = useState<Record<string, boolean>>({
    "Auto-prioritise incoming orders": true,
    "Auto-allocate when stock is sufficient": false,
    "Escalate critical exceptions": true,
    "Block dispatch on failed QC": true,
  });

  return (
    <>
      <PageHeader title="Platform Settings" subtitle="Warehouse configuration and operating thresholds" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Warehouse profile">
          <div className="grid grid-cols-2 gap-3">
            <Meta label="Facility" value="BLR-01 · Bangalore Hub" />
            <Meta label="Zones" value="A – F (6 aisles)" />
            <Meta label="Operating hours" value="24 × 7 · 3 shifts" />
            <Meta label="Signed in as" value={`${user?.name ?? "—"} (${user?.role ?? "—"})`} />
            <Meta label="Catalogue" value={`${state.products.length} SKUs`} />
            <Meta label="Data updated" value={fmtAgo(state.updatedAt)} />
          </div>
        </Panel>

        <Panel title="Automation rules" description="Applies to all inbound order flow">
          <div className="space-y-3">
            {TOGGLES.map(([label, hint]) => (
              <div key={label} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
                <Switch
                  checked={!!on[label!]}
                  onCheckedChange={(v) => setOn({ ...on, [label!]: v })}
                />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="SLA thresholds" description="Used by the priority and health engines">
          <div className="grid grid-cols-2 gap-3">
            <Meta label="Critical window" value="< 60 minutes to promise" />
            <Meta label="High window" value="< 180 minutes to promise" />
            <Meta label="Exception SLA" value="15 – 45 minutes by severity" />
            <Meta label="Health warning band" value="Score below 85" />
          </div>
        </Panel>

        <Panel title="Demo data" description="Reset the prototype to a clean baseline dataset">
          <p className="text-sm text-muted-foreground">
            Resetting restores {state.products.length} SKUs, {state.orders.length} orders and the original exception
            queue. Your signed-in session is preserved.
          </p>
          <Button className="mt-3" variant="outline" onClick={reseed}>
            Reset demo data
          </Button>
        </Panel>
      </div>
    </>
  );
}
