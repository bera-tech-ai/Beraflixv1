import { Ionicons } from "@expo/vector-icons";
import * as Brightness from "expo-brightness";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useVideoPlayer, VideoView, type SubtitleTrack } from "expo-video";

import { ActionButton } from "@/components/beraflix/action-button";
import { BrandHeader } from "@/components/beraflix/brand-header";
import { EmptyState } from "@/components/beraflix/empty-state";
import { ModeChip } from "@/components/beraflix/mode-chip";
import { BeraflixScreen } from "@/components/beraflix/screen";
import { SectionHeading } from "@/components/beraflix/section-heading";
import { beraflixColors } from "@/constants/beraflix-theme";
import { useLibrary } from "@/lib/beraflix/library";
import { getRememberedTitle } from "@/lib/beraflix/title-cache";
import { preparePlayback } from "@/lib/beraflix/playback";
import { setPlayerProgressInterval, setPlayerSubtitle, setPlayerVolume } from "@/lib/beraflix/player-controls";

const qualityOptions = ["auto", "360p", "480p", "720p", "1080p"] as const;
type PlaybackState = "idle" | "preparing" | "ready" | "error";

export default function PlayerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, recordProgress, markWatched, updatePreferences } = useLibrary();
  const title = getRememberedTitle(String(id ?? "")) ?? state.items[String(id ?? "")] ?? null;
  const player = useVideoPlayer(null);
  const [status, setStatus] = useState<PlaybackState>("idle");
  const [statusMessage, setStatusMessage] = useState("Ready to prepare secure playback.");
  const [season, setSeason] = useState("");
  const [episode, setEpisode] = useState("");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [brightness, setBrightness] = useState<number | null>(null);
  const [brightnessAvailable, setBrightnessAvailable] = useState(false);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string>("off");
  const titleRef = useRef(title);
  const watchedRef = useRef(state.lists.watched);
  const preferencesRef = useRef(state.preferences);
  const subtitleTracksRef = useRef(subtitleTracks);
  const recordProgressRef = useRef(recordProgress);
  const markWatchedRef = useRef(markWatched);
  const playbackAbort = useRef<AbortController | null>(null);
  const originalBrightness = useRef<number | null>(null);
  const isSeries = Boolean(title && /series|tv|show/i.test(title.type));
  const selectedSeason = /^\d{1,3}$/.test(season) ? Number(season) : undefined;
  const selectedEpisode = /^\d{1,3}$/.test(episode) ? Number(episode) : undefined;

  useEffect(() => {
    titleRef.current = title;
    watchedRef.current = state.lists.watched;
    preferencesRef.current = state.preferences;
    subtitleTracksRef.current = subtitleTracks;
    recordProgressRef.current = recordProgress;
    markWatchedRef.current = markWatched;
  }, [title, state.lists.watched, state.preferences, subtitleTracks, recordProgress, markWatched]);

  useEffect(() => {
    setPlayerProgressInterval(player, 1);
    const statusSubscription = player.addListener("statusChange", (event) => {
      if (event.status === "error") {
        setStatus("error");
        setStatusMessage("Playback is unavailable for this title right now.");
      }
    });
    const playingSubscription = player.addListener("playingChange", (event) => setPlaying(event.isPlaying));
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
      const preferredLanguage = preferences.subtitleLanguage.toLowerCase();
      const preferred = preferredLanguage === "device"
        ? undefined
        : tracks.find((track) => track.language.toLowerCase() === preferredLanguage);
      const selected = preferred ?? tracks.find((track) => track.isDefault) ?? tracks[0];
      setPlayerSubtitle(player, selected);
      setSelectedSubtitle(subtitleKey(selected, tracks.indexOf(selected)));
    });
    const subtitleSubscription = player.addListener("subtitleTrackChange", (event) => {
      const track = event.subtitleTrack;
      setSelectedSubtitle(track ? subtitleKey(track, subtitleTracksRef.current.indexOf(track)) : "off");
    });

    return () => {
      statusSubscription.remove();
      playingSubscription.remove();
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

  useEffect(() => () => {
    playbackAbort.current?.abort();
    player.pause();
  }, [player]);

  const prepareAndPlay = async (quality: typeof qualityOptions[number] = state.preferences.quality) => {
    if (!title || !title.detailPath || !title.hasResource) {
      setStatus("error");
      setStatusMessage("This title has no verified playable resource.");
      return;
    }
    if (isSeries && (!selectedSeason || !selectedEpisode)) {
      setStatus("error");
      setStatusMessage("Enter both a season and episode number to continue.");
      return;
    }

    setStatus("preparing");
    setStatusMessage("Preparing playback…");
    playbackAbort.current?.abort();
    const controller = new AbortController();
    playbackAbort.current = controller;
    try {
      const prepared = await preparePlayback({
        detailPath: title.detailPath,
        quality,
        ...(isSeries ? { season: selectedSeason, episode: selectedEpisode } : {}),
      }, controller.signal);
      if (controller.signal.aborted) return;
      await player.replaceAsync({
        uri: prepared.uri,
        contentType: "auto",
        metadata: { title: title.title, ...(title.coverUrl ? { artwork: title.coverUrl } : {}) },
      });
      setStatus("ready");
      setStatusMessage("Secure playback is ready.");
      player.play();
    } catch {
      if (controller.signal.aborted) return;
      setStatus("error");
      setStatusMessage("Playback is not available for this title right now. Try another title or retry later.");
    }
  };

  const chooseQuality = (quality: typeof qualityOptions[number]) => {
    updatePreferences({ quality });
    if (status === "ready") void prepareAndPlay(quality);
  };

  const selectSubtitle = (track: SubtitleTrack | null, key: string) => {
    setPlayerSubtitle(player, track);
    setSelectedSubtitle(key);
    updatePreferences(track
      ? { subtitlesEnabled: true, subtitleLanguage: track.language }
      : { subtitlesEnabled: false });
  };

  const changeVolume = (delta: number) => {
    const next = setPlayerVolume(player, player.volume + delta);
    setVolume(next);
  };

  const changeBrightness = (delta: number) => {
    if (brightness === null || !brightnessAvailable) return;
    const next = Math.max(0.05, Math.min(1, Math.round((brightness + delta) * 100) / 100));
    void Brightness.setBrightnessAsync(next).then(() => setBrightness(next)).catch(() => setBrightnessAvailable(false));
  };

  const togglePlayback = () => {
    if (player.playing) player.pause();
    else player.play();
  };

  if (!title) {
    return (
      <BeraflixScreen>
        <BrandHeader />
        <EmptyState icon="play-circle-outline" title="Player unavailable" message="Open a title from Discover or Explore to prepare playback." />
        <ActionButton label="Back" onPress={() => router.back()} secondary />
      </BeraflixScreen>
    );
  }

  const playbackEnabled = title.hasResource && Boolean(title.detailPath) && status !== "preparing";
  const displayTime = `${formatTime(currentTime)}${player.duration > 0 ? ` / ${formatTime(player.duration)}` : ""}`;

  return (
    <BeraflixScreen contentStyle={styles.screen}>
      <BrandHeader />
      <View style={styles.playerFrame}>
        {status === "ready" ? <VideoView player={player} style={styles.video} contentFit="contain" nativeControls /> : (
          <View style={styles.playerPlaceholder}>
            <Ionicons name={status === "error" ? "cloud-offline-outline" : "play-circle-outline"} size={36} color={beraflixColors.red} />
            <Text style={styles.overlayTitle}>{statusMessage}</Text>
          </View>
        )}
      </View>

      <View style={styles.titleBlock}>
        <Text style={styles.eyebrow}>NOW PLAYING</Text>
        <Text style={styles.title}>{title.title}</Text>
        <Text style={styles.meta}>{status === "ready" ? displayTime : [title.genre, title.releaseDate].filter(Boolean).join(" · ")}</Text>
      </View>

      {isSeries ? (
        <View style={styles.episodeCard}>
          <Text style={styles.optionTitle}>Choose a season and episode</Text>
          <Text style={styles.optionBody}>Availability is checked by the secure playback service.</Text>
          <View style={styles.episodeInputs}>
            <View style={styles.episodeField}><Text style={styles.fieldLabel}>Season</Text><TextInput keyboardType="number-pad" maxLength={3} onChangeText={setSeason} placeholder="1" placeholderTextColor={beraflixColors.quiet} style={styles.numberInput} value={season} /></View>
            <View style={styles.episodeField}><Text style={styles.fieldLabel}>Episode</Text><TextInput keyboardType="number-pad" maxLength={3} onChangeText={setEpisode} placeholder="1" placeholderTextColor={beraflixColors.quiet} style={styles.numberInput} value={episode} /></View>
          </View>
        </View>
      ) : null}

      {status === "ready" ? (
        <View style={styles.controlCard}>
          <Pressable accessibilityRole="button" accessibilityLabel={playing ? "Pause playback" : "Resume playback"} onPress={togglePlayback} style={styles.controlButton}>
            <Ionicons name={playing ? "pause" : "play"} size={18} color={beraflixColors.white} />
          </Pressable>
          <Text style={styles.controlTime}>{displayTime}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Skip back 15 seconds" onPress={() => player.seekBy(-15)} style={styles.skipButton}><Text style={styles.skipText}>−15</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Skip forward 15 seconds" onPress={() => player.seekBy(15)} style={styles.skipButton}><Text style={styles.skipText}>+15</Text></Pressable>
        </View>
      ) : null}

      <View style={styles.optionsCard}>
        <SectionHeading title="Quality" eyebrow="Saved on this device" />
        <View style={styles.optionRail}>{qualityOptions.map((quality) => <ModeChip key={quality} label={quality.toUpperCase()} selected={state.preferences.quality === quality} onPress={() => chooseQuality(quality)} />)}</View>
      </View>

      {status === "ready" ? (
        <View style={styles.optionsCard}>
          <SectionHeading title="Subtitles" eyebrow="Embedded tracks" />
          {subtitleTracks.length > 0 ? (
            <View style={styles.optionRail}>
              <ModeChip label="Off" selected={selectedSubtitle === "off"} onPress={() => selectSubtitle(null, "off")} />
              {subtitleTracks.map((track, index) => <ModeChip key={subtitleKey(track, index)} label={track.language || `Track ${index + 1}`} selected={selectedSubtitle === subtitleKey(track, index)} onPress={() => selectSubtitle(track, subtitleKey(track, index))} />)}
            </View>
          ) : <Text style={styles.optionBody}>No embedded subtitle tracks are available for this source.</Text>}
        </View>
      ) : null}

      {status === "ready" ? (
        <View style={styles.volumeCard}>
          <Text style={styles.optionTitle}>Volume</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Lower volume" onPress={() => changeVolume(-0.1)} style={styles.volumeButton}><Ionicons name="volume-low-outline" size={19} color={beraflixColors.white} /></Pressable>
          <Text style={styles.volumeValue}>{Math.round(volume * 100)}%</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Raise volume" onPress={() => changeVolume(0.1)} style={styles.volumeButton}><Ionicons name="volume-high-outline" size={19} color={beraflixColors.white} /></Pressable>
        </View>
      ) : null}

      <View style={styles.optionsCard}>
        <SectionHeading title="Device controls" eyebrow="Where supported" />
        {brightnessAvailable && brightness !== null ? (
          <View style={styles.volumeCard}>
            <Text style={styles.optionTitle}>Screen brightness</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Lower screen brightness" onPress={() => changeBrightness(-0.1)} style={styles.volumeButton}><Ionicons name="sunny-outline" size={19} color={beraflixColors.white} /></Pressable>
            <Text style={styles.volumeValue}>{Math.round(brightness * 100)}%</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Raise screen brightness" onPress={() => changeBrightness(0.1)} style={styles.volumeButton}><Ionicons name="sunny" size={19} color={beraflixColors.white} /></Pressable>
          </View>
        ) : <Text style={styles.optionBody}>Screen-brightness control is not supported on this device.</Text>}
      </View>

      {status !== "ready" ? <Text style={styles.statusLabel}>{statusMessage}</Text> : null}
      <ActionButton label={status === "preparing" ? "Preparing playback…" : status === "ready" ? "Reload playback" : "Prepare & play"} disabled={!playbackEnabled} onPress={() => void prepareAndPlay()} />
      {!title.hasResource ? <Text style={styles.unavailable}>This title does not have a verified playable resource.</Text> : null}
      {status === "error" ? <ActionButton label="Retry" disabled={!playbackEnabled} onPress={() => void prepareAndPlay()} secondary /> : null}
      <ActionButton label="Back to title" onPress={() => router.back()} secondary />
      <Text style={styles.localNote}>Playback history and preferences stay on this device. Media source addresses are handled securely and are never shown in the app.</Text>
    </BeraflixScreen>
  );
}

