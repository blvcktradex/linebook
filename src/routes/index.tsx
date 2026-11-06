import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  loader: () => {
    throw redirect({ to: "/spots/$spotId", params: { spotId: "btn-bb-qjh" } });
  },
  component: () => null,
});
