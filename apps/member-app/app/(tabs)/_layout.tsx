import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import { useFeature } from '../../src/config/AppConfigProvider';

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
  return ({ focused, color }: { focused: boolean; color: ColorValue }) => (
    <Ionicons name={focused ? active : inactive} size={22} color={color as string} />
  );
}

export default function TabLayout() {
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
    </Tabs>
  );
}
