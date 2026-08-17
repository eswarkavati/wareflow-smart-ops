import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Boxes, Loader2 } from "lucide-react";
import { useWf } from "@/lib/wf/store";
import { DEMO_ACCOUNTS } from "@/lib/wf/seed";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — WAREFLOW Warehouse Operations" },
      {
        name: "description",
        content: "Sign in to WAREFLOW to run fulfilment operations: allocation, picking, packing, QC and dispatch.",
      },
      { property: "og:title", content: "Sign in — WAREFLOW" },
      { property: "og:description", content: "Warehouse control platform sign-in." },
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
      if (!ok) setError("No warehouse account matches that email. Try a demo account below.");
      else void navigate({ to: "/overview", replace: true });
    }, 400);
  };

  const roleOf = (id: string) => state.employees.find((e) => e.id === id)?.role ?? "";

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-sidebar-primary text-sidebar-primary-foreground">
            <Boxes className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold tracking-widest text-white">WAREFLOW</span>
        </div>
        <div className="max-w-md">
          <h2 className="text-2xl font-semibold leading-snug text-white">
            See. Decide. Act. Verify.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-sidebar-foreground/70">
            WAREFLOW does more than report warehouse activity — it scores order priority, resolves inventory
            conflicts, optimises pick routes and drives every exception to closure with a full audit trail.
          </p>
          <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-sidebar-border pt-6 text-white">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-sidebar-foreground/50">Orders / day</dt>
              <dd className="tabular text-xl font-semibold">3,410</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-sidebar-foreground/50">On-time</dt>
              <dd className="tabular text-xl font-semibold">96.4%</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-sidebar-foreground/50">Zones</dt>
              <dd className="tabular text-xl font-semibold">7</dd>
            </div>
          </dl>
        </div>
        <p className="text-[11px] text-sidebar-foreground/40">
          Synthetic demonstration data. Not connected to any external retailer system.
        </p>
      </div>

      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="text-sm font-semibold tracking-widest">WAREFLOW</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Sign in to WAREFLOW</h1>
          <p className="mt-1 text-sm text-muted-foreground">Intelligent Warehouse Operations & Fulfilment</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
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
            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Sign in
            </Button>
          </form>

          <div className="mt-8 rounded-md border border-border bg-card p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Demo accounts
            </p>
            <div className="space-y-1">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  onClick={() => setEmail(a.email)}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted"
                >
                  <span className="font-medium">{a.email}</span>
                  <span className="text-muted-foreground">{roleOf(a.id)}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 px-2 text-[11px] text-muted-foreground">Any password with 4+ characters.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
