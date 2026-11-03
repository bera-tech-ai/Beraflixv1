import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ScreenOrientation from "expo-screen-orientation";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useCallback } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useVideoPlayer, VideoView } from "expo-video";

import { ActionButton } from "@/components/beraflix/action-button";
import { BrandHeader } from "@/components/beraflix/brand-header";
import { EmptyState } from "@/components/beraflix/empty-state";
import { BeraflixScreen } from "@/components/beraflix/screen";
import { beraflixColors } from "@/constants/beraflix-theme";
import { useDeviceLibrary } from "@/lib/beraflix/device-library";

export default function DeviceMediaPlayerScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getFile } = useDeviceLibrary();
  const media = getFile(String(id ?? ""));
  const videoPlayer = useVideoPlayer(null);
  const audioPlayer = useAudioPlayer(media?.kind === "audio" ? media.uri : null, { updateInterval: 500 });
  const audioStatus = useAudioPlayerStatus(audioPlayer);
  const goBack = useCallback(() => {
    router.replace("/(tabs)/device-library" as never);
  }, [router]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack]);

  useEffect(() => {
    if (!media || media.kind !== "video") return;
    void videoPlayer.replaceAsync({ uri: media.uri, contentType: "auto", metadata: { title: media.name } }).catch(() => undefined);
    return () => {
      videoPlayer.pause();
    };
  }, [media, videoPlayer]);

  const audioTime = useMemo(() => `${formatTime(audioStatus.currentTime)} / ${formatTime(audioStatus.duration)}`, [audioStatus.currentTime, audioStatus.duration]);

  if (!media) {
    return (
      <BeraflixScreen>
        <BrandHeader />
        <EmptyState icon="folder-open-outline" title="File unavailable" message="This local file is no longer available in the Beraflix library." />
        <ActionButton label="Back to Device Library" onPress={goBack} secondary />
      </BeraflixScreen>
    );
  }

  return (
    <BeraflixScreen contentStyle={styles.screen}>
      <BrandHeader />
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>{media.kind === "video" ? "PHONE VIDEO" : media.kind === "audio" ? "PHONE MUSIC" : "PHONE PHOTO"}</Text>
        <Text style={styles.title} numberOfLines={2}>{media.name}</Text>
        <Text style={styles.meta}>Stored on this phone</Text>
      </View>
      {media.kind === "image" ? (
        <Image source={{ uri: media.uri }} style={styles.photo} contentFit="contain" />
      ) : media.kind === "video" ? (
        <VideoView
          player={videoPlayer}
          style={styles.video}
          contentFit="contain"
          nativeControls
          fullscreenOptions={{ enable: true, orientation: "landscape" }}
          onFullscreenEnter={() => { void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE); }}
          onFullscreenExit={() => { void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT); }}
        />
      ) : (
        <View style={styles.audioCard}>
          <View style={styles.musicIcon}><Ionicons name="musical-notes-outline" size={54} color={beraflixColors.red} /></View>
          <Text style={styles.audioTitle} numberOfLines={2}>{media.name}</Text>
          <Text style={styles.meta}>{audioTime}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={audioStatus.playing ? "Pause music" : "Play music"} onPress={() => audioStatus.playing ? audioPlayer.pause() : audioPlayer.play()} style={styles.playButton}>
            <Ionicons name={audioStatus.playing ? "pause" : "play"} size={28} color={beraflixColors.white} />
          </Pressable>
        </View>
      )}
      <ActionButton label="Back to Device Library" onPress={goBack} secondary />
    </BeraflixScreen>
  );
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  screen: { gap: 18 },
  heading: { gap: 5 },
  eyebrow: { color: beraflixColors.red, fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  title: { color: beraflixColors.white, fontSize: 24, fontWeight: "900", lineHeight: 29 },
  meta: { color: beraflixColors.muted, fontSize: 12, lineHeight: 18 },
  video: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000", borderRadius: 16 },
  photo: { width: "100%", aspectRatio: 1, backgroundColor: "#000", borderRadius: 16 },
  audioCard: { alignItems: "center", gap: 14, padding: 28, borderRadius: 20, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  musicIcon: { width: 128, height: 128, borderRadius: 64, alignItems: "center", justifyContent: "center", backgroundColor: beraflixColors.elevated },
  audioTitle: { color: beraflixColors.white, fontSize: 17, fontWeight: "800", textAlign: "center" },
  playButton: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: beraflixColors.red },
});
