import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { beraflixColors } from "@/constants/beraflix-theme";

export function BrandHeader({ onSearch }: { onSearch?: () => void }) {
  return (
    <View style={styles.row}>
      <View style={styles.brandLockup}>
        <View style={styles.signal} />
        <View>
          <Text style={styles.wordmark}>BERAFLIX</Text>
          <Text style={styles.signature}>BY BERA TECH</Text>
        </View>
      </View>
      {onSearch ? (
        <Pressable
          accessibilityLabel="Search"
          accessibilityRole="button"
          onPress={onSearch}
          style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}
        >
          <Ionicons name="search" size={19} color={beraflixColors.white} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brandLockup: { flexDirection: "row", alignItems: "center", gap: 10 },
  signal: { width: 4, height: 31, backgroundColor: beraflixColors.red, borderRadius: 2 },
  wordmark: { color: beraflixColors.white, fontSize: 20, fontWeight: "900", letterSpacing: 1.1 },
  signature: { color: beraflixColors.muted, fontSize: 8, fontWeight: "700", letterSpacing: 2.3, marginTop: 2 },
  searchButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: beraflixColors.surface, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: beraflixColors.border },
  pressed: { opacity: 0.72 },
});
