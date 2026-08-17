import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/wf/AppShell";
import { Kpi, PageHeader, Panel, StatusBadge, TableShell, Td, Th } from "@/components/wf/ui";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWf } from "@/lib/wf/store";

export const Route = createFileRoute("/employees")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Workforce Management — WAREFLOW" },
      { name: "description", content: "Shift coverage, zone assignment and productivity across warehouse staff." },
      { property: "og:title", content: "Workforce Management — WAREFLOW" },
      { property: "og:description", content: "Manage warehouse staff, shifts and zone allocation." },
    ],
  }),
  component: () => (
    <AppShell navKey="employees">
      <Employees />
    </AppShell>
  ),
});

function Employees() {
  const { state, updateEmployee } = useWf();
  const [q, setQ] = useState("");
  const [shift, setShift] = useState("all");

  const list = state.employees.filter(
    (e) =>
      (shift === "all" || e.shift === shift) &&
      (q === "" ||
        e.name.toLowerCase().includes(q.toLowerCase()) ||
        e.role.toLowerCase().includes(q.toLowerCase()) ||
        e.zone.toLowerCase().includes(q.toLowerCase())),
  );

  const active = state.employees.filter((e) => e.status === "Active").length;
  const avgEff = Math.round(
    state.employees.reduce((s, e) => s + e.efficiency, 0) / Math.max(1, state.employees.length),
  );
  const tasks = state.employees.reduce((s, e) => s + e.tasksCompleted, 0);

  return (
    <>
      <PageHeader eyebrow="Management" title="Workforce Management" subtitle="Shift coverage, zone assignment and productivity" />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Total staff" value={state.employees.length} />
        <Kpi label="Active now" value={active} tone="green" />
        <Kpi label="Tasks completed" value={tasks} tone="blue" />
        <Kpi label="Avg efficiency" value={`${avgEff}%`} tone={avgEff >= 90 ? "green" : "amber"} />
      </div>

      <Panel bodyClassName="p-0">
        <div className="flex flex-wrap gap-2 border-b border-border p-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, role or zone"
            className="h-8 max-w-xs text-sm"
          />
          <Select value={shift} onValueChange={setShift}>
            <SelectTrigger className="h-8 w-40 text-sm">
              <SelectValue placeholder="Shift" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All shifts</SelectItem>
              <SelectItem value="Morning">Morning</SelectItem>
              <SelectItem value="Evening">Evening</SelectItem>
              <SelectItem value="Night">Night</SelectItem>
            </SelectContent>
          </Select>
          <span className="ml-auto self-center text-xs text-muted-foreground">{list.length} staff</span>
        </div>

        <TableShell>
          <thead>
            <tr>
              <Th>Employee</Th>
              <Th>Role</Th>
              <Th>Zone</Th>
              <Th>Shift</Th>
              <Th>Tasks</Th>
              <Th>Efficiency</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id} className="transition-colors hover:bg-muted/50">
                <Td>
                  <span className="font-medium">{e.name}</span>
                  <span className="block text-[11px] text-muted-foreground">{e.email}</span>
                </Td>
                <Td className="text-xs">{e.role}</Td>
                <Td className="font-mono text-xs text-muted-foreground">{e.zone}</Td>
                <Td className="text-xs">{e.shift}</Td>
                <Td className="tabular">
                  {e.tasksCompleted}
                  <span className="block text-[11px] text-muted-foreground">{e.avgTaskMin} min avg</span>
                </Td>
                <Td>
                  <StatusBadge
                    value={`${e.efficiency}%`}
                    tone={e.efficiency >= 95 ? "green" : e.efficiency >= 85 ? "blue" : "amber"}
                  />
                </Td>
                <Td>
                  <Select
                    value={e.status}
                    onValueChange={(v) => updateEmployee(e.id, { status: v as typeof e.status })}
                  >
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="On Break">On Break</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableShell>
      </Panel>
    </>
  );
}
