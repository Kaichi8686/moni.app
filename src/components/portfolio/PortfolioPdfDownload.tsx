"use client";

import { useState } from "react";
import { pdf, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { PortfolioData } from "@/lib/portfolio/buildPortfolioData";
import { milestoneTypeLabel } from "@/lib/gamification/milestones";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 11 },
  title: { fontSize: 20, marginBottom: 8, fontWeight: "bold" },
  section: { marginTop: 16 },
  heading: { fontSize: 13, fontWeight: "bold", marginBottom: 6, color: "#5b21b6" },
  line: { marginBottom: 4 },
});

function PortfolioDocument({ data }: { data: PortfolioData }) {
  const name = data.profile?.displayName ?? "Portfolio";
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{name}</Text>
        <Text style={styles.line}>{data.tierMeta.label}</Text>
        <Text style={styles.line}>{data.profile?.bio ?? ""}</Text>
        <Text style={styles.line}>
          投稿 {data.postCount} · 連続 {data.activityStreak}日 · 活動 {data.activityTotal}回
        </Text>

        <View style={styles.section}>
          <Text style={styles.heading}>バッジ</Text>
          {data.badges.map((b) => (
            <Text key={b.id} style={styles.line}>
              {b.icon} {b.label}
            </Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>プロジェクト</Text>
          {data.projects.map((p) => (
            <Text key={p.id} style={styles.line}>
              {p.name}（未完了課題 {p.openIssueCount}）
            </Text>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>マイルストーン</Text>
          {data.milestones.slice(0, 12).map((m) => (
            <Text key={m.id} style={styles.line}>
              {milestoneTypeLabel(m.type)}: {m.title}
            </Text>
          ))}
        </View>
      </Page>
    </Document>
  );
}

type Props = { data: PortfolioData; className?: string };

export function PortfolioPdfDownload({ data, className = "" }: Props) {
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    try {
      const blob = await pdf(<PortfolioDocument data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.profile?.displayName ?? "portfolio"}-moni.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      className={className || "flex-1 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white disabled:opacity-50"}
      onClick={() => void download()}
    >
      {loading ? "PDF作成中…" : "PDFダウンロード"}
    </button>
  );
}
