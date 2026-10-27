import type { ReactNode } from 'react';
import {
  ActivityIndicator, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View,
  type ImageSourcePropType, type StyleProp, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { brand, brandMark } from '../brand';
import { colors, fonts } from '../theme';
import { Icon, type IconName } from './Icon';

// Building blocks for the member layout (LAB prototype look), driven by brand tokens.
// Text sizes are a step up from the prototype's 7–10px so they stay readable on a phone.

export const PAD = 22;
/** Bottom space so content clears the member tab bar */
export const TAB_BAR_SPACE = 110;
const R = brand.shape;

export const type = StyleSheet.create({
  eyebrow: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 1.8, textTransform: 'uppercase' },
  h1: { fontFamily: fonts.display, fontSize: 40, lineHeight: 42, letterSpacing: 0.4 },
  h2: { fontFamily: fonts.display, fontSize: 27, lineHeight: 30, letterSpacing: 0.5 },
  h3: { fontFamily: fonts.display, fontSize: 24, lineHeight: 26, letterSpacing: 0.3 },
  stat: { fontFamily: fonts.display, fontSize: 34, lineHeight: 36 },
  body: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 21 },
  small: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 16 },
  label: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
  micro: { fontFamily: fonts.semibold, fontSize: 9, letterSpacing: 1.2, textTransform: 'uppercase' },
  button: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.4 },
});
export type TypeName = keyof typeof type;

export function T({ v = 'body', color = colors.text, style, ...rest }: TextProps & { v?: TypeName; color?: string; style?: StyleProp<TextStyle> }) {
  return <Text {...rest} style={[type[v], { color }, style]} />;
}

/** Scrolling tab page: brand bar on top, padding, pull to refresh, room for the tab bar */
export function Page({ children, refreshing, onRefresh, padded = true }: {
  children: ReactNode; refreshing?: boolean; onRefresh?: () => void; padded?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.page, { paddingTop: insets.top }]}>
      <TopBar />
      <ScrollView
        contentContainerStyle={[padded && { paddingHorizontal: PAD }, { paddingTop: 18, paddingBottom: TAB_BAR_SPACE + insets.bottom }]}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} /> : undefined}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function TopBar() {
  return (
    <View style={s.topBar}>
      {brandMark ? <Image source={brandMark} style={s.mark} resizeMode="contain" accessibilityLabel={brand.name} /> : <T v="h3">{brand.wordmark.title}</T>}
      {brand.club ? (
        <View style={s.area}>
          <View style={s.dot} />
          <T v="micro" color={colors.textSecond}>{brand.club.area}</T>
        </View>
      ) : null}
      <View style={s.mark} />
    </View>
  );
}

export function PageHead({ eyebrow, title, right }: { eyebrow?: string; title: string; right?: ReactNode }) {
  return (
    <View style={s.pageHead}>
      <View style={{ flex: 1 }}>
        {eyebrow ? <T v="eyebrow" color={colors.textMuted} style={{ marginBottom: 8 }}>{eyebrow}</T> : null}
        <T v="h1">{title}</T>
      </View>
      {right}
    </View>
  );
}

export function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={s.sectionHead}>
      <T v="h2" style={{ flex: 1 }}>{title}</T>
      {action ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="link">
          <T v="small" color={colors.link}>{action}</T>
        </Pressable>
      ) : null}
    </View>
  );
}

type BtnKind = 'primary' | 'ghost' | 'silver' | 'danger';

export function Btn({ label, onPress, kind = 'primary', icon, full, loading, disabled, style }: {
  label: string; onPress?: () => void; kind?: BtnKind; icon?: IconName; full?: boolean;
  loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const fg = kind === 'silver' ? colors.bg : kind === 'ghost' ? colors.text : kind === 'danger' ? colors.error : colors.onPrimary;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn, s[`btn_${kind}`], full && { alignSelf: 'stretch' },
        { opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }, style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} size="small" /> : (
        <>
          <T v="button" color={fg}>{label}</T>
          {icon ? <Icon name={icon} size={16} color={fg} /> : null}
        </>
      )}
    </Pressable>
  );
}

