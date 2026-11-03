import { Ionicons } from "@expo/vector-icons";
import * as Brightness from "expo-brightness";
import * as ScreenOrientation from "expo-screen-orientation";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useVideoPlayer, VideoView, type SubtitleTrack } from "expo-video";

import { ActionButton } from "@/components/beraflix/action-button";
import { BrandHeader } from "@/components/beraflix/brand-header";
import { EmptyState } from "@/components/beraflix/empty-state";
import { BeraflixScreen } from "@/components/beraflix/screen";
import { ModeChip } from "@/components/beraflix/mode-chip";
import { SectionHeading } from "@/components/beraflix/section-heading";
import { beraflixColors } from "@/constants/beraflix-theme";
import { useDownloads } from "@/lib/beraflix/downloads";
import { useLibrary } from "@/lib/beraflix/library";
import { setPlayerProgressInterval, setPlayerSubtitle, setPlayerVolume } from "@/lib/beraflix/player-controls";

export default function OfflinePlayerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { records, hydrated: downloadsHydrated, verifyDownload } = useDownloads();
  const { state, recordProgress, markWatched, updatePreferences } = useLibrary();
  const record = records.find((item) => item.id === String(id ?? ""));
  const title = record?.title ?? null;
  const recordId = record?.id;
  const recordStatus = record?.status;
  const localUri = record?.fileUri;
  const titleName = record?.title.title;
  const coverUrl = record?.title.coverUrl;
  const player = useVideoPlayer(null);
  const [status, setStatus] = useState("Checking saved file on this device…");
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState("off");
  const [brightness, setBrightness] = useState<number | null>(null);
  const [brightnessAvailable, setBrightnessAvailable] = useState(false);
  const titleRef = useRef(title);
  const recordProgressRef = useRef(recordProgress);
  const markWatchedRef = useRef(markWatched);
  const watchedRef = useRef(state.lists.watched);
  const preferencesRef = useRef(state.preferences);
  const subtitleTracksRef = useRef(subtitleTracks);
  const originalBrightness = useRef<number | null>(null);
  const playerMessage = recordStatus === "complete" ? status : "This saved file is not available. Return to Downloads to retry or remove it.";
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/downloads" as never);
  };

  useEffect(() => {
    titleRef.current = title;
    recordProgressRef.current = recordProgress;
    markWatchedRef.current = markWatched;
    watchedRef.current = state.lists.watched;
    preferencesRef.current = state.preferences;
    subtitleTracksRef.current = subtitleTracks;
  }, [title, recordProgress, markWatched, state.lists.watched, state.preferences, subtitleTracks]);

  useEffect(() => {
    if (!downloadsHydrated) return;
    let active = true;
    if (!recordId || recordStatus !== "complete" || !localUri || !titleName) return;
    void verifyDownload(recordId).then(async (valid) => {
      if (!active) return;
      if (!valid) {
        setStatus("This saved file could not be verified. Return to Downloads to retry or remove it.");
        return;
      }
      try {
        await player.replaceAsync({
          uri: localUri,
          contentType: "auto",
          metadata: { title: titleName, ...(coverUrl ? { artwork: coverUrl } : {}) },
        });
        if (!active) return;
        setStatus("Ready offline.");
        player.play();
      } catch {
        if (active) setStatus("This saved file could not be opened by the device player.");
      }
    }).catch(() => {
      if (active) setStatus("This saved file could not be verified.");
    });
    return () => {
      active = false;
      player.pause();
    };
  }, [recordId, recordStatus, localUri, titleName, coverUrl, downloadsHydrated, player, verifyDownload]);

  useEffect(() => {
    setPlayerProgressInterval(player, 1);
    const volumeSubscription = player.addListener("volumeChange", (event) => setVolume(event.volume));
    const timeSubscription = player.addListener("timeUpdate", (event) => {
      setCurrentTime(event.currentTime);
      const currentTitle = titleRef.current;
      if (!currentTitle || !player.playing) return;
      const duration = player.duration > 0 ? player.duration : currentTitle.duration * 60;
      if (duration <= 0) return;
      if (event.currentTime >= duration - Math.max(15, duration * 0.02)) {
        if (!watchedRef.current.includes(currentTitle.id)) markWatchedRef.current(currentTitle);
      } else {
        recordProgressRef.current(currentTitle, event.currentTime, duration);
      }
    });
    const trackSubscription = player.addListener("availableSubtitleTracksChange", (event) => {
      const tracks = event.availableSubtitleTracks;
      subtitleTracksRef.current = tracks;
      setSubtitleTracks(tracks);
      const preferences = preferencesRef.current;
      if (!preferences.subtitlesEnabled || tracks.length === 0) {
        setPlayerSubtitle(player, null);
        setSelectedSubtitle("off");
        return;
      }
      const language = preferences.subtitleLanguage.toLowerCase();
      const preferred = language === "device" ? undefined : tracks.find((track) => track.language.toLowerCase() === language);
      const selected = preferred ?? tracks.find((track) => track.isDefault) ?? tracks[0];
      setPlayerSubtitle(player, selected);
      setSelectedSubtitle(subtitleKey(selected, tracks.indexOf(selected)));
    });
    const subtitleSubscription = player.addListener("subtitleTrackChange", (event) => {
      const track = event.subtitleTrack;
      setSelectedSubtitle(track ? subtitleKey(track, subtitleTracksRef.current.indexOf(track)) : "off");
    });
    return () => {
      volumeSubscription.remove();
      timeSubscription.remove();
      trackSubscription.remove();
      subtitleSubscription.remove();
    };
  }, [player]);

  useEffect(() => {
    let active = true;
    void Brightness.isAvailableAsync().then(async (available) => {
      if (!active || !available) return;
      const value = await Brightness.getBrightnessAsync();
      if (!active) return;
      originalBrightness.current = value;
      setBrightness(value);
      setBrightnessAvailable(true);
    }).catch(() => {
      if (active) setBrightnessAvailable(false);
    });
    return () => {
      active = false;
      const restore = originalBrightness.current;
      if (restore !== null) void Brightness.setBrightnessAsync(restore).catch(() => undefined);
    };
  }, []);

  const changeBrightness = (delta: number) => {
    if (brightness === null || !brightnessAvailable) return;
    const next = Math.max(0.05, Math.min(1, Math.round((brightness + delta) * 100) / 100));
    void Brightness.setBrightnessAsync(next).then(() => setBrightness(next)).catch(() => setBrightnessAvailable(false));
  };

  const changeVolume = (delta: number) => {
    const next = setPlayerVolume(player, player.volume + delta);
    setVolume(next);
  };

  const selectSubtitle = (track: SubtitleTrack | null, key: string) => {
    setPlayerSubtitle(player, track);
    setSelectedSubtitle(key);
    updatePreferences(track
      ? { subtitlesEnabled: true, subtitleLanguage: track.language }
      : { subtitlesEnabled: false });
  };

  if (!downloadsHydrated) {
    return (
      <BeraflixScreen>
        <BrandHeader />
        <Text style={styles.status}>Reading offline records on this device…</Text>
      </BeraflixScreen>
    );
  }

  if (!record || !title) {
    return (
      <BeraflixScreen>
        <BrandHeader />
        <EmptyState icon="cloud-offline-outline" title="Saved file unavailable" message="This download record is no longer on this device." />
        <ActionButton label="Back to Downloads" onPress={goBack} secondary />
      </BeraflixScreen>
    );
  }

  return (
    <BeraflixScreen contentStyle={styles.screen}>
      <BrandHeader />
      <View style={styles.playerFrame}>
        {status === "Ready offline." ? <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls
          fullscreenOptions={{ enable: true }}
          onFullscreenEnter={() => { void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE); }}
          onFullscreenExit={() => { void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT); }}
        /> : (
          <View style={styles.placeholder}>
            <Ionicons name="phone-portrait-outline" size={34} color={beraflixColors.red} />
            <Text style={styles.status}>{playerMessage}</Text>
          </View>
        )}
      </View>
      <View style={styles.titleBlock}>
        <Text style={styles.eyebrow}>PLAYING OFFLINE</Text>
        <Text style={styles.title}>{title.title}</Text>
        {record.season && record.episode ? <Text style={styles.meta}>Season {record.season} · Episode {record.episode}</Text> : null}
      </View>
      {status === "Ready offline." ? (
        <View style={styles.controlCard}>
          <Text style={styles.controlTime}>{formatTime(currentTime)}{player.duration > 0 ? ` / ${formatTime(player.duration)}` : ""}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Lower volume" onPress={() => changeVolume(-0.1)} style={styles.controlButton}><Ionicons name="volume-low-outline" size={18} color={beraflixColors.white} /></Pressable>
          <Text style={styles.controlValue}>{Math.round(volume * 100)}%</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Raise volume" onPress={() => changeVolume(0.1)} style={styles.controlButton}><Ionicons name="volume-high-outline" size={18} color={beraflixColors.white} /></Pressable>
        </View>
      ) : null}
      {status === "Ready offline." && subtitleTracks.length > 0 ? (
        <View style={styles.optionsCard}>
          <SectionHeading title="Subtitles" eyebrow="Embedded tracks" />
          <View style={styles.optionRail}>
            <ModeChip label="Off" selected={selectedSubtitle === "off"} onPress={() => selectSubtitle(null, "off")} />
            {subtitleTracks.map((track, index) => <ModeChip key={subtitleKey(track, index)} label={track.language || `Track ${index + 1}`} selected={selectedSubtitle === subtitleKey(track, index)} onPress={() => selectSubtitle(track, subtitleKey(track, index))} />)}
          </View>
        </View>
      ) : null}
      <View style={styles.optionsCard}>
        <SectionHeading title="Screen brightness" eyebrow="This device" />
        {brightnessAvailable && brightness !== null ? (
          <View style={styles.controlCard}>
            <Pressable accessibilityRole="button" accessibilityLabel="Lower screen brightness" onPress={() => changeBrightness(-0.1)} style={styles.controlButton}><Ionicons name="sunny-outline" size={18} color={beraflixColors.white} /></Pressable>
            <Text style={styles.controlValue}>{Math.round(brightness * 100)}%</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Raise screen brightness" onPress={() => changeBrightness(0.1)} style={styles.controlButton}><Ionicons name="sunny" size={18} color={beraflixColors.white} /></Pressable>
          </View>
        ) : <Text style={styles.meta}>Screen-brightness control is not supported here.</Text>}
      </View>
      <ActionButton label="Back to Downloads" onPress={goBack} secondary />
      <Text style={styles.localNote}>Offline playback reads the verified file stored on this device.</Text>
    </BeraflixScreen>
  );
}

