import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "@/components/beraflix/action-button";
import { BrandHeader } from "@/components/beraflix/brand-header";
import { ContentRail } from "@/components/beraflix/content-rail";
import { EmptyState } from "@/components/beraflix/empty-state";
import { ModeChip } from "@/components/beraflix/mode-chip";
import { BeraflixScreen } from "@/components/beraflix/screen";
import { beraflixColors, shelfSections, type ShelfSection } from "@/constants/beraflix-theme";
import { getContinueItems, getHistoryItems, getListItems, useLibrary } from "@/lib/beraflix/library";
import { rememberTitle } from "@/lib/beraflix/title-cache";
import type { CatalogTitle } from "@/lib/beraflix/types";

export default function ShelfScreen() {
  const router = useRouter();
  const { state, hydrated } = useLibrary();
  const [section, setSection] = useState<ShelfSection>("Continue");
  const titles = section === "Continue" ? getContinueItems(state)
    : section === "History" ? getHistoryItems(state)
      : section === "Watchlist" ? getListItems(state, "watchlist")
        : section === "Favorites" ? getListItems(state, "favorites")
          : section === "Liked" ? getListItems(state, "liked")
            : section === "Watched" ? getListItems(state, "watched") : [];
  const openTitle = (item: CatalogTitle) => {
    rememberTitle(item);
    router.push({ pathname: "/title/[id]", params: { id: item.id } } as never);
  };

  return (
    <BeraflixScreen>
      <BrandHeader />
      <View style={styles.headingBlock}>
        <Text style={styles.eyebrow}>KEPT ON THIS DEVICE</Text>
        <Text style={styles.title}>My Shelf</Text>
        <Text style={styles.subtitle}>Your library stays private and local.</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
        {shelfSections.map((item) => <ModeChip key={item} label={item} selected={section === item} onPress={() => setSection(item)} />)}
      </ScrollView>

      {!hydrated ? <Text style={styles.status}>Reading your device shelf…</Text> : null}
      {hydrated && section === "Collections" ? (
        <View style={styles.collectionArea}>
          {state.collections.length > 0 ? state.collections.map((collection) => (
            <Pressable key={collection.id} accessibilityRole="button" onPress={() => router.push({ pathname: "/collections/[id]", params: { id: collection.id } } as never)} style={({ pressed }) => [styles.collectionCard, pressed && styles.pressed]}>
              <View style={styles.collectionIcon}><Text style={styles.collectionInitial}>{collection.name.slice(0, 1).toUpperCase()}</Text></View>
              <View style={styles.collectionCopy}><Text style={styles.collectionName}>{collection.name}</Text><Text style={styles.collectionCount}>{collection.itemIds.length} titles</Text></View>
            </Pressable>
          )) : <EmptyState icon="albums-outline" title="Your collections start here" message="Create a private collection to group titles your way." />}
          <ActionButton label="Create collection" onPress={() => router.push("/collections/create" as never)} />
        </View>
      ) : null}
      {hydrated && section !== "Collections" && titles.length > 0 ? <ContentRail title={section} items={titles} onSelect={openTitle} /> : null}
      {hydrated && section !== "Collections" && titles.length === 0 ? (
        <EmptyState
          icon={section === "Continue" ? "play-circle-outline" : "bookmark-outline"}
          title={emptyTitles[section]}
          message="Saved titles and viewing activity are stored only in this app on this device."
        />
      ) : null}
    </BeraflixScreen>
  );
}

const emptyTitles: Record<ShelfSection, string> = {
  Continue: "Nothing in progress yet",
  Watchlist: "Your watchlist is clear",
  Favorites: "No favorites saved yet",
  Liked: "Nothing liked yet",
  Watched: "No watched titles yet",
  History: "Your history starts here",
  Collections: "Your collections start here",
};

const styles = StyleSheet.create({
  headingBlock: { gap: 4 },
  eyebrow: { color: beraflixColors.red, fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  title: { color: beraflixColors.white, fontSize: 32, fontWeight: "900", letterSpacing: -0.5 },
  subtitle: { color: beraflixColors.muted, fontSize: 13, marginTop: 2 },
  rail: { gap: 8, paddingRight: 20 },
  status: { color: beraflixColors.muted, fontSize: 12, paddingVertical: 8 },
  collectionArea: { gap: 12 },
  collectionCard: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 16, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  collectionIcon: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#291018" },
  collectionInitial: { color: beraflixColors.red, fontSize: 18, fontWeight: "900" },
  collectionCopy: { gap: 4 },
  collectionName: { color: beraflixColors.white, fontSize: 13, fontWeight: "800" },
  collectionCount: { color: beraflixColors.muted, fontSize: 10 },
  pressed: { opacity: 0.76 },
});
