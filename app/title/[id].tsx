import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { ActionButton } from "@/components/beraflix/action-button";
import { BrandHeader } from "@/components/beraflix/brand-header";
import { EmptyState } from "@/components/beraflix/empty-state";
import { BeraflixScreen } from "@/components/beraflix/screen";
import { ModeChip } from "@/components/beraflix/mode-chip";
import { SectionHeading } from "@/components/beraflix/section-heading";
import { beraflixColors } from "@/constants/beraflix-theme";
import { useDownloads } from "@/lib/beraflix/downloads";
import { useLibrary } from "@/lib/beraflix/library";
import { getRememberedTitle, resolveTitleForPlayback } from "@/lib/beraflix/title-cache";

export default function TitleDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, hydrated, toggleList, markWatched, toggleCollectionItem } = useLibrary();
  const { records, hydrated: downloadsHydrated, addDownload, resumeDownload, retryDownload, verifyDownload } = useDownloads();
  const [season, setSeason] = useState("1");
  const [episode, setEpisode] = useState("1");
  const [downloadNotice, setDownloadNotice] = useState("");
  const [playbackNotice, setPlaybackNotice] = useState("");
  const [resolvingPlayback, setResolvingPlayback] = useState(false);
  const title = getRememberedTitle(String(id ?? ""));
  const artwork = title?.backdropUrl ?? title?.coverUrl;

  if (!title) {
    return (
      <BeraflixScreen>
        <BrandHeader />
        <EmptyState icon="film-outline" title="Title details unavailable" message="Open a title from the catalogue to view its details." />
        <ActionButton label="Back to Explore" onPress={() => router.back()} secondary />
      </BeraflixScreen>
    );
  }

  const series = /series|tv|show/i.test(title.type);
  const selectedSeason = /^\d{1,3}$/.test(season) ? Number(season) : null;
  const selectedEpisode = /^\d{1,3}$/.test(episode) ? Number(episode) : null;
  const validEpisode = !series || Boolean(selectedSeason && selectedEpisode);
  const saved = state.lists.watchlist.includes(title.id);
  const favorite = state.lists.favorites.includes(title.id);
  const liked = state.lists.liked.includes(title.id);
  const watched = state.lists.watched.includes(title.id);
  const downloadRecord = records.find((record) =>
    record.titleId === title.id &&
    record.season === (series ? selectedSeason : null) &&
    record.episode === (series ? selectedEpisode : null),
  );

  const handleOfflineAction = async () => {
    setDownloadNotice("");
    if (downloadRecord?.status === "complete") {
      if (await verifyDownload(downloadRecord.id)) {
        router.push({ pathname: "/offline/[id]", params: { id: downloadRecord.id } } as never);
      } else {
        setDownloadNotice("The saved file is not available. Open Downloads to retry or delete it.");
      }
      return;
    }
    if (downloadRecord?.status === "paused") {
      await resumeDownload(downloadRecord.id);
      setDownloadNotice("Transfer resume requested. Check its actual progress in Downloads.");
      router.push("/(tabs)/downloads" as never);
      return;
    }
    if (downloadRecord?.status === "error") {
      await retryDownload(downloadRecord.id);
      setDownloadNotice("A fresh transfer was requested. Check Downloads for its verified status.");
      router.push("/(tabs)/downloads" as never);
      return;
    }
    if (downloadRecord?.status === "preparing" || downloadRecord?.status === "downloading") {
      router.push("/(tabs)/downloads" as never);
      return;
    }
    const createdId = await addDownload(title, state.preferences.quality, series ? selectedSeason ?? undefined : undefined, series ? selectedEpisode ?? undefined : undefined);
    if (createdId) {
      setDownloadNotice("Source and device storage are being checked before any file is saved.");
      router.push("/(tabs)/downloads" as never);
    } else {
      setDownloadNotice("Pause or finish the current transfer, then try again with a valid episode selection.");
    }
  };

  const handlePlay = async () => {
    if (resolvingPlayback || !title.hasResource) return;
    setPlaybackNotice("");
    setResolvingPlayback(true);
    try {
      const resolved = await resolveTitleForPlayback(title);
      if (!resolved?.detailPath) {
        setPlaybackNotice("Playback details are not available for this saved title right now.");
        return;
      }
      router.push({ pathname: "/player/[id]", params: { id: title.id } } as never);
    } catch {
      setPlaybackNotice("Could not refresh this title right now. Check your connection and try again.");
    } finally {
      setResolvingPlayback(false);
    }
  };

  const downloadLabel = downloadRecord?.status === "complete"
    ? "Play saved offline"
    : downloadRecord?.status === "paused"
      ? "Resume offline transfer"
      : downloadRecord?.status === "error"
        ? "Retry offline transfer"
        : downloadRecord?.status === "preparing"
          ? "Checking offline source…"
          : downloadRecord?.status === "downloading"
            ? "View download progress"
            : !title.hasResource
              ? "Offline source not verified"
              : series && !validEpisode
                ? "Select season and episode"
                : "Save for offline";

  return (
    <BeraflixScreen>
      <BrandHeader />
      <View style={styles.artwork}>
        {artwork ? <Image source={{ uri: artwork }} contentFit="cover" cachePolicy="memory" transition={0} style={StyleSheet.absoluteFill} /> : null}
        <View pointerEvents="none" style={styles.artShade} />
        {!artwork ? <Text style={styles.artLabel}>BERAFLIX</Text> : null}
      </View>
      <View style={styles.titleBlock}>
        <Text style={styles.eyebrow}>TITLE DETAILS</Text>
        <Text style={styles.title}>{title.title}</Text>
        <Text style={styles.meta}>{[title.genre, title.releaseDate, title.duration ? `${title.duration} min` : "", title.rating ? `Rating ${title.rating}` : ""].filter(Boolean).join(" · ")}</Text>
      </View>
      {series ? (
        <View style={styles.episodeCard}>
          <SectionHeading title="Choose a download episode" eyebrow="Season and episode" />
          <View style={styles.episodeInputs}>
            <View style={styles.episodeField}><Text style={styles.fieldLabel}>Season</Text><TextInput keyboardType="number-pad" maxLength={3} onChangeText={setSeason} placeholder="1" placeholderTextColor={beraflixColors.quiet} style={styles.numberInput} value={season} /></View>
            <View style={styles.episodeField}><Text style={styles.fieldLabel}>Episode</Text><TextInput keyboardType="number-pad" maxLength={3} onChangeText={setEpisode} placeholder="1" placeholderTextColor={beraflixColors.quiet} style={styles.numberInput} value={episode} /></View>
          </View>
        </View>
      ) : null}
      <View style={styles.actions}>
        <ActionButton label={resolvingPlayback ? "Finding playback details…" : title.hasResource ? "Play" : "No playable source"} disabled={!hydrated || !title.hasResource || resolvingPlayback} onPress={() => void handlePlay()} />
        {playbackNotice ? <Text style={styles.localNote}>{playbackNotice}</Text> : null}
        <ActionButton label={downloadLabel} disabled={!downloadsHydrated || !title.hasResource || (series && !validEpisode)} onPress={() => void handleOfflineAction()} secondary />
        {downloadNotice ? <Text style={styles.localNote}>{downloadNotice}</Text> : null}
        {!downloadsHydrated ? <Text style={styles.localNote}>Reading offline records from this device…</Text> : null}
        <View style={styles.actionRail}>
          <ActionButton label={saved ? "Remove from Watchlist" : "Add to Watchlist"} disabled={!hydrated} onPress={() => toggleList("watchlist", title)} secondary />
          <ActionButton label={favorite ? "Favorited" : "Favorite"} disabled={!hydrated} onPress={() => toggleList("favorites", title)} secondary />
          <ActionButton label={liked ? "Liked" : "Like"} disabled={!hydrated} onPress={() => toggleList("liked", title)} secondary />
          <ActionButton label={watched ? "Watched" : "Mark Watched"} disabled={!hydrated || watched} onPress={() => markWatched(title)} secondary />
        </View>
      </View>
      {!hydrated ? <Text style={styles.localNote}>Reading your device library…</Text> : null}
      {state.collections.length > 0 ? (
        <View style={styles.collectionSection}>
          <SectionHeading title="Add to a collection" eyebrow="On this device" />
          <View style={styles.collectionRail}>
            {state.collections.map((collection) => <ModeChip key={collection.id} label={collection.name} selected={collection.itemIds.includes(title.id)} onPress={() => toggleCollectionItem(collection.id, title)} />)}
          </View>
        </View>
      ) : null}
      <SectionHeading title="About this title" eyebrow="Synopsis" />
      <View style={styles.infoCard}>
        <Text style={styles.infoText}>{title.description || "No description is available for this title."}</Text>
      </View>
      <Text style={styles.localNote}>Watch state and offline files are kept only on this device. Source availability is checked before saving.</Text>
    </BeraflixScreen>
  );
}