function subtitleKey(track: SubtitleTrack, index: number): string {
  return track.id ?? `${track.language}-${track.label}-${index}`;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  screen: { gap: 18 },
  playerFrame: { width: "100%", aspectRatio: 16 / 9, overflow: "hidden", borderRadius: 18, backgroundColor: "#000000", borderWidth: 1, borderColor: beraflixColors.border },
  video: { width: "100%", height: "100%" },
  placeholder: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 22, gap: 10 },
  status: { maxWidth: 300, color: beraflixColors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  titleBlock: { gap: 5 },
  eyebrow: { color: beraflixColors.red, fontSize: 9, fontWeight: "800", letterSpacing: 1.6 },
  title: { color: beraflixColors.white, fontSize: 21, fontWeight: "900" },
  meta: { color: beraflixColors.muted, fontSize: 11, lineHeight: 16 },
  controlCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 12, borderRadius: 15, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  controlTime: { flex: 1, color: beraflixColors.muted, fontSize: 11, fontWeight: "700" },
  controlButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: beraflixColors.elevated },
  controlValue: { minWidth: 40, color: beraflixColors.white, fontSize: 12, fontWeight: "800", textAlign: "center" },
  optionsCard: { gap: 12, padding: 14, borderRadius: 16, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  optionRail: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  localNote: { color: beraflixColors.muted, fontSize: 11, lineHeight: 16 },
});
