import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { BrandHeader } from "@/components/beraflix/brand-header";
import { BeraflixScreen } from "@/components/beraflix/screen";
import { beraflixColors } from "@/constants/beraflix-theme";
import { useLibrary } from "@/lib/beraflix/library";

const qualityOptions = ["auto", "720p", "1080p"] as const;

export default function ProfileScreen() {
  const { state, hydrated, updatePreferences } = useLibrary();
  const qualityIndex = qualityOptions.indexOf(state.preferences.quality as (typeof qualityOptions)[number]);
  const nextQuality = qualityOptions[(qualityIndex + 1) % qualityOptions.length];

  return (
    <BeraflixScreen>
      <BrandHeader />
      <View style={styles.headingBlock}>
        <Text style={styles.eyebrow}>BERA TECH</Text>
        <Text style={styles.title}>Profile</Text>
      </View>

      <View style={styles.brandCard}>
        <View style={styles.brandMark}><Text style={styles.brandMarkText}>B</Text><View style={styles.playCut} /></View>
        <View style={styles.brandCopy}><Text style={styles.brandName}>BERAFLIX</Text><Text style={styles.brandByline}>BY BERA TECH</Text></View>
      </View>

      <View style={styles.settingsList}>
        <PreferenceRow icon="play-outline" title="Preferred quality" detail={hydrated ? state.preferences.quality.toUpperCase() : "Reading this device"} disabled={!hydrated} onPress={() => updatePreferences({ quality: nextQuality })} />
        <PreferenceRow icon="chatbox-ellipses-outline" title="Subtitles" detail={hydrated ? state.preferences.subtitlesEnabled ? "On" : "Off" : "Reading this device"} disabled={!hydrated} onPress={() => updatePreferences({ subtitlesEnabled: !state.preferences.subtitlesEnabled })} />
        <PreferenceRow icon="language-outline" title="Subtitle language" detail={hydrated ? state.preferences.subtitleLanguage === "device" ? "Device default" : state.preferences.subtitleLanguage.toUpperCase() : "Reading this device"} disabled={!hydrated} onPress={() => updatePreferences({ subtitleLanguage: state.preferences.subtitleLanguage === "device" ? "en" : "device" })} />
        <PreferenceRow icon="download-outline" title="Offline storage" detail="App-private files on this device" />
        <PreferenceRow icon="shield-checkmark-outline" title="Privacy" detail="Your library stays on this device" />
      </View>
      <Text style={styles.hint}>Tap quality, subtitles, or language to change this device’s preferences.</Text>
      <Text style={styles.version}>BERAFLIX · BY BERA TECH</Text>
    </BeraflixScreen>
  );
}

function PreferenceRow({ icon, title, detail, onPress, disabled = false }: { icon: React.ComponentProps<typeof Ionicons>["name"]; title: string; detail: string; onPress?: () => void; disabled?: boolean }) {
  const contents = (
    <>
      <View style={styles.settingIcon}><Ionicons name={icon} size={19} color={beraflixColors.red} /></View>
      <View style={styles.settingCopy}><Text style={styles.settingTitle}>{title}</Text><Text style={styles.settingDetail}>{detail}</Text></View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={beraflixColors.quiet} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.settingRow}>{contents}</View>;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.settingRow, pressed && styles.pressed, disabled && styles.disabled]}>{contents}</Pressable>;
}

const styles = StyleSheet.create({
  headingBlock: { gap: 4 },
  eyebrow: { color: beraflixColors.red, fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  title: { color: beraflixColors.white, fontSize: 32, fontWeight: "900", letterSpacing: -0.5 },
  brandCard: { minHeight: 122, flexDirection: "row", alignItems: "center", gap: 16, padding: 20, borderRadius: 21, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  brandMark: { width: 58, height: 58, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: beraflixColors.redDeep, overflow: "hidden" },
  brandMarkText: { color: beraflixColors.white, fontSize: 35, fontWeight: "900", lineHeight: 40 },
  playCut: { position: "absolute", right: 11, top: 18, width: 9, height: 22, backgroundColor: beraflixColors.red, transform: [{ rotate: "26deg" }] },
  brandCopy: { gap: 5 },
  brandName: { color: beraflixColors.white, fontSize: 20, fontWeight: "900", letterSpacing: 1.5 },
  brandByline: { color: beraflixColors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 2.4 },
  settingsList: { overflow: "hidden", borderRadius: 20, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  settingRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: beraflixColors.border },
  settingIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#291018" },
  settingCopy: { flex: 1, gap: 4 },
  settingTitle: { color: beraflixColors.white, fontSize: 13, fontWeight: "800" },
  settingDetail: { color: beraflixColors.muted, fontSize: 11 },
  hint: { color: beraflixColors.quiet, fontSize: 11, lineHeight: 16 },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.78 },
  version: { color: beraflixColors.quiet, textAlign: "center", fontSize: 9, fontWeight: "800", letterSpacing: 2 },
});
