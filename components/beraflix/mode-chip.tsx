import { Pressable, StyleSheet, Text } from "react-native";

import { beraflixColors } from "@/constants/beraflix-theme";

export function ModeChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 38, paddingHorizontal: 15, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  selected: { backgroundColor: beraflixColors.red, borderColor: beraflixColors.red },
  label: { color: beraflixColors.muted, fontSize: 12, fontWeight: "700" },
  selectedLabel: { color: beraflixColors.white },
  pressed: { opacity: 0.76 },
});
