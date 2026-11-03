import * as MediaLibrary from "expo-media-library";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { Platform } from "react-native";

type PermissionState = "unknown" | "granted" | "denied";

export type DeviceMediaKind = "video" | "audio" | "image";

export type DeviceMedia = {
  id: string;
  name: string;
  uri: string;
  mimeType: string;
  size: number;
  kind: DeviceMediaKind;
  duration: number;
  width: number;
  height: number;
};

type DeviceLibraryContextValue = {
  items: DeviceMedia[];
  hydrated: boolean;
  permission: PermissionState;
  refreshing: boolean;
  message: string | null;
  requestAccess: () => Promise<void>;
  refresh: () => Promise<void>;
  getFile: (id: string) => DeviceMedia | null;
};

const DeviceLibraryContext = createContext<DeviceLibraryContextValue | null>(null);

type QueriedMediaAsset = {
  id: string;
  filename: string;
  uri: string;
  mediaType: string;
  width: number;
  height: number;
  duration: number;
};

function kindFor(mediaType: string): DeviceMediaKind | null {
  if (mediaType === "video") return "video";
  if (mediaType === "audio") return "audio";
  if (mediaType === "photo") return "image";
  return null;
}

function mimeFor(kind: DeviceMediaKind, filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (kind === "video") return extension ? `video/${extension === "mkv" ? "x-matroska" : extension}` : "video/*";
  if (kind === "audio") return extension ? `audio/${extension}` : "audio/*";
  return extension ? `image/${extension === "jpg" ? "jpeg" : extension}` : "image/*";
}

function toDeviceMedia(asset: QueriedMediaAsset): DeviceMedia | null {
  const kind = kindFor(asset.mediaType);
  if (!kind) return null;
  return {
    id: asset.id,
    name: asset.filename || `${kind}-${asset.id}`,
    uri: asset.uri,
    mimeType: mimeFor(kind, asset.filename || ""),
    size: 0,
    kind,
    duration: asset.duration || 0,
    width: asset.width || 0,
    height: asset.height || 0,
  };
}

export function DeviceLibraryProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<DeviceMedia[]>([]);
  const [permission, setPermission] = useState<PermissionState>(Platform.OS === "web" ? "denied" : "unknown");
  const [hydrated, setHydrated] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const loadMedia = useCallback(async () => {
    if (Platform.OS === "web") {
      setMessage("Phone media access is available in the native Android app.");
      return;
    }
    setRefreshing(true);
    setMessage(null);
    try {
      const response = await MediaLibrary.getPermissionsAsync(false, ["audio", "photo", "video"]);
      if (!response.granted && response.accessPrivileges !== "limited") {
        setPermission("denied");
        setItems([]);
        setMessage("Allow Beraflix to access videos, music, and photos on this phone.");
        return;
      }
      setPermission("granted");
      const pages = await Promise.all([
        MediaLibrary.getAssetsAsync({ first: 250, mediaType: "video", sortBy: [["modificationTime", false]] }),
        MediaLibrary.getAssetsAsync({ first: 250, mediaType: "audio", sortBy: [["modificationTime", false]] }),
        MediaLibrary.getAssetsAsync({ first: 250, mediaType: "photo", sortBy: [["modificationTime", false]] }),
      ]);
      const next = pages.flatMap((page) => page.assets.map(toDeviceMedia).filter((item): item is DeviceMedia => Boolean(item)));
      setItems(next);
      if (next.length === 0) setMessage("No videos, music, or photos were found on this phone.");
    } catch {
      setMessage("The phone media library could not be read.");
    } finally {
      setHydrated(true);
      setRefreshing(false);
    }
  }, []);

  const requestAccess = useCallback(async () => {
    if (Platform.OS === "web") {
      setMessage("Phone media access is available in the native Android app.");
      return;
    }
    setRefreshing(true);
    setMessage(null);
    try {
      const response = await MediaLibrary.requestPermissionsAsync(false, ["audio", "photo", "video"]);
      setPermission(response.granted || response.accessPrivileges === "limited" ? "granted" : "denied");
      if (response.granted || response.accessPrivileges === "limited") await loadMedia();
      else setMessage("Media permission was not granted. You can enable it in Android Settings.");
    } catch {
      setPermission("denied");
      setMessage("Beraflix could not request phone media permission.");
      setRefreshing(false);
    }
  }, [loadMedia]);

  useEffect(() => {
    void loadMedia();
  }, [loadMedia]);

  const getFile = useCallback((id: string) => items.find((item) => item.id === id) ?? null, [items]);
  const value = useMemo(() => ({ items, hydrated, permission, refreshing, message, requestAccess, refresh: loadMedia, getFile }), [items, hydrated, permission, refreshing, message, requestAccess, loadMedia, getFile]);
  return <DeviceLibraryContext.Provider value={value}>{children}</DeviceLibraryContext.Provider>;
}

export function useDeviceLibrary(): DeviceLibraryContextValue {
  const value = useContext(DeviceLibraryContext);
  if (!value) throw new Error("useDeviceLibrary must be used inside DeviceLibraryProvider");
  return value;
}
