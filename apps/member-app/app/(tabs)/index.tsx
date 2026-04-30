import { useEffect, useRef, useState } from 'react';
import {
  Dimensions, FlatList, Image, Linking,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/auth/context';
import { apiClient } from '../../src/api/client';
import { t } from '../../src/i18n';
import { colors } from '../../src/theme/colors';

const { width: SCREEN_W } = Dimensions.get('window');

interface Banner {
  id: string;
  title: string | null;
  imageUrl: string;
  linkUrl: string | null;
}

function BannerCarousel({ banners }: { banners: Banner[] }) {
  const [current, setCurrent] = useState(0);
  const ref = useRef<FlatList>(null);

  if (banners.length === 0) return null;

  return (
    <View style={s.carouselWrap}>
      <FlatList
        ref={ref}
        data={banners}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={b => b.id}
        onMomentumScrollEnd={e => {
          setCurrent(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W));
        }}
        renderItem={({ item }) => (
          <Pressable
            style={s.bannerSlide}
            onPress={() => item.linkUrl && Linking.openURL(item.linkUrl)}
          >
            <Image source={{ uri: item.imageUrl }} style={s.bannerImage} resizeMode="cover" />
            {item.title && (
              <View style={s.bannerOverlay}>
                <Text style={s.bannerTitle}>{item.title}</Text>
              </View>
            )}
          </Pressable>
        )}
      />
      {banners.length > 1 && (
        <View style={s.dots}>
          {banners.map((_, i) => (
            <View key={i} style={[s.dot, i === current && s.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

export default function HomeScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    apiClient.get<Banner[]>('/banners')
      .then(r => setBanners(r.data))
      .catch(() => {});
  }, []);

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.scroll}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.logo}>GO24</Text>
          <Text style={s.welcome}>
            {user?.email ? `歡迎，${user.email.split('@')[0]}` : '歡迎'}
          </Text>
        </View>

        {/* Promotion banners */}
        <BannerCarousel banners={banners} />

        {/* Quick actions */}
        <View style={s.actions}>
          <Pressable style={s.actionBtn} onPress={() => router.push('/payment/update-card')}>
            <Text style={s.actionIcon}>💳</Text>
            <Text style={s.actionLabel}>更新信用卡</Text>
          </Pressable>
          <Pressable style={s.actionBtn} onPress={() => router.push('/referral')}>
            <Text style={s.actionIcon}>🎁</Text>
            <Text style={s.actionLabel}>介紹朋友</Text>
          </Pressable>
        </View>

        {/* Logout */}
        <Pressable style={s.logoutBtn} onPress={logout}>
          <Text style={s.logoutText}>{t.auth.logout}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:     { flex: 1, backgroundColor: colors.bg },
  scroll:   { padding: 20, gap: 20 },
  header:   { gap: 4 },
  logo:     { fontSize: 36, fontWeight: '900', color: colors.primary, letterSpacing: 4 },
  welcome:  { fontSize: 17, color: colors.text, fontWeight: '600' },

  carouselWrap: { borderRadius: 16, overflow: 'hidden' },
  bannerSlide:  { width: SCREEN_W - 40, height: 160 },
  bannerImage:  { width: '100%', height: '100%' },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end', padding: 14,
  },
  bannerTitle: { color: '#fff', fontWeight: '800', fontSize: 16 },
  dots:        { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 },
  dot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotActive:   { backgroundColor: colors.primary, width: 18 },

  actions: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1, backgroundColor: colors.card, borderRadius: 14,
    paddingVertical: 18, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  actionIcon:  { fontSize: 28 },
  actionLabel: { fontSize: 13, fontWeight: '700', color: colors.text },

  logoutBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  logoutText: { color: colors.textMuted, fontSize: 14 },
});
