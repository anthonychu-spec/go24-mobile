import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { brand } from '../../src/brand';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import { useFeature } from '../../src/config/AppConfigProvider';
import { MemberDataProvider } from '../../src/features/member/MemberData';
import { Icon, type IconName } from '../../src/ui/Icon';
import { T } from '../../src/ui/kit';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

// Every tab route stays declared (Expo Router 58 only shows declared screens);
// the brand layout decides which ones are in the tab bar.
const MEMBER_TABS = ['index', 'book', 'passport', 'profile'];
const CLASSIC_TABS = ['index', 'classes', 'activity', 'pt', 'settings'];

export default function TabLayout() {
  return brand.layout === 'member' ? <MemberTabs /> : <ClassicTabs />;
}

/* ── Member layout (LAB): Home · Book · [pass] · Passport · Profile ── */

const MEMBER_ITEMS: { name: string; label: string; icon: IconName }[] = [
  { name: 'index', label: 'Home', icon: 'home' },
  { name: 'book', label: 'Book', icon: 'book' },
  { name: 'passport', label: 'Passport', icon: 'passport' },
  { name: 'profile', label: 'Profile', icon: 'profile' },
];

type BarProps = { state: { index: number; routes: { name: string; key: string }[] }; navigateToTab: (routeKey: string) => void };

function MemberTabBar({ state, navigateToTab }: BarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const current = state.routes[state.index]?.name;
  const item = (it: (typeof MEMBER_ITEMS)[number]) => {
    const on = current === it.name;
    return (
      <Pressable key={it.name} accessibilityRole="tab" accessibilityLabel={it.label} accessibilityState={{ selected: on }} style={[s.tab, on && s.tabOn]}
        onPress={() => { const r = state.routes.find((x) => x.name === it.name); if (r) navigateToTab(r.key); }}>
        <Icon name={it.icon} size={20} color={on ? colors.text : colors.textMuted} />
        <T v="micro" color={on ? colors.text : colors.textMuted} style={{ textTransform: 'none', letterSpacing: 0.3 }}>{it.label}</T>
        <View style={[s.underline, on && { backgroundColor: colors.cta }]} />
      </Pressable>
    );
  };
  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {item(MEMBER_ITEMS[0])}
      {item(MEMBER_ITEMS[1])}
      <View style={s.passSlot}>
        <Pressable accessibilityRole="button" accessibilityLabel="Open member pass" onPress={() => router.push('/pass')} style={s.pass}>
          <Icon name="qr" size={24} color={colors.onPrimary} />
        </Pressable>
      </View>
      {item(MEMBER_ITEMS[2])}
      {item(MEMBER_ITEMS[3])}
    </View>
  );
}

function MemberTabs() {
  return (
    <MemberDataProvider>
      <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <MemberTabBar {...(props as unknown as BarProps)} />}>
        {[...MEMBER_TABS, 'classes', 'activity', 'pt', 'settings', 'bookings', 'notifications'].map((name) => (
          <Tabs.Screen key={name} name={name} options={MEMBER_TABS.includes(name) ? undefined : { href: null }} />
        ))}
      </Tabs>
    </MemberDataProvider>
  );
}

/* ── Classic layout (GO24 today) ── */

const tabBarStyle = {
  backgroundColor: colors.card,
  borderTopColor: colors.border,
  borderTopWidth: 1,
  height: 62,
  paddingBottom: 10,
  paddingTop: 6,
};

const tabBarLabelStyle = { fontSize: 10, fontFamily: fonts.semibold };

function icon(active: IoniconsName, inactive: IoniconsName) {
  return ({ focused, color }: { focused: boolean; color: ColorValue }) => (
    <Ionicons name={focused ? active : inactive} size={22} color={color as string} />
  );
}

function ClassicTabs() {
  // Brand-disabled tabs stay declared (routable list) but leave the tab bar
  const classesOn = useFeature('classes');
  const ptOn = useFeature('pt');
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarLabelStyle,
        tabBarActiveTintColor: colors.cta,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: icon('home', 'home-outline') }}
      />
      <Tabs.Screen
        name="classes"
        options={{ title: 'Classes', tabBarIcon: icon('calendar', 'calendar-outline'), href: classesOn ? undefined : null }}
      />
      <Tabs.Screen
        name="activity"
        options={{ title: 'Activity', tabBarIcon: icon('pulse', 'pulse-outline') }}
      />
      <Tabs.Screen
        name="pt"
        options={{ title: 'PT', tabBarIcon: icon('barbell', 'barbell-outline'), href: ptOn ? undefined : null }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: icon('settings', 'settings-outline') }}
      />
      {/* Hidden tabs — still routable but not shown in tab bar */}
      <Tabs.Screen name="bookings"      options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      {MEMBER_TABS.filter((n) => !CLASSIC_TABS.includes(n)).map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-start',
    paddingTop: 8, paddingHorizontal: 6, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: colors.border,
  },
  tab: { flex: 1, alignItems: 'center', gap: 5, minHeight: 56, justifyContent: 'center' },
  tabOn: { backgroundColor: colors.primaryBg },
  underline: { width: 22, height: 2, backgroundColor: 'transparent' },
  passSlot: { width: 76, alignItems: 'center' },
  pass: {
    width: 56, height: 56, borderRadius: 28, marginTop: 2, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.cta,
  },
});
