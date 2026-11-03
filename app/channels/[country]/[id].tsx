import * as ScreenOrientation from "expo-screen-orientation";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { WebView } from "react-native-webview";

import { ActionButton } from "@/components/beraflix/action-button";
import { BrandHeader } from "@/components/beraflix/brand-header";
import { BeraflixScreen } from "@/components/beraflix/screen";
import { beraflixColors } from "@/constants/beraflix-theme";
import { getChannelStream } from "@/lib/beraflix/api";

export default function LiveChannelScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ country?: string; id?: string; name?: string }>();
  const country = String(params.country ?? "").toLowerCase();
  const channelId = String(params.id ?? "");
  const fallbackName = String(params.name ?? "Live channel");
  const player = useVideoPlayer(null);
  const [name, setName] = useState(fallbackName);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState("Connecting to the live channel…");
  const [streamKind, setStreamKind] = useState<"hls" | "embed" | null>(null);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/explore" as never);
  }, [router]);

  const load = useCallback(() => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setStatus("loading");
    setStreamKind(null);
    setStreamUrl(null);
    setMessage("Connecting to the live channel…");
    void getChannelStream(country, channelId).then(async (stream) => {
      if (controller.signal.aborted) return;
      setName(stream.name);
      setStreamKind(stream.kind);
      setStreamUrl(stream.url);
      if (stream.kind === "hls") await player.replaceAsync({ uri: stream.url, contentType: "auto", metadata: { title: stream.name } });
      if (controller.signal.aborted) return;
      setStatus("ready");
      setMessage(stream.kind === "embed" ? "Live channel embed" : "Live");
      if (stream.kind === "hls") player.play();
    }).catch((error) => {
      if (!controller.signal.aborted) {
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "This live channel is unavailable right now.");
      }
    });
  }, [channelId, country, player]);

  useEffect(() => {
    const timer = setTimeout(() => load(), 0);
    return () => {
      clearTimeout(timer);
      requestRef.current?.abort();
      player.pause();
    };
  }, [load, player]);

  useEffect(() => {
    const subscription = player.addListener("statusChange", (event) => {
      if (event.status === "error") {
        setStatus("error");
        setMessage("The live stream could not be played on this device.");
      }
    });
    return () => subscription.remove();
  }, [player]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      goBack();
      return true;
    });
    return () => subscription.remove();
  }, [goBack]);

  return (
    <BeraflixScreen contentStyle={styles.screen}>
      <BrandHeader />
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>LIVE CHANNEL</Text>
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.meta}>{country.toUpperCase()} · Channel {channelId}</Text>
      </View>
      <View style={styles.playerFrame}>
        {status === "ready" && streamKind === "hls" ? <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls
          fullscreenOptions={{ enable: true }}
          onFullscreenEnter={() => { void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE); }}
          onFullscreenExit={() => { void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT); }}
        /> : status === "ready" && streamKind === "embed" && streamUrl ? <WebView source={{ uri: streamUrl }} style={styles.webView} allowsFullscreenVideo allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} /> : <View style={styles.placeholder}>
          <Ionicons name={status === "error" ? "cloud-offline-outline" : "radio-outline"} size={38} color={beraflixColors.red} />
          <Text style={styles.status}>{message}</Text>
        </View>}
      </View>
      {status === "error" ? <ActionButton label="Retry live channel" onPress={load} /> : null}
      <ActionButton label="Back to channels" onPress={goBack} secondary />
      <ActionButton label="Choose another channel" onPress={() => router.replace("/(tabs)/explore" as never)} secondary />
    </BeraflixScreen>
  );
}

const styles = StyleSheet.create({
  screen: { gap: 16 },
  heading: { gap: 4 },
  eyebrow: { color: beraflixColors.red, fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  title: { color: beraflixColors.white, fontSize: 28, fontWeight: "900" },
  meta: { color: beraflixColors.muted, fontSize: 12 },
  playerFrame: { minHeight: 220, borderRadius: 20, overflow: "hidden", backgroundColor: "#000", borderWidth: 1, borderColor: beraflixColors.border },
  video: { width: "100%", aspectRatio: 16 / 9 },
  webView: { width: "100%", height: 240, backgroundColor: "#000" },
  placeholder: { minHeight: 220, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  status: { color: beraflixColors.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
});
