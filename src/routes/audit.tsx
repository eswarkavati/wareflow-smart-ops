import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/wf/AppShell";
import { EmptyState, PageHeader, Panel, TableShell, Td, Th } from "@/components/wf/ui";
import { Input } from "@/components/ui/input";
import { useWf } from "@/lib/wf/store";
import { fmtAgo } from "@/lib/wf/engine";

export const Route = createFileRoute("/audit")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Audit Logs — WAREFLOW" },
      { name: "description", content: "Immutable trail of every operational action taken in the warehouse." },
      { property: "og:title", content: "Audit Logs — WAREFLOW" },
      { property: "og:description", content: "Full audit trail of warehouse operations." },
    ],
  }),
  component: () => (
    <AppShell navKey="audit">
      <Audit />
    </AppShell>
  ),
});

function Audit() {
  const { state } = useWf();
  const [q, setQ] = useState("");
  const rows = state.audit.filter((a) =>
    q === ""
      ? true
      : [a.user, a.action, a.entity, a.from, a.to].join(" ").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <>
      <PageHeader eyebrow="Management" title="Audit Logs" subtitle={`${state.audit.length} recorded actions`} />
      <Panel bodyClassName="p-0">
        <div className="border-b border-border p-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search user, action or entity"
            className="h-8 max-w-sm text-sm"
          />
        </div>
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No matching entries" hint="Adjust your search to see more activity." />
          </div>
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Time</Th>
                <Th>User</Th>
                <Th>Action</Th>
                <Th>Entity</Th>
                <Th>Change</Th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 200).map((a) => (
                <tr key={a.id} className="transition-colors hover:bg-muted/50">
                  <Td className="whitespace-nowrap text-xs text-muted-foreground">{fmtAgo(a.ts)}</Td>
                  <Td className="text-xs">{a.user}</Td>
                  <Td className="text-xs font-medium">{a.action}</Td>
                  <Td className="font-mono text-[11px] text-muted-foreground">{a.entity}</Td>
                  <Td className="text-xs text-muted-foreground">
                    {a.from || a.to ? `${a.from ?? "—"} → ${a.to ?? "—"}` : "—"}
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
