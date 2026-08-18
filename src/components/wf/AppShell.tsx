import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  ClipboardList,
  Cog,
  DoorOpen,
  LayoutGrid,
  LogOut,
  MapPin,
  Menu,
  Moon,
  PackageCheck,
  RefreshCw,
  ScrollText,
  Search,
  ShieldCheck,
  Split,
  Sun,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import { useWf } from "@/lib/wf/store";
import { canAccess, fmtAgo, type NavKey } from "@/lib/wf/engine";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";



const GROUP_ORDER = ["Command", "Operations", "Intelligence", "Management", "System"] as const;

const NAV: { key: NavKey; label: string; to: string; icon: typeof LayoutGrid; group: string }[] = [
  { key: "overview", label: "Overview", to: "/overview", icon: LayoutGrid, group: "Command" },
  { key: "orders", label: "Orders", to: "/orders", icon: ClipboardList, group: "Operations" },
  { key: "inventory", label: "Inventory", to: "/inventory", icon: Boxes, group: "Operations" },
  { key: "allocation", label: "Allocation", to: "/allocation", icon: Split, group: "Operations" },
  { key: "picking", label: "Picking", to: "/picking", icon: Activity, group: "Operations" },
  { key: "packing", label: "Packing & QC", to: "/packing", icon: PackageCheck, group: "Operations" },
  { key: "shipping", label: "Shipping", to: "/shipping", icon: Truck, group: "Operations" },
  { key: "gate-entry", label: "Gate Entry", to: "/gate-entry", icon: DoorOpen, group: "Operations" },
  { key: "exceptions", label: "Exceptions", to: "/exceptions", icon: AlertTriangle, group: "Operations" },
  { key: "replenishment", label: "Replenishment", to: "/replenishment", icon: RefreshCw, group: "Operations" },
  { key: "analytics", label: "Analytics", to: "/analytics", icon: BarChart3, group: "Intelligence" },
  { key: "employees", label: "Employees", to: "/employees", icon: Users, group: "Management" },
  { key: "users", label: "Users & Roles", to: "/users", icon: ShieldCheck, group: "Management" },
  { key: "audit", label: "Audit Logs", to: "/audit", icon: ScrollText, group: "Management" },
  { key: "settings", label: "Settings", to: "/settings", icon: Cog, group: "System" },
];

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const saved = (localStorage.getItem("wf-theme") as "light" | "dark" | null) ?? "light";
    setTheme(saved);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("wf-theme", theme);
  }, [theme]);
  return { theme, setTheme };
}


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

type NavItem = (typeof NAV)[number];

function SidebarNav({
  groups,
  pathname,
  openExceptions,
  onNavigate,
}: {
  groups: { group: string; items: NavItem[] }[];
  pathname: string;
  openExceptions: number;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      {groups.map((g) => (
        <div key={g.group} className="mb-4">
          <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
            {g.group}
          </p>
          {g.items.map((item) => {
            const active = pathname === item.to;
            const Icon = item.icon;
            return (
              <Link
                key={item.key}
                to={item.to}
                onClick={onNavigate}
                className={cn(
                  "relative mb-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors",
                  active
                    ? "bg-accent font-semibold text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {active ? (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full bg-primary" />
                ) : null}
                <Icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                {item.label}
                {item.key === "exceptions" && openExceptions > 0 ? (
                  <span className="ml-auto rounded-full bg-accent px-1.5 text-[10px] font-semibold text-primary">
                    {openExceptions}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 border-b border-sidebar-border px-4 py-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Warehouse className="h-4 w-4" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight text-foreground">WAREFLOW</p>
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Intelligence</p>
      </div>
    </div>
  );
}

export function AppShell({ navKey, children }: { navKey: NavKey; children: ReactNode }) {
  const { state, user, logout, lastSyncAt, nextSyncAt, syncing, refreshNow, liveUpdates, setLiveUpdates } = useWf();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [tick, setTick] = useState(0);
  const [mobileNav, setMobileNav] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!user) void navigate({ to: "/", replace: true });
  }, [user, navigate]);

  const groups = useMemo(() => {
    const allowed = NAV.filter((n) => canAccess(user?.role, n.key));
    return GROUP_ORDER.map((g) => ({ group: g as string, items: allowed.filter((n) => n.group === g) })).filter(
      (g) => g.items.length > 0,
    );
  }, [user?.role]);

  if (!user) return null;

  const denied = !canAccess(user.role, navKey);
  const openExceptions = state.exceptions.filter((e) => e.status !== "Resolved").length;
  const current = NAV.find((n) => n.key === navKey)?.label ?? "Overview";
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .join("");

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <Brand />
        <SidebarNav groups={groups} pathname={pathname} openExceptions={openExceptions} />
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-primary">
              {initials}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-xs font-medium text-foreground">{user.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">{user.role}</p>
            </div>
            <button
              onClick={() => {
                logout();
                void navigate({ to: "/", replace: true });
              }}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
              aria-label="Log out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <Sheet open={mobileNav} onOpenChange={setMobileNav}>
        <SheetContent side="left" className="w-[260px] bg-sidebar p-0">
          <Brand />
          <SidebarNav
            groups={groups}
            pathname={pathname}
            openExceptions={openExceptions}
            onNavigate={() => setMobileNav(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2.5 border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur">
          <button
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground md:hidden"
            onClick={() => setMobileNav(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5 text-xs">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Bangalore Hub</span>
            <span className="text-muted-foreground/50">/</span>
            <span className="font-semibold text-foreground">{current}</span>
          </div>
          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted-foreground sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            Live Operations
          </span>
          <Clock />

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <GlobalSearch />
            <button
              onClick={refreshNow}
              title="Automatic sync every 30 minutes — click to sync now"
              className="tabular flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin text-primary")} />
              {syncing ? "Syncing…" : `Last updated ${fmtAgo(lastSyncAt)}`}
              {!syncing && liveUpdates ? (
                <span className="hidden text-muted-foreground/70 xl:inline">
                  · next in {Math.max(0, Math.round((new Date(nextSyncAt).getTime() - Date.now()) / 60000))}m
                </span>
              ) : null}
              <span className="hidden">{tick}</span>
            </button>
            <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1">
              <Switch
                id="live-updates"
                checked={liveUpdates}
                onCheckedChange={setLiveUpdates}
                aria-label="Toggle live updates"
              />
              <label htmlFor="live-updates" className="cursor-pointer text-[11px] font-medium text-muted-foreground">
                Live Updates
              </label>
            </div>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Toggle appearance"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Notifications />
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 rounded-md border border-border bg-card px-1.5 py-1 text-left transition-colors hover:bg-muted">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-primary">
                    {initials}
                  </span>
                  <span className="hidden leading-tight lg:block">
                    <span className="block text-[11px] font-medium text-foreground">{user.name}</span>
                    <span className="block text-[10px] text-muted-foreground">{user.role}</span>
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-1.5">
                <div className="border-b border-border px-2 pb-2 pt-1">
                  <p className="text-sm font-medium text-foreground">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.role}</p>
                </div>
                <Link
                  to="/settings"
                  className="mt-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <Cog className="h-4 w-4 text-muted-foreground" /> Settings
                </Link>
                <button
                  onClick={() => {
                    logout();
                    void navigate({ to: "/", replace: true });
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-primary transition-colors hover:bg-accent"
                >
                  <LogOut className="h-4 w-4" /> Log out
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </header>

        <main className="min-w-0 flex-1 p-4 lg:p-6">
          <div key={navKey} className="page-enter mx-auto w-full max-w-[1560px]">
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
          </div>
        </main>
      </div>
    </div>
  );
}
