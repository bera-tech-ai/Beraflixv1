import { searchTitles } from "@/lib/beraflix/api";
import type { CatalogTitle } from "@/lib/beraflix/types";

const titles = new Map<string, CatalogTitle>();
const MAX_CACHED_TITLES = 250;

export function rememberTitle(item: CatalogTitle): void {
  if (!item.id) return;
  const previous = titles.get(item.id);
  const memoryOnly = !item.detailPath && previous?.detailPath
    ? { ...item, detailPath: previous.detailPath }
    : item;
  titles.set(item.id, memoryOnly);
  while (titles.size > MAX_CACHED_TITLES) {
    const oldest = titles.keys().next().value;
    if (oldest === undefined) break;
    titles.delete(oldest);
  }
}

export function getRememberedTitle(id: string): CatalogTitle | null {
  return titles.get(id) ?? null;
}

function searchMode(item: CatalogTitle): "movies" | "series" | "anime" {
  if (/anime/i.test(item.type)) return "anime";
  if (/series|tv|show/i.test(item.type)) return "series";
  return "movies";
}

export async function resolveTitleForPlayback(item: CatalogTitle): Promise<CatalogTitle | null> {
  if (item.detailPath) {
    rememberTitle(item);
    return item;
  }
  const remembered = titles.get(item.id);
  if (remembered?.detailPath) return remembered;
  const results = await searchTitles(item.title, searchMode(item), 1);
  const exact = results.find((candidate) => candidate.id === item.id && Boolean(candidate.detailPath));
  if (exact) rememberTitle(exact);
  return exact ?? null;
}
