import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { ActionButton } from "@/components/beraflix/action-button";
import { BrandHeader } from "@/components/beraflix/brand-header";
import { BeraflixScreen } from "@/components/beraflix/screen";
import { beraflixColors } from "@/constants/beraflix-theme";
import { useLibrary } from "@/lib/beraflix/library";

export default function CreateCollectionScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const { hydrated, createCollection } = useLibrary();
  const canSave = hydrated && Boolean(name.trim());

  const save = () => {
    if (!canSave) return;
    const id = createCollection(name);
    if (id) router.back();
  };

  return (
    <BeraflixScreen>
      <BrandHeader />
      <Text style={styles.eyebrow}>MY SHELF</Text>
      <Text style={styles.title}>New collection</Text>
      <Text style={styles.body}>Collections are private and saved on this device.</Text>
      <View style={styles.fieldGroup}>
        <Text style={styles.label}>Collection name</Text>
        <TextInput value={name} onChangeText={setName} placeholder="e.g. Weekend picks" placeholderTextColor={beraflixColors.quiet} style={styles.input} maxLength={48} returnKeyType="done" />
      </View>
      <ActionButton label="Save collection" disabled={!canSave} onPress={save} />
      <ActionButton label="Cancel" onPress={() => router.back()} secondary />
      {!hydrated ? <Text style={styles.note}>Reading the device library before saving.</Text> : null}
    </BeraflixScreen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { color: beraflixColors.red, fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  title: { color: beraflixColors.white, fontSize: 27, fontWeight: "900" },
  body: { color: beraflixColors.muted, fontSize: 13, lineHeight: 19 },
  fieldGroup: { gap: 8, marginTop: 8 },
  label: { color: beraflixColors.white, fontSize: 12, fontWeight: "800" },
  input: { minHeight: 52, paddingHorizontal: 15, color: beraflixColors.white, backgroundColor: beraflixColors.surface, borderRadius: 14, borderWidth: 1, borderColor: beraflixColors.border },
  note: { color: beraflixColors.quiet, fontSize: 11, lineHeight: 16 },
});
