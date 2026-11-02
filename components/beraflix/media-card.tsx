import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { beraflixColors } from "@/constants/beraflix-theme";
import type { CatalogTitle, ExploreContent } from "@/lib/beraflix/types";

export function MediaCard({ item, onPress }: { item: CatalogTitle | ExploreContent; onPress?: () => void }) {
  const artwork = item.coverUrl;
  const subtitle = "genre" in item ? item.genre || item.releaseDate : item.subtitle;
  const body = (
    <>
      <View style={styles.poster}>
        {artwork ? (
          <Image source={{ uri: artwork }} contentFit="cover" cachePolicy="memory" transition={0} style={StyleSheet.absoluteFill} />
        ) : (
          <View style={styles.artFallback}>
            <Ionicons name="film-outline" size={24} color={beraflixColors.red} />
            <View style={styles.signal} />
          </View>
        )}
        {"rating" in item && item.rating ? <Text style={styles.rating}>{item.rating}</Text> : null}
      </View>
      <Text numberOfLines={2} style={styles.title}>{item.title}</Text>
      {subtitle ? <Text numberOfLines={1} style={styles.subtitle}>{subtitle}</Text> : null}
    </>
  );

  if (!onPress) return <View style={styles.card}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { width: 122, gap: 6 },
  poster: { height: 172, overflow: "hidden", borderRadius: 14, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  artFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: beraflixColors.elevated },
  signal: { position: "absolute", left: 0, top: 35, width: 3, height: 54, backgroundColor: beraflixColors.red },
  rating: { position: "absolute", right: 7, top: 7, color: beraflixColors.white, backgroundColor: "rgba(8,9,13,0.84)", paddingHorizontal: 7, paddingVertical: 4, borderRadius: 8, fontSize: 9, fontWeight: "800" },
  title: { color: beraflixColors.white, fontSize: 12, fontWeight: "800", lineHeight: 16 },
  subtitle: { color: beraflixColors.muted, fontSize: 10 },
  pressed: { opacity: 0.78 },
});
