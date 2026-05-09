import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

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
  return ({ focused, color }: { focused: boolean; color: string }) => (
    <Ionicons name={focused ? active : inactive} size={22} color={color} />
  );
}

export default function TabLayout() {
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
        options={{ title: 'Classes', tabBarIcon: icon('calendar', 'calendar-outline') }}
      />
      <Tabs.Screen
        name="activity"
        options={{ title: 'Activity', tabBarIcon: icon('pulse', 'pulse-outline') }}
      />
      <Tabs.Screen
        name="pt"
        options={{ title: 'PT', tabBarIcon: icon('barbell', 'barbell-outline') }}
      />
      {/* Hidden tabs — still routable but not shown in tab bar */}
      <Tabs.Screen name="bookings"      options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}
