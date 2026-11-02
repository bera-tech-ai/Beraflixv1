import { StyleSheet, Text, View } from "react-native";

import { beraflixColors } from "@/constants/beraflix-theme";

export function SectionHeading({ title, eyebrow }: { title: string; eyebrow?: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.rail} />
      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  rail: { width: 3, height: 28, borderRadius: 2, backgroundColor: beraflixColors.red },
  copy: { gap: 2 },
  eyebrow: { color: beraflixColors.red, fontSize: 9, fontWeight: "800", letterSpacing: 1.5 },
  title: { color: beraflixColors.white, fontSize: 19, fontWeight: "800", letterSpacing: 0.1 },
});
