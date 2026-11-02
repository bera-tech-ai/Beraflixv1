import type { SubtitleTrack } from "expo-video";

type VolumeControl = { volume: number };
type SubtitleControl = { subtitleTrack: SubtitleTrack | null };
type ProgressControl = { timeUpdateEventInterval: number };

export function setPlayerProgressInterval(player: ProgressControl, seconds: number) {
  player.timeUpdateEventInterval = Math.max(1, seconds);
}

export function setPlayerSubtitle(player: SubtitleControl, track: SubtitleTrack | null) {
  player.subtitleTrack = track;
}

export function setPlayerVolume(player: VolumeControl, volume: number) {
  const bounded = Math.min(1, Math.max(0, volume));
  player.volume = bounded;
  return bounded;
}