export function Tag({ children, color = colors.cta, style }: { children: ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  return <T v="micro" color={color} style={style}>{children}</T>;
}

export function Pill({ label, tone = 'ok' }: { label: string; tone?: 'ok' | 'warn' | 'muted' }) {
  const fg = tone === 'ok' ? colors.green : tone === 'warn' ? colors.amber : colors.textMuted;
  const bg = tone === 'ok' ? colors.greenBg : tone === 'warn' ? colors.amberBg : colors.cardSoft;
  return (
    <View style={[s.pill, { backgroundColor: bg }]}>
      <T v="micro" color={fg}>{label}</T>
    </View>
  );
}

export function Card({ children, accent, onPress, style }: { children: ReactNode; accent?: boolean; onPress?: () => void; style?: StyleProp<ViewStyle> }) {
  const body = [s.card, accent && s.cardAccent, style];
  if (!onPress) return <View style={body}>{children}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => [body, pressed && { opacity: 0.85 }]}>{children}</Pressable>;
}

/** Photo with a dark fade at the bottom; children sit on top */
export function PhotoCard({ image, height, children, onPress, style, dim = 0.55 }: {
  image: ImageSourcePropType; height: number; children?: ReactNode; onPress?: () => void;
  style?: StyleProp<ViewStyle>; dim?: number;
}) {
  const inner = (
    <>
      <Image source={image} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient colors={['transparent', `rgba(7,7,7,${dim})`, 'rgba(7,7,7,0.92)']} style={StyleSheet.absoluteFill} />
      {children}
    </>
  );
  const box = [s.photo, { height }, style];
  if (!onPress) return <View style={box}>{inner}</View>;
  return <Pressable onPress={onPress} style={({ pressed }) => [box, pressed && { opacity: 0.9 }]}>{inner}</Pressable>;
}

/** Bottom sheet for details and confirmations */
export function Sheet({ visible, onClose, eyebrow, title, children }: {
  visible: boolean; onClose: () => void; eyebrow?: string; title?: string; children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.sheetRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
        <View style={[s.sheet, { paddingBottom: 24 + insets.bottom }]}>
          <Pressable onPress={onClose} hitSlop={12} style={s.sheetClose} accessibilityRole="button" accessibilityLabel="Close">
            <Icon name="close" size={20} color={colors.textMuted} />
          </Pressable>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {eyebrow ? <T v="eyebrow" color={colors.cta} style={{ marginTop: 4 }}>{eyebrow}</T> : null}
            {title ? <T v="h1" style={{ fontSize: 36, lineHeight: 38, marginTop: 8, marginBottom: 14, paddingRight: 30 }}>{title}</T> : null}
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <View style={s.detailRow}>
      <T v="small" color={colors.textMuted}>{label}</T>
      {typeof value === 'string' ? <T v="label" style={{ flex: 1, textAlign: 'right' }}>{value}</T> : value}
    </View>
  );
}

/** Underlined tabs (Book categories, Passport sections) */
export function Segmented<K extends string>({ items, value, onChange, spread = true }: {
  items: { key: K; label: string }[]; value: K; onChange: (k: K) => void; spread?: boolean;
}) {
  return (
    <View style={[s.segRow, !spread && { gap: 22 }]}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={[s.seg, spread && { flex: 1, alignItems: 'center' }, on && { borderBottomColor: colors.cta }]}>
            <T v="label" color={on ? colors.text : colors.textMuted}>{it.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, on, onPress }: { label: string; on?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!on }} style={[s.chip, on && s.chipOn]}>
      <T v="small" color={on ? colors.onPrimary : colors.textMuted}>{label}</T>
    </Pressable>
  );
}

