import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { Platform } from "react-native";

const STORAGE_KEY = "beraflix.device-media.v1";
const DIRECTORY = "beraflix-device/";

export type DeviceMediaKind = "video" | "audio";

export type DeviceMedia = {
  id: string;
  name: string;
  uri: string;
  mimeType: string;
  size: number;
  kind: DeviceMediaKind;
  addedAt: number;
};

type DeviceLibraryContextValue = {
  items: DeviceMedia[];
  hydrated: boolean;
  importing: boolean;
  message: string | null;
  importFiles: () => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  getFile: (id: string) => DeviceMedia | null;
};

const DeviceLibraryContext = createContext<DeviceLibraryContextValue | null>(null);

function kindFor(name: string, mimeType: string): DeviceMediaKind | null {
  if (mimeType.toLowerCase().startsWith("video/") || /\.(mp4|m4v|mov|mkv|webm|avi|3gp)$/i.test(name)) return "video";
  if (mimeType.toLowerCase().startsWith("audio/") || /\.(mp3|m4a|aac|wav|flac|ogg|opus|wma)$/i.test(name)) return "audio";
  return null;
}

function safeFileName(name: string, fallback: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9._ -]/g, "_").trim().slice(0, 160);
  return cleaned || fallback;
}

function normalize(item: unknown): DeviceMedia | null {
  if (!item || typeof item !== "object") return null;
  const value = item as Partial<DeviceMedia>;
  if (!value.id || !value.name || !value.uri || (value.kind !== "video" && value.kind !== "audio")) return null;
  return {
    id: String(value.id),
    name: String(value.name),
    uri: String(value.uri),
    mimeType: String(value.mimeType || "application/octet-stream"),
    size: Number.isFinite(value.size) ? Number(value.size) : 0,
    kind: value.kind,
    addedAt: Number.isFinite(value.addedAt) ? Number(value.addedAt) : Date.now(),
  };
}

export function DeviceLibraryProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<DeviceMedia[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY).then(async (stored) => {
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      const records = Array.isArray(parsed) ? parsed.map(normalize).filter((item): item is DeviceMedia => Boolean(item)) : [];
      const available = await Promise.all(records.map(async (item) => {
        try {
          const info = await FileSystem.getInfoAsync(item.uri);
          return info.exists && !info.isDirectory ? item : null;
        } catch {
          return null;
        }
      }));
      if (active) setItems(available.filter((item): item is DeviceMedia => Boolean(item)));
    }).catch(() => {
      if (active) setMessage("The device library could not be read.");
    }).finally(() => {
      if (active) setHydrated(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!hydrated || Platform.OS === "web") return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => setMessage("The device library could not be saved."));
  }, [items, hydrated]);

  const importFiles = useCallback(async () => {
    if (Platform.OS === "web") {
      setMessage("Importing device files is available in the native Android app.");
      return;
    }
    setMessage(null);
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["video/*", "audio/*"],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const directory = `${FileSystem.documentDirectory ?? ""}${DIRECTORY}`;
      if (!FileSystem.documentDirectory) throw new Error("Private app storage is unavailable.");
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      const imported: DeviceMedia[] = [];
      for (const [index, asset] of result.assets.entries()) {
        const kind = kindFor(asset.name, asset.mimeType || "");
        if (!kind) continue;
        const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
        const destination = `${directory}${id}-${safeFileName(asset.name, `media-${index}`)}`;
        await FileSystem.copyAsync({ from: asset.uri, to: destination });
        imported.push({
          id,
          name: asset.name,
          uri: destination,
          mimeType: asset.mimeType || (kind === "video" ? "video/mp4" : "audio/mpeg"),
          size: asset.size || 0,
          kind,
          addedAt: Date.now(),
        });
      }
      if (imported.length === 0) {
        setMessage("Choose a supported video or music file.");
        return;
      }
      setItems((current) => [...imported, ...current]);
      setMessage(`${imported.length} file${imported.length === 1 ? "" : "s"} added to Beraflix.`);
    } catch {
      setMessage("The selected files could not be imported.");
    } finally {
      setImporting(false);
    }
  }, []);

  const deleteFile = useCallback(async (id: string) => {
    const item = items.find((candidate) => candidate.id === id);
    if (item) await FileSystem.deleteAsync(item.uri, { idempotent: true }).catch(() => undefined);
    setItems((current) => current.filter((candidate) => candidate.id !== id));
  }, [items]);

  const getFile = useCallback((id: string) => items.find((item) => item.id === id) ?? null, [items]);
  const value = useMemo(() => ({ items, hydrated, importing, message, importFiles, deleteFile, getFile }), [items, hydrated, importing, message, importFiles, deleteFile, getFile]);
  return <DeviceLibraryContext.Provider value={value}>{children}</DeviceLibraryContext.Provider>;
}

export function useDeviceLibrary(): DeviceLibraryContextValue {
  const value = useContext(DeviceLibraryContext);
  if (!value) throw new Error("useDeviceLibrary must be used inside DeviceLibraryProvider");
  return value;
}
