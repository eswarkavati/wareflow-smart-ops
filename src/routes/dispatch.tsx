import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dispatch")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/shipping" });
  },
  component: () => null,
});
