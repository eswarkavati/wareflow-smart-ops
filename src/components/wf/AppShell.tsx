import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Bell,
  Boxes,
  ClipboardList,
  Cog,
  LayoutGrid,
  LogOut,
  PackageCheck,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  Split,
  Truck,
  Users,
} from "lucide-react";
import { useWf } from "@/lib/wf/store";
import { canAccess, fmtAgo, type NavKey } from "@/lib/wf/engine";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/wf/ui";
import { cn } from "@/lib/utils";

const NAV: { key: NavKey; label: string; to: string; icon: typeof LayoutGrid; group: string }[] = [
  { key: "overview", label: "Overview", to: "/overview", icon: LayoutGrid, group: "Operations" },
  { key: "orders", label: "Orders", to: "/orders", icon: ClipboardList, group: "Operations" },
  { key: "inventory", label: "Inventory", to: "/inventory", icon: Boxes, group: "Operations" },
  { key: "allocation", label: "Allocation", to: "/allocation", icon: Split, group: "Operations" },
  { key: "picking", label: "Picking", to: "/picking", icon: Activity, group: "Operations" },
  { key: "packing", label: "Packing & QC", to: "/packing", icon: PackageCheck, group: "Operations" },
  { key: "dispatch", label: "Dispatch", to: "/dispatch", icon: Truck, group: "Operations" },
  { key: "exceptions", label: "Exceptions", to: "/exceptions", icon: AlertTriangle, group: "Operations" },
  { key: "replenishment", label: "Replenishment", to: "/replenishment", icon: RefreshCw, group: "Operations" },
  { key: "analytics", label: "Analytics", to: "/analytics", icon: BarChart3, group: "Operations" },
  { key: "employees", label: "Employees", to: "/employees", icon: Users, group: "Management" },
  { key: "users", label: "Users & Roles", to: "/users", icon: ShieldCheck, group: "Management" },
  { key: "audit", label: "Audit Logs", to: "/audit", icon: ScrollText, group: "System" },
  { key: "settings", label: "Settings", to: "/settings", icon: Cog, group: "System" },
];

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="tabular hidden text-xs text-muted-foreground lg:inline">
      {now.toLocaleDateString([], { day: "2-digit", month: "short" })} ·{" "}
      {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
    </span>
  );
}

