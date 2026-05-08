import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_CONFIG: Record<string, { label: string; active: IoniconsName; inactive: IoniconsName }> = {
  index:         { label: 'Home',          active: 'home',          inactive: 'home-outline' },
  classes:       { label: 'Classes',       active: 'calendar',      inactive: 'calendar-outline' },
  bookings:      { label: 'Bookings',      active: 'bookmark',      inactive: 'bookmark-outline' },
  activity:      { label: 'Activity',      active: 'pulse',         inactive: 'pulse-outline' },
  pt:            { label: 'PT',            active: 'barbell',       inactive: 'barbell-outline' },
  notifications: { label: 'Notifications', active: 'notifications', inactive: 'notifications-outline' },
};

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => {
        const cfg = TAB_CONFIG[route.name] ?? { label: route.name, active: 'ellipse', inactive: 'ellipse-outline' };
        return {
          headerShown: false,
          tabBarLabel: cfg.label,
          tabBarStyle: {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 62,
            paddingBottom: 10,
            paddingTop: 6,
          },
          tabBarActiveTintColor: colors.cta,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarLabelStyle: { fontSize: 10, fontFamily: fonts.semibold },
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? cfg.active : cfg.inactive} size={22} color={color} />
          ),
        };
      }}
    />
  );
}
