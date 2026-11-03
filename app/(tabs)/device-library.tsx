import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "@/components/beraflix/action-button";
import { BrandHeader } from "@/components/beraflix/brand-header";
import { EmptyState } from "@/components/beraflix/empty-state";
import { BeraflixScreen } from "@/components/beraflix/screen";
import { SectionHeading } from "@/components/beraflix/section-heading";
import { beraflixColors } from "@/constants/beraflix-theme";
import { useDeviceLibrary, type DeviceMedia } from "@/lib/beraflix/device-library";

export default function DeviceLibraryScreen() {
  const router = useRouter();
  const { items, hydrated, importing, message, importFiles, deleteFile } = useDeviceLibrary();
  const videos = items.filter((item) => item.kind === "video");
  const music = items.filter((item) => item.kind === "audio");

  return (
    <BeraflixScreen>
      <BrandHeader />
      <View style={styles.headingBlock}>
        <Text style={styles.eyebrow}>THIS DEVICE</Text>
        <Text style={styles.title}>Device Library</Text>
        <Text style={styles.subtitle}>Import personal videos and music into Beraflix for offline playback.</Text>
      </View>
      <View style={styles.notice}>
        <Ionicons name="lock-closed-outline" size={19} color={beraflixColors.red} />
        <Text style={styles.noticeText}>Files are copied into Beraflix private storage. Removing an item here does not delete your original file.</Text>
      </View>
      <ActionButton label={importing ? "Adding files…" : "Add videos or music"} disabled={importing} onPress={() => void importFiles()} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {!hydrated ? <Text style={styles.status}>Reading files saved in Beraflix…</Text> : null}
      {hydrated && items.length === 0 ? (
        <EmptyState icon="folder-open-outline" title="Your device library is empty" message="Tap Add videos or music and choose files from the Android file picker." />
      ) : null}
      {videos.length > 0 ? <MediaSection title="Videos" items={videos} onOpen={(item) => router.push({ pathname: "/device/[id]", params: { id: item.id } } as never)} onDelete={(item) => void deleteFile(item.id)} /> : null}
      {music.length > 0 ? <MediaSection title="Music" items={music} onOpen={(item) => router.push({ pathname: "/device/[id]", params: { id: item.id } } as never)} onDelete={(item) => void deleteFile(item.id)} /> : null}
    </BeraflixScreen>
  );
}

function MediaSection({ title, items, onOpen, onDelete }: { title: string; items: DeviceMedia[]; onOpen: (item: DeviceMedia) => void; onDelete: (item: DeviceMedia) => void }) {
  return (
    <View style={styles.section}>
      <SectionHeading title={title} eyebrow={`${items.length} saved`} />
      {items.map((item) => (
        <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Open ${item.name}`} onPress={() => onOpen(item)} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
          <View style={styles.iconBox}>
            <Ionicons name={item.kind === "video" ? "film-outline" : "musical-notes-outline"} size={25} color={beraflixColors.red} />
          </View>
          <View style={styles.info}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.meta}>{formatBytes(item.size)} · Saved in Beraflix</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${item.name} from Beraflix`} onPress={() => onDelete(item)} hitSlop={10} style={styles.deleteButton}>
            <Ionicons name="trash-outline" size={18} color={beraflixColors.muted} />
          </Pressable>
        </Pressable>
      ))}
    </View>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "Size unavailable";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

const styles = StyleSheet.create({
  headingBlock: { gap: 5 },
  eyebrow: { color: beraflixColors.red, fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  title: { color: beraflixColors.white, fontSize: 32, fontWeight: "900", letterSpacing: -0.5 },
  subtitle: { color: beraflixColors.muted, fontSize: 13, lineHeight: 19 },
  notice: { flexDirection: "row", alignItems: "center", gap: 11, padding: 15, borderRadius: 16, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  noticeText: { flex: 1, color: beraflixColors.muted, fontSize: 12, lineHeight: 18 },
  message: { color: beraflixColors.red, fontSize: 12, lineHeight: 18 },
  status: { color: beraflixColors.muted, fontSize: 12 },
  section: { gap: 10 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 16, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  pressed: { opacity: 0.72 },
  iconBox: { width: 54, height: 54, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: beraflixColors.elevated },
  info: { flex: 1, gap: 5 },
  cardTitle: { color: beraflixColors.white, fontSize: 14, fontWeight: "800", lineHeight: 18 },
  meta: { color: beraflixColors.muted, fontSize: 11 },
  deleteButton: { padding: 8 },
});
