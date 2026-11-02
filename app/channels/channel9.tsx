import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { BrandHeader } from "@/components/beraflix/brand-header";
import { EmptyState } from "@/components/beraflix/empty-state";
import { BeraflixScreen } from "@/components/beraflix/screen";
import { SectionHeading } from "@/components/beraflix/section-heading";
import { beraflixColors } from "@/constants/beraflix-theme";
import { getChannelSchedule } from "@/lib/beraflix/api";
import type { ScheduleProgram } from "@/lib/beraflix/types";

export default function ChannelNineScheduleScreen() {
  const [programs, setPrograms] = useState<ScheduleProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    getChannelSchedule(9).then((result) => {
      if (active) setPrograms(result);
    }).catch(() => {
      if (active) setFailed(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  return (
    <BeraflixScreen>
      <BrandHeader />
      <View style={styles.headingBlock}>
        <Text style={styles.eyebrow}>TV CHANNELS</Text>
        <Text style={styles.title}>Channel 9</Text>
        <Text style={styles.subtitle}>Programme schedule</Text>
      </View>
      <SectionHeading title="On air and up next" eyebrow="Schedule" />
      {loading ? <Text style={styles.status}>Checking the schedule…</Text> : null}
      {failed ? <EmptyState icon="cloud-offline-outline" title="Schedule unavailable" message="The Channel 9 schedule could not be refreshed." /> : null}
      {!loading && !failed && programs.length === 0 ? <EmptyState icon="calendar-outline" title="No schedule available" message="There are no programme records available right now." /> : null}
      {programs.map((program) => <ScheduleCard key={program.id} program={program} />)}
    </BeraflixScreen>
  );
}

function ScheduleCard({ program }: { program: ScheduleProgram }) {
  const time = [program.startTime, program.endTime].filter(Boolean).join(" — ");
  return (
    <View style={styles.programCard}>
      <View style={styles.programRail} />
      <View style={styles.programCopy}>
        {time ? <Text style={styles.time}>{time}</Text> : null}
        <Text style={styles.programTitle}>{program.title}</Text>
        {program.description ? <Text style={styles.programDescription}>{program.description}</Text> : null}
        {program.presenters.length ? <Text style={styles.presenters}>{program.presenters.join(" · ")}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headingBlock: { gap: 4 },
  eyebrow: { color: beraflixColors.red, fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  title: { color: beraflixColors.white, fontSize: 32, fontWeight: "900" },
  subtitle: { color: beraflixColors.muted, fontSize: 13 },
  status: { color: beraflixColors.muted, fontSize: 12, paddingVertical: 8 },
  programCard: { flexDirection: "row", gap: 13, padding: 16, borderRadius: 18, backgroundColor: beraflixColors.surface, borderWidth: 1, borderColor: beraflixColors.border },
  programRail: { width: 3, minHeight: 42, borderRadius: 2, backgroundColor: beraflixColors.red },
  programCopy: { flex: 1, gap: 6 },
  time: { color: beraflixColors.red, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  programTitle: { color: beraflixColors.white, fontSize: 15, fontWeight: "800" },
  programDescription: { color: beraflixColors.muted, fontSize: 12, lineHeight: 18 },
  presenters: { color: beraflixColors.quiet, fontSize: 10 },
});
