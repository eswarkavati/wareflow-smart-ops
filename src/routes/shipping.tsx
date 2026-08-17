import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, PackagePlus, Truck } from "lucide-react";
import { AppShell } from "@/components/wf/AppShell";
import { DispatchPanel } from "@/components/wf/DispatchPanel";
import { ImportGoods } from "@/components/wf/ImportGoods";
import { PageHeader } from "@/components/wf/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/shipping")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Shipping — Import & Dispatch — WAREFLOW" },
      {
        name: "description",
        content: "Inbound goods receiving and outbound carrier dispatch in a single shipping control desk.",
      },
      { property: "og:title", content: "Shipping — Import & Dispatch — WAREFLOW" },
      { property: "og:description", content: "Manage inbound receiving and outbound dispatch operations." },
    ],
  }),
  component: () => (
    <AppShell navKey="shipping">
      <Shipping />
    </AppShell>
  ),
});

function Shipping() {
  const [tab, setTab] = useState("import");
  return (
    <>
      <PageHeader
        eyebrow="Operations"
        title="Shipping"
        subtitle="Inbound goods receiving and outbound carrier dispatch"
        action={
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            Dock operations live
          </span>
        }
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="import" className="gap-1.5 text-xs">
            <PackagePlus className="h-3.5 w-3.5" /> Import Goods
          </TabsTrigger>
          <TabsTrigger value="dispatch" className="gap-1.5 text-xs">
            <Truck className="h-3.5 w-3.5" /> Dispatch
          </TabsTrigger>
        </TabsList>
        <TabsContent value="import">
          <ImportGoods />
        </TabsContent>
        <TabsContent value="dispatch">
          <DispatchPanel />
        </TabsContent>
      </Tabs>
    </>
  );
}
