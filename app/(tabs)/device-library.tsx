import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "@/components/beraflix/action-button";
import { BrandHeader } from "@/components/beraflix/brand-header";
import { EmptyState } from "@/components/beraflix/empty-state";
import { beraflixColors } from "@/constants/beraflix-theme";
import { useDeviceLibrary, type DeviceMedia, type DeviceMediaKind } from "@/lib/beraflix/device-library";

export default function DeviceLibraryScreen() {
  const router = useRouter();
  const { items, hydrated, permission, refreshing, message, requestAccess, refresh } = useDeviceLibrary();
  const videos = items.filter((item) => item.kind === "video");
  const music = items.filter((item) => item.kind === "audio");
  const images = items.filter((item) => item.kind === "image");
  const open = (item: DeviceMedia) => router.push({ pathname: "/device/[id]", params: { id: item.id } } as never);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={beraflixColors.red} />}
    >
      <BrandHeader />
      <View style={styles.headingBlock}>
        <Text style={styles.eyebrow}>ON YOUR PHONE</Text>
        <Text style={styles.title}>Phone Library</Text>
        <Text style={styles.subtitle}>Play videos, music, and view photos already stored on this phone. Beraflix does not copy, upload, or delete your files.</Text>
      </View>
      {permission !== "granted" ? (
        <View style={styles.permissionCard}>
          <Ionicons name="phone-portrait-outline" size={28} color={beraflixColors.red} />
          <View style={styles.permissionCopy}>
            <Text style={styles.permissionTitle}>Allow phone media access</Text>
            <Text style={styles.permissionText}>Beraflix needs permission to show your existing videos, music, and photos.</Text>
          </View>
          <ActionButton label="Allow access" onPress={() => void requestAccess()} />
        </View>
      ) : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {!hydrated && permission === "unknown" ? <Text style={styles.status}>Checking phone media permission…</Text> : null}
      {hydrated && permission === "granted" && items.length === 0 ? (
        <EmptyState icon="images-outline" title="No phone media found" message="Videos, music, and photos saved on this phone will appear here." />
      ) : null}
      {videos.length > 0 ? <MediaSection title="Videos" kind="video" items={videos} onOpen={open} /> : null}
      {music.length > 0 ? <MediaSection title="Music" kind="audio" items={music} onOpen={open} /> : null}
      {images.length > 0 ? <MediaSection title="Photos" kind="image" items={images} onOpen={open} /> : null}
    </ScrollView>
  );
}

function MediaSection({ title, kind, items, onOpen }: { title: string; kind: DeviceMediaKind; items: DeviceMedia[]; onOpen: (item: DeviceMedia) => void }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.count}>{items.length}</Text></View>
      {items.map((item) => (
        <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Open ${item.name}`} onPress={() => onOpen(item)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
          {kind === "image" ? <Image source={{ uri: item.uri }} style={styles.thumb} contentFit="cover" /> : <View style={styles.iconBox}><Ionicons name={kind === "video" ? "film-outline" : "musical-notes-outline"} size={25} color={beraflixColors.red} /></View>}
          <View style={styles.info}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.meta}>{kind === "video" ? "Video" : kind === "audio" ? "Music" : "Photo"} · On this phone</Text>
          </View>
          <Ionicons name="play-circle-outline" size={24} color={beraflixColors.muted} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18, padding: 18, paddingBottom: 110 },
  headingBlock: { gap: 5 },
  eyebrow: { color: beraflixColors.red, fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  title: { color: beraflixColors.white, fontSize: 32, fontWeight: "900", letterSpacing: -0.5 },
  subtitle: { color: beraflixColors.muted, fontSize: 13, lineHeight: 19 },
  permissionCard: { gap: 12, padding: 16, borderRadius: 18, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  permissionCopy: { gap: 4 },
  permissionTitle: { color: beraflixColors.white, fontSize: 15, fontWeight: "800" },
  permissionText: { color: beraflixColors.muted, fontSize: 12, lineHeight: 18 },
  message: { color: beraflixColors.red, fontSize: 12, lineHeight: 18 },
  status: { color: beraflixColors.muted, fontSize: 12 },
  section: { gap: 10 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { color: beraflixColors.white, fontSize: 18, fontWeight: "900" },
  count: { color: beraflixColors.muted, fontSize: 12 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 16, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  pressed: { opacity: 0.72 },
  iconBox: { width: 54, height: 54, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: beraflixColors.elevated },
  thumb: { width: 70, height: 54, borderRadius: 10, backgroundColor: beraflixColors.elevated },
  info: { flex: 1, gap: 5 },
  cardTitle: { color: beraflixColors.white, fontSize: 14, fontWeight: "800", lineHeight: 18 },
  meta: { color: beraflixColors.muted, fontSize: 11 },
});
