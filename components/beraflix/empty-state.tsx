import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { beraflixColors } from "@/constants/beraflix-theme";

export function EmptyState({
  title,
  message,
  icon = "film-outline",
}: {
  title: string;
  message: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <View style={styles.card}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={22} color={beraflixColors.red} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { minHeight: 170, padding: 22, borderRadius: 20, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border, alignItems: "flex-start", justifyContent: "center", gap: 10 },
  iconBox: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#281019", alignItems: "center", justifyContent: "center" },
  title: { color: beraflixColors.white, fontSize: 16, fontWeight: "800" },
  message: { color: beraflixColors.muted, fontSize: 13, lineHeight: 19 },
});
