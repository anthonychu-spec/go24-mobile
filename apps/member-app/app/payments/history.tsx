import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { apiClient, API_BASE } from '../../src/api/client';
import { tokenStorage } from '../../src/auth/storage';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

interface PaymentRecord {
  id: string; source: 'app' | 'pgm'; date: string;
  amountHkd: number; description: string; status: string; invoiceAvailable: boolean;
}

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-HK', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

export default function PaymentHistoryScreen() {
  const router = useRouter();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<PaymentRecord[]>('/me/payments');
      setPayments(data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const downloadInvoice = async (id: string) => {
    if (Platform.OS === 'web') {
      const token = await tokenStorage.getAccess();
      window.open(`${API_BASE}/me/payments/${id}/invoice?token=${token}`, '_blank');
      return;
    }
    setDownloading(id);
    try {
      const token = await tokenStorage.getAccess();
      const path  = `${FileSystem.cacheDirectory}go24-invoice-${id}.pdf`;
      await FileSystem.downloadAsync(`${API_BASE}/me/payments/${id}/invoice`, path, {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'application/pdf' });
      }
    } catch { /* show nothing — sharing is optional */ }
    finally { setDownloading(null); }
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={s.title}>Payment History</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={payments}
          keyExtractor={p => p.id}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="receipt-outline" size={48} color={colors.border} />
              <Text style={s.emptyTitle}>No payments yet</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={s.desc}>{item.description}</Text>
                <Text style={s.date}>{fmtDate(item.date)}</Text>
              </View>
              <View style={s.right}>
                <Text style={s.amount}>HK${item.amountHkd.toFixed(2)}</Text>
                {item.invoiceAvailable && (
                  <Pressable onPress={() => downloadInvoice(item.id)} disabled={downloading === item.id} style={s.dlBtn}>
                    {downloading === item.id
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Ionicons name="download-outline" size={16} color={colors.primary} />
                    }
                  </Pressable>
                )}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  title:  { fontSize: 17, fontFamily: fonts.bold, color: colors.text },
  list:   { padding: 16, gap: 10, paddingBottom: 40 },
  card:   {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  desc:   { fontSize: 14, fontFamily: fonts.semibold, color: colors.text },
  date:   { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  right:  { alignItems: 'flex-end', gap: 6 },
  amount: { fontSize: 16, fontFamily: fonts.black, color: colors.primary },
  dlBtn:  { padding: 4 },
  empty:  { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textMuted },
});
