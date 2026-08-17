import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Boxes, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useWf } from "@/lib/wf/store";
import { DEMO_ACCOUNTS } from "@/lib/wf/seed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import warehouseImg from "@/assets/warehouse-login.jpg";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — WAREFLOW Warehouse Operations" },
      {
        name: "description",
        content:
          "Sign in to WAREFLOW to run Bangalore Hub fulfilment operations: allocation, picking, packing, QC and dispatch.",
      },
      { property: "og:title", content: "Sign in — WAREFLOW" },
      { property: "og:description", content: "Warehouse control platform sign-in for the Bangalore Hub." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, login, state } = useWf();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@wareflow.demo");
  const [password, setPassword] = useState("wareflow");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [remember, setRemember] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);


  useEffect(() => {
    if (user) void navigate({ to: "/overview", replace: true });
  }, [user, navigate]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Enter a valid work email address.");
    if (password.length < 4) return setError("Password must be at least 4 characters.");
    setBusy(true);
    setTimeout(() => {
      const ok = login(email);
      setBusy(false);
      if (!ok) setError("No warehouse account matches that email. Select a role below to continue.");
      else void navigate({ to: "/overview", replace: true });
    }, 400);
  };

  const roles = DEMO_ACCOUNTS.map((a) => ({
    email: a.email,
    role: state.employees.find((e) => e.id === a.id)?.role ?? "Operator",
  }));

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-sidebar lg:block">
        <img
          src={warehouseImg}
          alt="Distribution warehouse racking and conveyor lines"
          width={1280}
          height={1600}
          className="absolute inset-0 h-full w-full object-cover opacity-25 grayscale"
        />
        <div className="absolute inset-0 bg-[linear-gradient(160deg,oklch(0.18_0.01_264)_0%,oklch(0.22_0.03_26)_55%,oklch(0.30_0.10_27)_100%)] opacity-95" />
        <svg className="absolute inset-0 h-full w-full opacity-[0.16]" aria-hidden="true">
          <defs>
            <pattern id="floor" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M48 0H0V48" fill="none" stroke="white" strokeWidth="0.6" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#floor)" />
          <g fill="none" stroke="oklch(0.62 0.19 27)" strokeWidth="2">
            <rect x="8%" y="34%" width="26%" height="7%" />
            <rect x="8%" y="46%" width="26%" height="7%" />
            <rect x="42%" y="34%" width="34%" height="7%" />
            <rect x="42%" y="46%" width="34%" height="7%" />
            <rect x="8%" y="66%" width="68%" height="10%" strokeDasharray="8 6" />
          </g>
        </svg>
        <div className="relative flex h-full flex-col justify-between p-10 text-sidebar-foreground">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Boxes className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-[0.28em] text-sidebar-foreground">WAREFLOW</span>
          </div>

          <div className="max-w-lg">
            <p className="text-[11px] uppercase tracking-[0.28em] text-sidebar-foreground/60">
              Bangalore Hub · Operational
            </p>
            <h2 className="mt-3 text-3xl font-semibold leading-tight text-sidebar-foreground">
              Intelligent Warehouse Operations
            </h2>
            <p className="mt-4 text-lg font-medium tracking-[0.08em] text-primary">See. Decide. Act.</p>

            <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-sidebar-border/70 pt-6">
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-sidebar-foreground/50">Orders / day</dt>
                <dd className="tabular text-2xl font-semibold text-sidebar-foreground">3,410</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-sidebar-foreground/50">On-time</dt>
                <dd className="tabular text-2xl font-semibold text-sidebar-foreground">96.4%</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-sidebar-foreground/50">Zones</dt>
                <dd className="tabular text-2xl font-semibold text-sidebar-foreground">13</dd>
              </div>
            </dl>
          </div>

          <p className="text-[11px] text-sidebar-foreground/40">
            Synthetic demonstration data. Not connected to any external retailer system.
          </p>
        </div>
      </div>


      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded bg-primary text-primary-foreground">
              <Boxes className="h-4 w-4" />
            </div>
            <span className="text-sm font-semibold tracking-[0.28em]">WAREFLOW</span>
          </div>

          <div className="panel p-6">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> Secure operator access
            </span>
            <h1 className="mt-3 text-xl font-semibold tracking-tight">Sign in to WAREFLOW</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Intelligent warehouse operations &amp; fulfilment control
            </p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Work email</Label>
                <Input id="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[var(--primary)]"
                  />
                  Remember me
                </label>
                <button type="button" className="text-xs text-primary hover:underline">
                  Forgot password?
                </button>
              </div>
              {error ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Lock className="mr-1.5 h-3.5 w-3.5" />}
                Sign in
              </Button>
            </form>

            <div className="mt-6 border-t border-border pt-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Demo accounts
              </p>
              <div className="grid grid-cols-2 gap-2">
                {roles.map((r) => (
                  <button
                    key={r.email}
                    type="button"
                    onClick={() => {
                      setEmail(r.email);
                      setPassword("wareflow");
                      setSelected(r.role);
                      setError("");
                    }}
                    className={cn(
                      "rounded-md border bg-card px-2.5 py-2 text-left text-xs font-medium transition-colors hover:border-primary/50 hover:bg-accent",
                      selected === r.role ? "border-primary bg-accent text-primary" : "border-border",
                    )}
                  >
                    {r.role}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                {selected
                  ? `${selected} demo account selected — press Sign in to continue.`
                  : "Select a role to prefill credentials. Accounts are not signed in automatically."}
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
