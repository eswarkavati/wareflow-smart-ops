import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/wf/AppShell";
import { Kpi, PageHeader, Panel, StatusBadge, TableShell, Td, Th } from "@/components/wf/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useWf } from "@/lib/wf/store";
import { NAV_KEYS, canAccess } from "@/lib/wf/engine";
import type { Role } from "@/lib/wf/types";
import { Check, Minus } from "lucide-react";

export const Route = createFileRoute("/users")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Users & Roles — WAREFLOW" },
      { name: "description", content: "Role-based access control matrix and user role assignment." },
      { property: "og:title", content: "Users & Roles — WAREFLOW" },
      { property: "og:description", content: "Manage access control across warehouse roles." },
    ],
  }),
  component: () => (
    <AppShell navKey="users">
      <Users />
    </AppShell>
  ),
});

const ROLES: Role[] = [
  "Admin",
  "Warehouse Manager",
  "Inventory Manager",
  "Picking Manager",
  "Packing Manager",
  "QC Manager",
  "Dispatcher",
  "Picker",
  "Packer",
  "QC Operator",
];

function Users() {
  const { state, updateEmployee } = useWf();

  return (
    <>
      <PageHeader eyebrow="Management" title="Users & Roles" subtitle="Role-based access control across the platform" />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Users" value={state.employees.length} />
        <Kpi label="Roles" value={ROLES.length} tone="blue" />
        <Kpi label="Modules" value={NAV_KEYS.length} />
        <Kpi label="Admins" value={state.employees.filter((e) => e.role === "Admin").length} tone="amber" />
      </div>

      <Panel title="Permission matrix" description="Module access granted per role" bodyClassName="p-0" className="mb-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr>
                <Th>Role</Th>
                {NAV_KEYS.map((k) => (
                  <Th key={k} className="text-center capitalize">
                    {k}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROLES.map((r) => (
                <tr key={r} className="transition-colors hover:bg-muted/50">
                  <Td className="whitespace-nowrap font-medium">{r}</Td>
                  {NAV_KEYS.map((k) => (
                    <Td key={k} className="text-center">
                      {canAccess(r, k) ? (
                        <Check className="mx-auto h-3.5 w-3.5 text-success" />
                      ) : (
                        <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground/40" />
                      )}
                    </Td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="User accounts" description="Change a role to update that user's access instantly" bodyClassName="p-0">
        <TableShell>
          <thead>
            <tr>
              <Th>User</Th>
              <Th>Email</Th>
              <Th>Status</Th>
              <Th>Role</Th>
            </tr>
          </thead>
          <tbody>
            {state.employees.map((e) => (
              <tr key={e.id} className="transition-colors hover:bg-muted/50">
                <Td className="font-medium">{e.name}</Td>
                <Td className="text-xs text-muted-foreground">{e.email}</Td>
                <Td>
                  <StatusBadge value={e.status} />
                </Td>
                <Td>
                  <Select value={e.role} onValueChange={(v) => updateEmployee(e.id, { role: v as Role })}>
                    <SelectTrigger className="h-7 w-52 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
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
