import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { ActionButton } from "@/components/beraflix/action-button";
import { BrandHeader } from "@/components/beraflix/brand-header";
import { EmptyState } from "@/components/beraflix/empty-state";
import { BeraflixScreen } from "@/components/beraflix/screen";
import { SectionHeading } from "@/components/beraflix/section-heading";
import { beraflixColors } from "@/constants/beraflix-theme";
import { useDownloads, type DownloadRecord } from "@/lib/beraflix/downloads";

export default function DownloadsScreen() {
  const router = useRouter();
  const { records, hydrated, pauseDownload, resumeDownload, retryDownload, deleteDownload, verifyDownload } = useDownloads();
  const [deleteTarget, setDeleteTarget] = useState<DownloadRecord | null>(null);
  const hasActiveTransfer = records.some((record) => record.status === "preparing" || record.status === "downloading");

  const playOffline = async (record: DownloadRecord) => {
    if (!await verifyDownload(record.id)) return;
    router.push({ pathname: "/offline/[id]", params: { id: record.id } } as never);
  };

  return (
    <BeraflixScreen>
      <BrandHeader />
      <View style={styles.headingBlock}>
        <Text style={styles.eyebrow}>OFFLINE · THIS DEVICE</Text>
        <Text style={styles.title}>Downloads</Text>
      </View>
      <View style={styles.notice}>
        <Ionicons name="phone-portrait-outline" size={19} color={beraflixColors.red} />
        <Text style={styles.noticeText}>Files and download records stay in app-private storage on this device. Only verified file bytes are counted.</Text>
      </View>
      <SectionHeading title="Saved for offline" eyebrow={hydrated ? `${records.length} on this device` : "Device library"} />
      {!hydrated ? <Text style={styles.statusText}>Reading saved files from this device…</Text> : null}
      {hydrated && records.length === 0 ? (
        <EmptyState
          icon="download-outline"
          title="No offline files yet"
          message="Only titles with a verified, supported offline source will be listed here. Progress appears only while a real transfer is writing to local storage."
        />
      ) : null}
      {records.map((record) => (
        <DownloadCard
          key={record.id}
          record={record}
          hasActiveTransfer={hasActiveTransfer}
          onPause={() => void pauseDownload(record.id)}
          onResume={() => void resumeDownload(record.id)}
          onRetry={() => void retryDownload(record.id)}
          onPlay={() => void playOffline(record)}
          onDelete={() => setDeleteTarget(record)}
        />
      ))}
      {records.length === 0 ? <ActionButton label="Explore titles" onPress={() => router.push("/(tabs)/explore" as never)} secondary /> : null}
      <Text style={styles.footerNote}>A paused transfer can resume while its secure session is valid. If it expires, Retry starts a fresh verified transfer.</Text>

      <Modal visible={deleteTarget !== null} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete this saved file?</Text>
            <Text style={styles.confirmBody}>The file and its device-only download record will be removed from this device.</Text>
            <View style={styles.confirmActions}>
              <ActionButton label="Keep file" secondary onPress={() => setDeleteTarget(null)} />
              <ActionButton
                label="Delete file"
                onPress={() => {
                  if (deleteTarget) void deleteDownload(deleteTarget.id);
                  setDeleteTarget(null);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </BeraflixScreen>
  );
}

function DownloadCard({
  record,
  hasActiveTransfer,
  onPause,
  onResume,
  onRetry,
  onPlay,
  onDelete,
}: {
  record: DownloadRecord;
  hasActiveTransfer: boolean;
  onPause: () => void;
  onResume: () => void;
  onRetry: () => void;
  onPlay: () => void;
  onDelete: () => void;
}) {
  const percent = record.expectedBytes > 0 ? Math.min(100, Math.floor((record.bytesWritten / record.expectedBytes) * 100)) : 0;
  const statusLabel = record.status === "complete"
    ? `VERIFIED · ${formatBytes(record.expectedBytes)}`
    : record.status === "downloading"
      ? `${percent}% · ${formatBytes(record.bytesWritten)} OF ${formatBytes(record.expectedBytes)}`
      : record.status === "paused"
        ? `PAUSED · ${percent}% SAVED`
        : record.status === "preparing"
          ? "CHECKING SOURCE"
          : "NOT AVAILABLE";

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.poster}>
          {record.title.coverUrl ? <Image source={{ uri: record.title.coverUrl }} contentFit="cover" cachePolicy="memory" transition={0} style={StyleSheet.absoluteFill} /> : <Ionicons name="film-outline" size={22} color={beraflixColors.quiet} />}
        </View>
        <View style={styles.info}>
          <Text style={styles.cardTitle} numberOfLines={2}>{record.title.title}</Text>
          {record.season && record.episode ? <Text style={styles.episodeText}>Season {record.season} · Episode {record.episode}</Text> : null}
          <Text style={styles.statusText}>{statusLabel}</Text>
          {record.status === "downloading" || record.status === "paused" ? (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${percent}%` }]} />
            </View>
          ) : null}
          {record.status === "error" ? <Text style={styles.errorText}>{record.message}</Text> : null}
          {record.status === "preparing" ? <Text style={styles.messageText}>{record.message}</Text> : null}
        </View>
      </View>
      <View style={styles.actions}>
        {record.status === "complete" ? <ActionButton label="Play offline" onPress={onPlay} /> : null}
        {record.status === "downloading" ? <ActionButton label="Pause" onPress={onPause} secondary /> : null}
        {record.status === "paused" ? <ActionButton label="Resume" disabled={hasActiveTransfer} onPress={onResume} secondary /> : null}
        {record.status === "error" ? <ActionButton label="Retry" disabled={hasActiveTransfer} onPress={onRetry} secondary /> : null}
        {record.status === "preparing" ? <Text style={styles.messageText}>Preparing on this device…</Text> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${record.title.title} download`} onPress={onDelete} style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
          <Ionicons name="trash-outline" size={17} color={beraflixColors.muted} />
        </Pressable>
      </View>
    </View>
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** exponent).toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

const styles = StyleSheet.create({
  headingBlock: { gap: 4 },
  eyebrow: { color: beraflixColors.red, fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  title: { color: beraflixColors.white, fontSize: 32, fontWeight: "900", letterSpacing: -0.5 },
  notice: { flexDirection: "row", alignItems: "center", gap: 11, padding: 15, borderRadius: 16, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  noticeText: { flex: 1, color: beraflixColors.muted, fontSize: 12, lineHeight: 18 },
  statusText: { color: beraflixColors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  card: { gap: 12, padding: 13, borderRadius: 18, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  cardTop: { flexDirection: "row", gap: 13 },
  poster: { width: 62, height: 88, borderRadius: 10, overflow: "hidden", backgroundColor: beraflixColors.elevated, alignItems: "center", justifyContent: "center" },
  info: { flex: 1, gap: 7, justifyContent: "center" },
  cardTitle: { color: beraflixColors.white, fontSize: 15, fontWeight: "800", lineHeight: 19 },
  episodeText: { color: beraflixColors.muted, fontSize: 11 },
  progressTrack: { height: 5, overflow: "hidden", borderRadius: 3, backgroundColor: beraflixColors.border },
  progressFill: { height: "100%", backgroundColor: beraflixColors.red },
  errorText: { color: beraflixColors.red, fontSize: 11, lineHeight: 16 },
  messageText: { color: beraflixColors.muted, fontSize: 11, lineHeight: 16 },
  actions: { flexDirection: "row", alignItems: "center", gap: 8 },
  deleteButton: { width: 46, height: 46, alignItems: "center", justifyContent: "center", borderRadius: 13, backgroundColor: beraflixColors.elevated },
  pressed: { opacity: 0.72 },
  footerNote: { color: beraflixColors.quiet, fontSize: 10, lineHeight: 15 },
  modalBackdrop: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.72)" },
  confirmCard: { gap: 15, padding: 22, borderRadius: 20, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  confirmTitle: { color: beraflixColors.white, fontSize: 18, fontWeight: "900" },
  confirmBody: { color: beraflixColors.muted, fontSize: 13, lineHeight: 19 },
  confirmActions: { gap: 9 },
});
