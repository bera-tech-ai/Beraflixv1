import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { BrandHeader } from "@/components/beraflix/brand-header";
import { ContentRail } from "@/components/beraflix/content-rail";
import { EmptyState } from "@/components/beraflix/empty-state";
import { MediaCard } from "@/components/beraflix/media-card";
import { BeraflixScreen } from "@/components/beraflix/screen";
import { ModeChip } from "@/components/beraflix/mode-chip";
import { SectionHeading } from "@/components/beraflix/section-heading";
import { beraflixColors, exploreModes, type ExploreMode } from "@/constants/beraflix-theme";
import { browseCatalog, getChannels, getCountries, getNovelHome, getSportsMatches, getWrestlingEvents, searchTitles } from "@/lib/beraflix/api";
import type { CatalogTitle, ChannelRecord, CountryRecord, ExploreContent } from "@/lib/beraflix/types";
import { rememberTitle } from "@/lib/beraflix/title-cache";

export default function ExploreScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<ExploreMode>("movies");
  const [country, setCountry] = useState("");
  const [countries, setCountries] = useState<CountryRecord[]>([]);
  const [query, setQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState<CatalogTitle[]>([]);
  const [otherResults, setOtherResults] = useState<ExploreContent[]>([]);
  const [channels, setChannels] = useState<ChannelRecord[]>([]);
  const [updating, setUpdating] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showAllChannels, setShowAllChannels] = useState(false);
  const isChannels = mode === "channels";

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setUpdating(true);
      setFailed(false);
      setCatalogResults([]);
      setOtherResults([]);
      setChannels([]);
      if (mode === "channels" && !country) setCountries([]);
      setShowAllChannels(false);
      const load = async () => {
        try {
          if (mode === "movies" || mode === "series") {
            const items = query.trim()
              ? await searchTitles(query, mode)
              : await browseCatalog(mode === "movies" ? "popularMovies" : "popularSeries");
            if (active) setCatalogResults(items);
          } else if (mode === "anime") {
            const items = query.trim() ? await searchTitles(query, "anime") : [];
            if (active) setCatalogResults(items);
          } else if (mode === "channels") {
            if (!country) {
              const items = await getCountries();
              if (active) setCountries(items);
            } else {
              const items = await getChannels(country);
              if (active) setChannels(items);
            }
          } else {
            const items = mode === "books" ? await getNovelHome()
              : mode === "sports" ? await getSportsMatches()
                : await getWrestlingEvents();
            if (active) setOtherResults(items);
          }
        } catch {
          if (active) setFailed(true);
        } finally {
          if (active) setUpdating(false);
        }
      };
      void load();
    }, query.trim() ? 280 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [mode, query, country]);

  const openTitle = (item: CatalogTitle) => {
    rememberTitle(item);
    router.push({ pathname: "/title/[id]", params: { id: item.id } } as never);
  };
  const countryLabel = countries.find((item) => item.code === country)?.name ?? country.toUpperCase();

  return (
    <BeraflixScreen>
      <BrandHeader />
      <View style={styles.headingBlock}>
        <Text style={styles.eyebrow}>FIND YOUR NEXT</Text>
        <Text style={styles.title}>Explore</Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={19} color={beraflixColors.muted} />
        <TextInput
          accessibilityLabel="Search movies, series, and more"
          onChangeText={setQuery}
          placeholder="Search titles, teams, or books"
          placeholderTextColor={beraflixColors.quiet}
          returnKeyType="search"
          style={styles.searchInput}
          value={query}
        />
        {query.length > 0 ? <Pressable accessibilityLabel="Clear search" onPress={() => setQuery("")} hitSlop={10}><Ionicons name="close-circle" size={18} color={beraflixColors.muted} /></Pressable> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modeRail}>
        {exploreModes.map((item) => <ModeChip key={item.id} label={item.label} selected={mode === item.id} onPress={() => { setMode(item.id); if (item.id === "channels") setCountry(""); }} />)}
      </ScrollView>

      {isChannels ? (
        <View style={styles.section}>
          <SectionHeading title={country ? `${countryLabel} Channels` : "Choose a country"} eyebrow="Browse live channels" />
          {!country ? <View style={styles.countryList}>{countries.map((item) => <Pressable key={item.code} accessibilityRole="button" onPress={() => setCountry(item.code)} style={({ pressed }) => [styles.countryRow, pressed && styles.pressed]}><View style={styles.countryMark}><Ionicons name="globe-outline" size={17} color={beraflixColors.red} /></View><View style={styles.channelCopy}><Text style={styles.channelName}>{item.name}</Text><Text style={styles.channelMeta}>{item.channelCount} channel{item.channelCount === 1 ? "" : "s"}{item.timeZone ? ` · ${item.timeZone}` : ""}</Text></View><Ionicons name="chevron-forward" size={19} color={beraflixColors.muted} /></Pressable>)}</View> : <><Pressable accessibilityRole="button" onPress={() => setCountry("")} style={({ pressed }) => [styles.backCountry, pressed && styles.pressed]}><Ionicons name="arrow-back" size={17} color={beraflixColors.red} /><Text style={styles.showMoreText}>Choose another country</Text></Pressable><Pressable accessibilityRole="button" onPress={() => router.push("/channels/channel9" as never)} style={({ pressed }) => [styles.scheduleCard, pressed && styles.pressed]}><View style={styles.scheduleIcon}><Ionicons name="calendar-outline" size={21} color={beraflixColors.red} /></View><View style={styles.scheduleCopy}><Text style={styles.scheduleTitle}>Channel 9 Schedule</Text><Text style={styles.scheduleBody}>See what’s on and what’s coming up.</Text></View><Ionicons name="chevron-forward" size={19} color={beraflixColors.muted} /></Pressable></>}
        </View>
      ) : (
        <SectionHeading title={exploreModes.find((item) => item.id === mode)?.label ?? "Explore"} eyebrow={query.trim() ? "Search results" : "Browse by category"} />
      )}

      {updating ? <Text style={styles.statusLabel}>Refreshing catalogue…</Text> : null}
      {failed ? <EmptyState icon="cloud-offline-outline" title="Catalogue unavailable" message="This section could not be refreshed. Try again later." /> : null}

      {!updating && !failed && catalogResults.length > 0 ? <ContentRail title={query.trim() ? "Results" : "Popular now"} items={catalogResults} onSelect={openTitle} /> : null}
      {!updating && !failed && otherResults.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.resultRail}>
          {otherResults.map((item) => <MediaCard key={item.id} item={item} />)}
        </ScrollView>
      ) : null}
      {!updating && !failed && isChannels && channels.length > 0 ? (
        <View style={styles.channelList}>
          {country && channels.slice(0, showAllChannels ? 30 : 6).map((item) => (
            <Pressable key={item.id} accessibilityRole="button" onPress={() => router.push({ pathname: "/channels/[country]/[id]", params: { country, id: item.id, name: item.name } } as never)} style={({ pressed }) => [styles.channelRow, pressed && styles.pressed]}>
              <View style={styles.channelMark}><Ionicons name="tv-outline" size={17} color={beraflixColors.red} /></View>
              <View style={styles.channelCopy}><Text numberOfLines={1} style={styles.channelName}>{item.name}</Text><Text style={styles.channelMeta}>{item.country || countryLabel}{item.languages.length ? ` · ${item.languages.slice(0, 2).join(", ")}` : ""}</Text></View>
              <Ionicons name="play-circle-outline" size={22} color={beraflixColors.red} />
            </Pressable>
          ))}
          {country && channels.length > 6 ? <Pressable accessibilityRole="button" onPress={() => setShowAllChannels((value) => !value)} style={({ pressed }) => [styles.showMoreButton, pressed && styles.pressed]}><Text style={styles.showMoreText}>{showAllChannels ? "Show fewer channels" : `Show all ${Math.min(channels.length, 30)} channels`}</Text><Ionicons name={showAllChannels ? "chevron-up" : "chevron-down"} size={17} color={beraflixColors.red} /></Pressable> : null}
        </View>
      ) : null}
      {!updating && !failed && isChannels && country && channels.length === 0 ? <EmptyState icon="tv-outline" title="No channels found" message="No channel records are available for this country." /> : null}
      {!updating && !failed && mode === "anime" && !query.trim() ? <EmptyState icon="sparkles-outline" title="Search Anime" message="Enter a title above to search the verified Anime catalogue." /> : null}
      {!updating && !failed && (mode === "sports" || mode === "books" || mode === "wrestling") && otherResults.length === 0 ? <EmptyState icon={mode === "sports" ? "football-outline" : mode === "books" ? "book-outline" : "trophy-outline"} title="No titles available" message="There are no items in this section right now." /> : null}
      {!updating && !failed && (mode === "movies" || mode === "series" || (mode === "anime" && query.trim())) && catalogResults.length === 0 ? <EmptyState icon="search-outline" title={query.trim() ? "No matches found" : "No titles available"} message={query.trim() ? "Try another title or search term." : "There are no titles in this section right now."} /> : null}
    </BeraflixScreen>
  );
}