const styles = StyleSheet.create({
  artwork: { height: 245, borderRadius: 22, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  artShade: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(8,9,13,0.25)" },
  artLabel: { color: beraflixColors.white, fontSize: 26, fontWeight: "900", letterSpacing: 2 },
  titleBlock: { gap: 6 },
  eyebrow: { color: beraflixColors.red, fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  title: { color: beraflixColors.white, fontSize: 26, lineHeight: 31, fontWeight: "900" },
  meta: { color: beraflixColors.muted, fontSize: 11, lineHeight: 17 },
  actions: { gap: 10 },
  actionRail: { gap: 8 },
  episodeCard: { gap: 11, padding: 15, borderRadius: 16, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  episodeInputs: { flexDirection: "row", gap: 10 },
  episodeField: { flex: 1, gap: 5 },
  fieldLabel: { color: beraflixColors.muted, fontSize: 11, fontWeight: "700" },
  numberInput: { minHeight: 44, paddingHorizontal: 12, color: beraflixColors.white, backgroundColor: beraflixColors.elevated, borderWidth: 1, borderColor: beraflixColors.border, borderRadius: 11, fontSize: 15, fontWeight: "700" },
  collectionSection: { gap: 12 },
  collectionRail: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoCard: { padding: 17, borderRadius: 16, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  infoText: { color: beraflixColors.muted, fontSize: 13, lineHeight: 20 },
  localNote: { color: beraflixColors.muted, fontSize: 11, lineHeight: 16 },
});