/** Horizontal scroller that bleeds to the screen edges */
export function HScroll({ children, gap = 8 }: { children: ReactNode; gap?: number }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -PAD }}
      contentContainerStyle={{ paddingHorizontal: PAD, gap }}>
      {children}
    </ScrollView>
  );
}

export function Meter({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View style={s.meter} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max, now: Math.min(value, max) }}>
      <View style={[s.meterFill, { width: `${pct * 100}%` }]} />
    </View>
  );
}

export function Empty({ icon = 'info', title, body, action, onAction }: {
  icon?: IconName; title: string; body?: string; action?: string; onAction?: () => void;
}) {
  return (
    <View style={s.empty}>
      <Icon name={icon} size={32} color={colors.cta} />
      <T v="h2" style={{ textAlign: 'center', marginTop: 16, marginBottom: 10 }}>{title}</T>
      {body ? <T v="small" color={colors.textMuted} style={{ textAlign: 'center', marginBottom: 20 }}>{body}</T> : null}
      {action ? <Btn label={action} onPress={onAction} kind="ghost" /> : null}
    </View>
  );
}

export function Row({ icon, label, detail, onPress, tone }: {
  icon: IconName; label: string; detail?: string; onPress?: () => void; tone?: 'danger';
}) {
  const fg = tone === 'danger' ? colors.error : colors.text;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}>
      <Icon name={icon} size={18} color={tone === 'danger' ? colors.error : colors.textMuted} />
      <T v="label" color={fg} style={{ flex: 1 }}>{label}</T>
      {detail ? <T v="small" color={colors.textMuted}>{detail}</T> : null}
      <Icon name="chev" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

export function Message({ text, tone = 'error' }: { text: string; tone?: 'error' | 'info' | 'ok' }) {
  const fg = tone === 'error' ? colors.error : tone === 'ok' ? colors.green : colors.textSecond;
  return (
    <View style={[s.message, { borderLeftColor: fg }]} accessibilityRole="alert">
      <T v="small" color={fg}>{text}</T>
    </View>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center', gap: 12 }}>
      <ActivityIndicator color={colors.textMuted} />
      {label ? <T v="small" color={colors.textMuted}>{label}</T> : null}
    </View>
  );
}

/** Small-print note under a section (policy, data caveats) */
export function Note({ children }: { children: ReactNode }) {
  return <T v="small" color={colors.textMuted} style={s.note}>{children}</T>;
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: PAD, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  mark: { width: 34, height: 40 },
  area: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.cta },
  pageHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 24, marginBottom: 13 },
  btn: {
    minHeight: 46, paddingHorizontal: 18, paddingVertical: 12, borderRadius: R.button,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  btn_primary: { backgroundColor: colors.primary },
  btn_ghost: { borderWidth: 1, borderColor: colors.border, backgroundColor: 'transparent' },
  btn_silver: { backgroundColor: colors.textSecond },
  btn_danger: { borderWidth: 1, borderColor: colors.error, backgroundColor: 'transparent' },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 4, marginTop: 8, borderRadius: R.button ? 4 : 0 },
  card: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: 16, borderRadius: R.card },
  cardAccent: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  photo: { overflow: 'hidden', backgroundColor: colors.cardSoft, borderRadius: R.card },
  sheetRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    maxHeight: '90%', backgroundColor: colors.card, paddingHorizontal: PAD, paddingTop: 18,
    borderTopLeftRadius: 19, borderTopRightRadius: 19, borderTopWidth: 1, borderColor: colors.border,
  },
  sheetClose: { position: 'absolute', right: 14, top: 14, zIndex: 2, padding: 6 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 16,
    paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  segRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: 16 },
  seg: { paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  chip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 13, borderWidth: 1, borderColor: colors.border, borderRadius: R.button },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  meter: { height: 5, backgroundColor: colors.border, overflow: 'hidden' },
  meterFill: { height: '100%', backgroundColor: colors.cta },
  empty: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: colors.border },
  message: { borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 6, marginVertical: 10 },
  note: { marginTop: 18, lineHeight: 18 },
});