const styles = StyleSheet.create({
  headingBlock: { gap: 3, marginTop: 2 },
  eyebrow: { color: beraflixColors.red, fontSize: 10, fontWeight: "800", letterSpacing: 1.7 },
  title: { color: beraflixColors.white, fontSize: 32, fontWeight: "900", letterSpacing: -0.4 },
  searchBox: { minHeight: 52, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 16, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  searchInput: { flex: 1, color: beraflixColors.white, fontSize: 14, paddingVertical: 10 },
  modeRail: { gap: 8, paddingRight: 20 },
  section: { gap: 14 },
  countryList: { overflow: "hidden", borderRadius: 18, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  countryRow: { minHeight: 65, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: beraflixColors.border },
  countryMark: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#291018" },
  backCountry: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 7 },
  scheduleCard: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 76, padding: 14, borderRadius: 18, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  scheduleIcon: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#291018" },
  scheduleCopy: { flex: 1, gap: 4 },
  scheduleTitle: { color: beraflixColors.white, fontSize: 14, fontWeight: "800" },
  scheduleBody: { color: beraflixColors.muted, fontSize: 12 },
  statusLabel: { color: beraflixColors.muted, fontSize: 12, paddingVertical: 4 },
  resultRail: { gap: 12, paddingRight: 20 },
  channelList: { overflow: "hidden", borderRadius: 18, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  channelRow: { minHeight: 65, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: beraflixColors.border },
  channelMark: { width: 34, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: "#291018" },
  channelCopy: { flex: 1, gap: 3 },
  channelName: { color: beraflixColors.white, fontSize: 12, fontWeight: "800" },
  channelMeta: { color: beraflixColors.muted, fontSize: 10 },
  pressed: { opacity: 0.74 },
  showMoreButton: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: beraflixColors.border },
  showMoreText: { color: beraflixColors.red, fontSize: 12, fontWeight: "800" },
});
