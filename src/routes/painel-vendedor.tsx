import { createFileRoute, redirect } from "@tanstack/react-router";

// Alias: /painel-vendedor -> /painel (painel do próprio box do vendedor)
export const Route = createFileRoute("/painel-vendedor")({
  beforeLoad: () => {
    throw redirect({ to: "/painel", replace: true });
  },
  component: () => null,
});