function GlobalSearch() {
  const { state } = useWf();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    void navigate({ to });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 w-full max-w-xs items-center gap-2 rounded-md border border-border bg-card px-2.5 text-xs text-muted-foreground transition-colors hover:border-ring/50"
      >
        <Search className="h-3.5 w-3.5" />
        <span>Search orders, SKUs, people…</span>
        <kbd className="ml-auto hidden rounded border border-border px-1 text-[10px] md:inline">⌘K</kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search orders, SKUs, products, employees, exceptions…" />
        <CommandList>
          <CommandEmpty>No matching records.</CommandEmpty>
          <CommandGroup heading="Orders">
            {state.orders.slice(0, 40).map((o) => (
              <CommandItem key={o.id} value={`${o.id} ${o.customer}`} onSelect={() => go("/orders")}>
                <span className="font-medium">{o.id}</span>
                <span className="text-muted-foreground">
                  {o.customer} · {o.items.length} items · {o.priority} · {o.stage}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Inventory">
            {state.products.slice(0, 40).map((p) => (
              <CommandItem key={p.sku} value={`${p.sku} ${p.name}`} onSelect={() => go("/inventory")}>
                <span className="font-medium">{p.sku}</span>
                <span className="text-muted-foreground">
                  {p.name} · {p.available} available
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Employees">
            {state.employees.map((e) => (
              <CommandItem key={e.id} value={`${e.name} ${e.role}`} onSelect={() => go("/employees")}>
                <span className="font-medium">{e.name}</span>
                <span className="text-muted-foreground">
                  {e.role} · {e.zone}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Exceptions">
            {state.exceptions.map((e) => (
              <CommandItem key={e.id} value={`${e.id} ${e.type} ${e.orderId ?? ""}`} onSelect={() => go("/exceptions")}>
                <span className="font-medium">{e.id}</span>
                <span className="text-muted-foreground">
                  {e.type} · {e.status}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

function Notifications() {
  const { state, markNotification } = useWf();
  const unread = state.notifications.filter((n) => !n.read).length;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="relative flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground">
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">Notifications</p>
          <button className="text-xs text-info hover:underline" onClick={() => markNotification()}>
            Mark all as read
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {state.notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-muted-foreground">Nothing needs your attention.</p>
          ) : (
            state.notifications.slice(0, 20).map((n) => (
              <button
                key={n.id}
                onClick={() => markNotification(n.id)}
                className={cn(
                  "flex w-full gap-2 border-b border-border/60 px-3 py-2.5 text-left transition-colors hover:bg-muted/60",
                  !n.read && "bg-info/5",
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                    n.kind === "critical" ? "bg-destructive" : n.kind === "warning" ? "bg-warning" : "bg-info",
                  )}
                />
                <span className="min-w-0">
                  <span className="block text-xs font-medium text-foreground">{n.title}</span>
                  <span className="block text-xs text-muted-foreground">{n.body}</span>
                  <span className="mt-0.5 block text-[10px] text-muted-foreground">{fmtAgo(n.ts)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function AppShell({ navKey, children }: { navKey: NavKey; children: ReactNode }) {
  const { state, user, logout } = useWf();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) void navigate({ to: "/", replace: true });
  }, [user, navigate]);

  const groups = useMemo(() => {
    const allowed = NAV.filter((n) => canAccess(user?.role, n.key));
    return ["Operations", "Management", "System"]
      .map((g) => ({ group: g, items: allowed.filter((n) => n.group === g) }))
      .filter((g) => g.items.length > 0);
  }, [user?.role]);

  if (!user) return null;

  const denied = !canAccess(user.role, navKey);
  const openExceptions = state.exceptions.filter((e) => e.status !== "Resolved").length;

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-3.5">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-sidebar-primary text-sidebar-primary-foreground">
            <Boxes className="h-4 w-4" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-wide text-white">WAREFLOW</p>
            <p className="text-[10px] text-sidebar-foreground/60">Intelligent Warehouse Ops</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {groups.map((g) => (
            <div key={g.group} className="mb-3">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                {g.group}
              </p>
              {g.items.map((item) => {
                const active = pathname === item.to;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.key}
                    to={item.to}
                    className={cn(
                      "mb-0.5 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                      active
                        ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                    {item.key === "exceptions" && openExceptions > 0 ? (
                      <span className="ml-auto rounded bg-destructive/80 px-1.5 text-[10px] font-semibold text-white">
                        {openExceptions}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-white">
              {user.name
                .split(" ")
                .map((p) => p[0])
                .join("")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">{user.name}</p>
              <p className="truncate text-[10px] text-sidebar-foreground/60">{user.role}</p>
            </div>
            <button
              onClick={() => {
                logout();
                void navigate({ to: "/", replace: true });
              }}
              className="rounded p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-white"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur">
          <Select defaultValue="BLR-01">
            <SelectTrigger className="h-8 w-[186px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BLR-01">BLR-01 · Bengaluru Hub</SelectItem>
              <SelectItem value="DEL-02">DEL-02 · Delhi NCR</SelectItem>
              <SelectItem value="MUM-03">MUM-03 · Bhiwandi</SelectItem>
            </SelectContent>
          </Select>
          <StatusBadge value="Operational" tone="green" />
          <Clock />
          <div className="ml-auto flex items-center gap-2">
            <GlobalSearch />
            <Notifications />
          </div>
          <span className="tabular hidden w-full text-[11px] text-muted-foreground sm:inline sm:w-auto">
            Last updated {fmtAgo(state.updatedAt)}
            <span className="hidden">{tick}</span>
          </span>
        </header>

        <main className="min-w-0 flex-1 p-4 lg:p-6">
          {denied ? (
            <div className="panel mx-auto mt-16 max-w-md p-8 text-center">
              <BadgeCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <h2 className="text-base font-semibold">Restricted section</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Your role ({user.role}) does not have access to this area. Contact an administrator if you
                need it.
              </p>
              <Button className="mt-4" onClick={() => { void navigate({ to: "/overview" as string }); }}>
                Back to Control Tower
              </Button>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
