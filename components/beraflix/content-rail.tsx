import { ScrollView, StyleSheet, Text, View } from "react-native";

import { beraflixColors } from "@/constants/beraflix-theme";
import { MediaCard } from "@/components/beraflix/media-card";
import type { CatalogTitle, ExploreContent } from "@/lib/beraflix/types";

export function ContentRail({
  title,
  eyebrow,
  items,
  onSelect,
}: {
  title: string;
  eyebrow?: string;
  items: (CatalogTitle | ExploreContent)[];
  onSelect?: (item: CatalogTitle) => void;
}) {
  if (!items.length) return null;
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <View style={styles.rail} />
        <View style={styles.headingCopy}>
          {eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
          <Text style={styles.title}>{title}</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.items}>
        {items.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            onPress={isCatalogTitle(item) && item.detailPath ? () => onSelect?.(item) : undefined}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function isCatalogTitle(item: CatalogTitle | ExploreContent): item is CatalogTitle {
  return "hasResource" in item;
}

const styles = StyleSheet.create({
  section: { gap: 13 },
  heading: { flexDirection: "row", alignItems: "center", gap: 10 },
  rail: { width: 3, height: 28, borderRadius: 2, backgroundColor: beraflixColors.red },
  headingCopy: { gap: 2 },
  eyebrow: { color: beraflixColors.red, fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: beraflixColors.white, fontSize: 18, fontWeight: "800" },
  items: { gap: 12, paddingRight: 20 },
});
