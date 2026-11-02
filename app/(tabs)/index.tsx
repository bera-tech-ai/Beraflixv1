import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ActionButton } from "@/components/beraflix/action-button";
import { BrandHeader } from "@/components/beraflix/brand-header";
import { ContentRail } from "@/components/beraflix/content-rail";
import { EmptyState } from "@/components/beraflix/empty-state";
import { BeraflixScreen } from "@/components/beraflix/screen";
import { SectionHeading } from "@/components/beraflix/section-heading";
import { beraflixColors } from "@/constants/beraflix-theme";
import { getHomeFeed } from "@/lib/beraflix/api";
import { rememberTitle } from "@/lib/beraflix/title-cache";
import type { CatalogTitle, HomeFeed } from "@/lib/beraflix/types";

const sectionLabels: Record<string, string> = {
  Trending: "Trending",
  "Popular Movies": "Popular Movies",
  "Popular Series": "Popular Series",
  "Latest Movies": "Latest Movies",
  "Latest Series": "Latest Series",
};

export default function DiscoverScreen() {
  const router = useRouter();
  const [feed, setFeed] = useState<HomeFeed | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getHomeFeed().then((result) => {
      if (active) setFeed(result);
    }).catch(() => {
      if (active) setFailed(true);
    });
    return () => { active = false; };
  }, []);

  const openTitle = (item: CatalogTitle) => {
    rememberTitle(item);
    router.push({ pathname: "/title/[id]", params: { id: item.id } } as never);
  };
  const featured = feed?.items[0];
  const artwork = featured?.backdropUrl ?? featured?.coverUrl;
  const rails = feed?.sections.map((section) => ({
    section,
    items: feed.items.filter((item) => item.section === section).slice(0, 12),
  })).filter((rail) => rail.items.length > 0) ?? [];

  return (
    <BeraflixScreen>
      <BrandHeader onSearch={() => router.push("/(tabs)/explore" as never)} />

      <View style={styles.hero}>
        {artwork ? <Image source={{ uri: artwork }} contentFit="cover" cachePolicy="memory" transition={0} style={StyleSheet.absoluteFill} /> : null}
        <View pointerEvents="none" style={styles.heroShade} />
        <View style={styles.heroTop}>
          <View style={styles.signalPill}><View style={styles.signalDot} /><Text style={styles.signalLabel}>BERAFLIX PICKS</Text></View>
          <Text style={styles.heroKicker}>MOVIES · SERIES · MORE</Text>
        </View>
        <View style={styles.heroCopy}>
          <Text numberOfLines={2} style={styles.heroTitle}>{featured?.title ?? "Stories worth staying up for."}</Text>
          <Text numberOfLines={3} style={styles.heroBody}>
            {featured?.description || "Discover your next film, series, match, or late-night read."}
          </Text>
          <ActionButton
            label={featured ? "View title" : "Explore titles"}
            onPress={featured ? () => openTitle(featured) : () => router.push("/(tabs)/explore" as never)}
          />
        </View>
        <View style={styles.heroUnderline} />
      </View>

      <View style={styles.section}>
        <SectionHeading title="Continue Watching" eyebrow="Pick up the story" />
        <EmptyState icon="play-circle-outline" title="Nothing to continue yet" message="When you start watching, your place will be kept on this device." />
      </View>

      {rails.map(({ section, items }) => (
        <ContentRail key={section} title={sectionLabels[section] ?? "Discover"} items={items} onSelect={openTitle} />
      ))}
      {!feed && failed ? (
        <EmptyState icon="cloud-offline-outline" title="Catalogue unavailable" message="Try Explore again later. Your device-only shelf remains available." />
      ) : null}
      {feed && feed.items.length === 0 ? (
        <EmptyState icon="film-outline" title="No titles available" message="There are no titles in the current feed." />
      ) : null}
    </BeraflixScreen>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 318, justifyContent: "space-between", overflow: "hidden", padding: 22, borderRadius: 24, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  heroShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(8,9,13,0.76)" },
  heroTop: { gap: 14 },
  signalPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 7, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14, backgroundColor: "#291018" },
  signalDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: beraflixColors.red },
  signalLabel: { color: beraflixColors.white, fontSize: 9, fontWeight: "900", letterSpacing: 1.8 },
  heroKicker: { color: beraflixColors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  heroCopy: { gap: 12, maxWidth: 310 },
  heroTitle: { color: beraflixColors.white, fontSize: 32, lineHeight: 37, fontWeight: "900", letterSpacing: -0.7 },
  heroBody: { color: beraflixColors.muted, fontSize: 14, lineHeight: 21, marginBottom: 4 },
  heroUnderline: { position: "absolute", right: -34, top: 45, width: 130, height: 290, borderLeftWidth: 1, borderColor: "#35111B", transform: [{ rotate: "27deg" }] },
  section: { gap: 14 },
});
