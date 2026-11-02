import { Pressable, StyleSheet, Text } from "react-native";

import { beraflixColors } from "@/constants/beraflix-theme";

export function ActionButton({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress?: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary ? styles.secondary : styles.primary,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.label, secondary && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 48, paddingHorizontal: 18, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  primary: { backgroundColor: beraflixColors.red },
  secondary: { backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  label: { color: beraflixColors.white, fontSize: 14, fontWeight: "800", letterSpacing: 0.2 },
  secondaryLabel: { color: beraflixColors.text },
  disabled: { opacity: 0.42 },
  pressed: { opacity: 0.76 },
});