function subtitleKey(track: SubtitleTrack, index: number): string {
  return track.id ?? `${track.language}-${track.label}-${index}`;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  screen: { gap: 18 },
  playerFrame: { width: "100%", aspectRatio: 16 / 9, overflow: "hidden", borderRadius: 18, backgroundColor: "#000000", borderWidth: 1, borderColor: beraflixColors.border },
  video: { width: "100%", height: "100%" },
  playerPlaceholder: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 22, gap: 10 },
  overlayTitle: { maxWidth: 280, color: beraflixColors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  titleBlock: { gap: 4 },
  eyebrow: { color: beraflixColors.red, fontSize: 9, fontWeight: "800", letterSpacing: 1.6 },
  title: { color: beraflixColors.white, fontSize: 21, fontWeight: "900" },
  meta: { color: beraflixColors.muted, fontSize: 11, lineHeight: 16 },
  episodeCard: { gap: 10, padding: 16, borderRadius: 17, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  optionTitle: { color: beraflixColors.white, fontSize: 12, fontWeight: "800" },
  optionBody: { color: beraflixColors.muted, fontSize: 11, lineHeight: 16 },
  episodeInputs: { flexDirection: "row", gap: 10 },
  episodeField: { flex: 1, gap: 5 },
  fieldLabel: { color: beraflixColors.muted, fontSize: 10, fontWeight: "700" },
  numberInput: { height: 45, paddingHorizontal: 12, color: beraflixColors.white, borderRadius: 12, backgroundColor: beraflixColors.elevated, borderWidth: 1, borderColor: beraflixColors.border, fontWeight: "800" },
  controlCard: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, borderRadius: 15, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  controlButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: beraflixColors.redDeep },
  controlTime: { flex: 1, color: beraflixColors.muted, fontSize: 10, fontWeight: "700" },
  skipButton: { minWidth: 40, height: 34, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: beraflixColors.elevated },
  skipText: { color: beraflixColors.white, fontSize: 10, fontWeight: "800" },
  optionsCard: { gap: 12, padding: 15, borderRadius: 17, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  optionRail: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  volumeCard: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 15, borderRadius: 16, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  volumeButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: beraflixColors.elevated },
  volumeValue: { minWidth: 39, color: beraflixColors.white, fontSize: 11, fontWeight: "800", textAlign: "center" },
  statusLabel: { color: beraflixColors.muted, fontSize: 11, lineHeight: 16 },
  unavailable: { color: beraflixColors.muted, fontSize: 11, lineHeight: 16 },
  localNote: { color: beraflixColors.muted, fontSize: 10, lineHeight: 15 },
});
