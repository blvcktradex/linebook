import { manifest } from "@/data/manifest";
import type { SpotSolution, SpotSummary } from "@/lib/solutions/types";

const loaders: Record<string, () => Promise<{ default: SpotSolution }>> = {
  "btn-bb-qjh": () => import("@/data/spots/btn-bb-qjh"),
  "btn-bb-k72": () => import("@/data/spots/btn-bb-k72"),
  "btn-bb-994": () => import("@/data/spots/btn-bb-994"),
  "co-btn-876": () => import("@/data/spots/co-btn-876"),
  "btn-bb-river-ak": () => import("@/data/spots/btn-bb-river-ak"),
};

export function listSpots(): SpotSummary[] {
  return manifest;
}

export async function loadSpot(id: string): Promise<SpotSolution | null> {
  const loader = loaders[id];
  if (!loader) return null;
  const mod = await loader();
  return mod.default;
}

export async function loadAllSpots(): Promise<SpotSolution[]> {
  const spots = await Promise.all(manifest.map((spot) => loadSpot(spot.id)));
  return spots.filter((spot): spot is SpotSolution => spot !== null);
}
