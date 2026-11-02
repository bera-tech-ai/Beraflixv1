import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, Text } from "react-native";

import { ActionButton } from "@/components/beraflix/action-button";
import { BrandHeader } from "@/components/beraflix/brand-header";
import { ContentRail } from "@/components/beraflix/content-rail";
import { EmptyState } from "@/components/beraflix/empty-state";
import { BeraflixScreen } from "@/components/beraflix/screen";
import { beraflixColors } from "@/constants/beraflix-theme";
import { useLibrary } from "@/lib/beraflix/library";
import { rememberTitle } from "@/lib/beraflix/title-cache";
import type { CatalogTitle } from "@/lib/beraflix/types";

export default function CollectionDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, hydrated } = useLibrary();
  const collection = state.collections.find((item) => item.id === String(id ?? ""));
  const items = collection?.itemIds.map((itemId) => state.items[itemId]).filter((item): item is CatalogTitle => Boolean(item)) ?? [];
  const openTitle = (item: CatalogTitle) => {
    rememberTitle(item);
    router.push({ pathname: "/title/[id]", params: { id: item.id } } as never);
  };

  return (
    <BeraflixScreen>
      <BrandHeader />
      <Text style={styles.eyebrow}>MY SHELF · COLLECTION</Text>
      <Text style={styles.title}>{collection?.name ?? "Collection"}</Text>
      <Text style={styles.subtitle}>Saved on this device only.</Text>
      {!hydrated ? <Text style={styles.status}>Reading your device shelf…</Text> : null}
      {hydrated && !collection ? <EmptyState icon="albums-outline" title="Collection not found" message="It may have been removed from this device." /> : null}
      {hydrated && collection && items.length > 0 ? <ContentRail title="Titles" items={items} onSelect={openTitle} /> : null}
      {hydrated && collection && items.length === 0 ? <EmptyState icon="albums-outline" title="No titles in this collection" message="Add a title from its detail screen to see it here." /> : null}
      <ActionButton label="Back to My Shelf" onPress={() => router.back()} secondary />
    </BeraflixScreen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: beraflixColors.red, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: beraflixColors.white, fontSize: 29, fontWeight: "900" },
  subtitle: { color: beraflixColors.muted, fontSize: 12 },
  status: { color: beraflixColors.muted, fontSize: 12, paddingVertical: 8 },
});
