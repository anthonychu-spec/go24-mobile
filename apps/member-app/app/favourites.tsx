import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiClient } from '../src/api/client';
import { colors } from '../src/theme/colors';
import { fonts } from '../src/theme/fonts';

interface Favourite {
  id: string; classTemplateId: string; className: string; instructorName: string | null;
}

export default function FavouritesScreen() {
  const router = useRouter();
  const [favs, setFavs]       = useState<Favourite[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<Favourite[]>('/me/favourites');
      setFavs(data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: string) => {
    await apiClient.delete(`/me/favourites/${id}`).catch(() => {});
    setFavs(f => f.filter(x => x.id !== id));
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={s.title}>Favourite Classes</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={favs}
          keyExtractor={f => f.id}
          contentContainerStyle={s.list}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="star-outline" size={48} color={colors.border} />
              <Text style={s.emptyTitle}>No favourites yet</Text>
              <Text style={s.emptySub}>Star a class from the schedule to save it here</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={s.icon}>
                <Ionicons name="fitness-outline" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.className}>{item.className}</Text>
                {item.instructorName && <Text style={s.instructor}>{item.instructorName}</Text>}
              </View>
              <Pressable onPress={() => remove(item.id)} hitSlop={8}>
                <Ionicons name="star" size={22} color={colors.amber} />
              </Pressable>
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
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  icon:       { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryBg, alignItems: 'center', justifyContent: 'center' },
  className:  { fontSize: 15, fontFamily: fonts.semibold, color: colors.text },
  instructor: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  empty:      { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: fonts.bold, color: colors.textMuted },
  emptySub:   { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingHorizontal: 32 },
});
