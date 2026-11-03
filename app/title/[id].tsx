import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

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
  const { records, hydrated: downloadsHydrated, addDownload, addDownloads, resumeDownload, retryDownload, verifyDownload } = useDownloads();
  const [selectedSeasons, setSelectedSeasons] = useState<number[]>([1]);
  const [selectedEpisodes, setSelectedEpisodes] = useState<number[]>([1]);
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
  const selectedSeason = selectedSeasons[0] ?? null;
  const selectedEpisode = selectedEpisodes[0] ?? null;
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
      setDownloadNotice("Download resume requested. Check Downloads for progress.");
      router.push("/(tabs)/downloads" as never);
      return;
    }
    if (downloadRecord?.status === "error") {
      await retryDownload(downloadRecord.id);
      setDownloadNotice("Download restarted. Check Downloads for progress.");
      router.push("/(tabs)/downloads" as never);
      return;
    }
    if (downloadRecord?.status === "preparing" || downloadRecord?.status === "downloading") {
      router.push("/(tabs)/downloads" as never);
      return;
    }
    const createdIds = series
      ? await addDownloads(title, state.preferences.quality, selectedSeasons, selectedEpisodes)
      : [await addDownload(title, state.preferences.quality)];
    if (createdIds.filter(Boolean).length) {
      setDownloadNotice(`${createdIds.filter(Boolean).length} download${createdIds.filter(Boolean).length === 1 ? "" : "s"} started. Check Downloads for progress.`);
      router.push("/(tabs)/downloads" as never);
    } else {
      setDownloadNotice("Select at least one season and episode, then try again.");
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
      ? "Resume download"
      : downloadRecord?.status === "error"
        ? "Retry download"
        : downloadRecord?.status === "preparing"
          ? "Starting download…"
          : downloadRecord?.status === "downloading"
            ? "View download progress"
            : !title.hasResource
              ? "Download unavailable"
              : series && !validEpisode
                ? "Select season and episode"
                : "Download";

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
          <SectionHeading title="Select downloads" eyebrow="Choose seasons and episodes" />
          <Text style={styles.fieldLabel}>Seasons</Text>
          <View style={styles.selectionRail}>{[1, 2, 3, 4, 5].map((value) => <ModeChip key={`season-${value}`} label={`S${value}`} selected={selectedSeasons.includes(value)} onPress={() => setSelectedSeasons((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value].sort((a, b) => a - b))} />)}</View>
          <Text style={styles.fieldLabel}>Episodes</Text>
          <View style={styles.selectionRail}>{Array.from({ length: 12 }, (_, index) => index + 1).map((value) => <ModeChip key={`episode-${value}`} label={`E${value}`} selected={selectedEpisodes.includes(value)} onPress={() => setSelectedEpisodes((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value].sort((a, b) => a - b))} />)}</View>
          <Text style={styles.localNote}>{selectedSeasons.length * selectedEpisodes.length} episode{selectedSeasons.length * selectedEpisodes.length === 1 ? "" : "s"} selected. Each episode is saved separately.</Text>
        </View>
      ) : null}
      <View style={styles.actions}>
        <ActionButton label={resolvingPlayback ? "Opening player…" : title.hasResource ? "Play" : "No playable source"} disabled={!hydrated || !title.hasResource || resolvingPlayback} onPress={() => void handlePlay()} />
        {playbackNotice ? <Text style={styles.localNote}>{playbackNotice}</Text> : null}
        <ActionButton label={series ? `Download Selected (${selectedSeasons.length * selectedEpisodes.length})` : downloadLabel} disabled={!downloadsHydrated || !title.hasResource || (series && (!selectedSeasons.length || !selectedEpisodes.length))} onPress={() => void handleOfflineAction()} secondary />
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
  selectionRail: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  episodeField: { flex: 1, gap: 5 },
  fieldLabel: { color: beraflixColors.muted, fontSize: 11, fontWeight: "700" },
  numberInput: { minHeight: 44, paddingHorizontal: 12, color: beraflixColors.white, backgroundColor: beraflixColors.elevated, borderWidth: 1, borderColor: beraflixColors.border, borderRadius: 11, fontSize: 15, fontWeight: "700" },
  collectionSection: { gap: 12 },
  collectionRail: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  infoCard: { padding: 17, borderRadius: 16, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  infoText: { color: beraflixColors.muted, fontSize: 13, lineHeight: 20 },
  localNote: { color: beraflixColors.muted, fontSize: 11, lineHeight: 16 },
});
