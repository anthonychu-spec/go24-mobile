import { StyleSheet, View } from 'react-native';
import { brand } from '../../../brand';
import { colors } from '../../../theme';
import { Icon, type IconName } from '../../../ui/Icon';
import { T, Tag } from '../../../ui/kit';

/** Icon box + title + right label (milestones, completed classes) */
export function ProgressRow({ icon, done, tag, title, body, right }: {
  icon: IconName; done?: boolean; tag?: string; title: string; body?: string; right?: string;
}) {
  return (
    <View style={s.row} accessible accessibilityLabel={[tag, title, body, right].filter(Boolean).join(', ')}>
      <View style={s.box}>
        <Icon name={icon} size={18} color={done ? colors.cta : colors.textMuted} />
      </View>
      <View style={{ flex: 1 }}>
        {tag ? <Tag>{tag}</Tag> : null}
        <T v="h3" style={s.title}>{title}</T>
        {body ? <T v="small" color={colors.textMuted}>{body}</T> : null}
      </View>
      {right ? <T v="micro" color={colors.textMuted}>{right}</T> : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 17, borderTopWidth: 1, borderTopColor: colors.border },
  box: {
    width: 41, height: 41, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, borderRadius: brand.shape.button,
  },
  title: { fontSize: 22, lineHeight: 24, marginVertical: 2 },
});
