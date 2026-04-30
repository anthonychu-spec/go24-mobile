import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Pressable, Share,
  StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { apiClient } from '../src/api/client';
import { colors } from '../src/theme/colors';

interface ReferralData {
  code: string;
  link: string;
  totalReferred: number;
  completed: number;
  rewarded: number;
}

export default function ReferralScreen() {
  const router = useRouter();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<ReferralData>('/referral/my')
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  const handleShare = async () => {
    if (!data) return;
    await Share.share({
      message: `加入 GO24 Fitness！用我嘅專屬連結登記，你同我都享有一個月免費會籍 🎁\n\n${data.link}`,
      url: data.link,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.center}><ActivityIndicator color={colors.primary} size="large" /></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()}><Text style={s.back}>← Back</Text></Pressable>
        <Text style={s.title}>介紹朋友</Text>
      </View>

      <View style={s.body}>
        {/* Hero */}
        <View style={s.heroCard}>
          <Text style={s.heroIcon}>🎁</Text>
          <Text style={s.heroTitle}>介紹朋友，各享一個月免費！</Text>
          <Text style={s.heroSub}>朋友用你嘅連結登記並成為會員，你同佢都獲得一個月免費會籍。</Text>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          <View style={s.statBox}>
            <Text style={s.statNum}>{data?.totalReferred ?? 0}</Text>
            <Text style={s.statLabel}>已介紹</Text>
          </View>
          <View style={s.statBox}>
            <Text style={s.statNum}>{data?.completed ?? 0}</Text>
            <Text style={s.statLabel}>已成功</Text>
          </View>
          <View style={s.statBox}>
            <Text style={[s.statNum, { color: colors.success }]}>{data?.rewarded ?? 0}</Text>
            <Text style={s.statLabel}>已獲獎</Text>
          </View>
        </View>

        {/* Code */}
        <View style={s.codeCard}>
          <Text style={s.codeLabel}>你的專屬邀請碼</Text>
          <Text style={s.code}>{data?.code}</Text>
          <Text style={s.link} numberOfLines={1}>{data?.link}</Text>
        </View>

        {/* Share button */}
        <Pressable style={s.shareBtn} onPress={handleShare}>
          <Text style={s.shareBtnText}>📤  分享邀請連結</Text>
        </Pressable>

        <Text style={s.note}>
          獎勵會由 GO24 前台人員於確認後手動發放，一般 3-5 個工作日。
        </Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: colors.bg },
  center:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header:  { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  back:    { color: colors.primary, fontSize: 15, marginBottom: 8 },
  title:   { fontSize: 26, fontWeight: '800', color: colors.text },
  body:    { flex: 1, padding: 20, gap: 16 },

  heroCard: {
    backgroundColor: colors.card, borderRadius: 16,
    padding: 20, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  heroIcon:  { fontSize: 44 },
  heroTitle: { fontSize: 17, fontWeight: '800', color: colors.text, textAlign: 'center' },
  heroSub:   { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  statsRow: { flexDirection: 'row', gap: 12 },
  statBox: {
    flex: 1, backgroundColor: colors.card, borderRadius: 12,
    padding: 14, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  statNum:   { fontSize: 28, fontWeight: '900', color: colors.primary },
  statLabel: { fontSize: 12, color: colors.textMuted },

  codeCard: {
    backgroundColor: colors.card, borderRadius: 12,
    padding: 16, gap: 6, borderWidth: 1, borderColor: colors.border,
  },
  codeLabel: { fontSize: 12, color: colors.textMuted },
  code:      { fontSize: 22, fontWeight: '900', color: colors.primary, letterSpacing: 2 },
  link:      { fontSize: 12, color: colors.textMuted },

  shareBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  shareBtnText: { color: colors.bg, fontWeight: '800', fontSize: 16 },

  note: { fontSize: 12, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
});
