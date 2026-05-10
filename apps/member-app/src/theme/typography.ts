import { StyleSheet } from 'react-native';
import { fonts } from './fonts';

/**
 * Typography scale — predefined text styles.
 * Import and spread into StyleSheet.create() or use inline.
 *
 * Usage:
 *   <Text style={type.h1}>Heading</Text>
 *   StyleSheet.create({ myText: { ...type.body, color: colors.text } })
 */
export const type = StyleSheet.create({
  // ── Display ────────────────────────────────────────────────────────────────
  /** Hero numbers, big stats — Inter Black */
  display:   { fontSize: 48, fontFamily: fonts.black, lineHeight: 52, letterSpacing: -1 },
  /** Large stat numbers */
  stat:      { fontSize: 34, fontFamily: fonts.black, lineHeight: 38, letterSpacing: -0.5 },
  /** Medium stat (card-level) */
  statSm:    { fontSize: 26, fontFamily: fonts.black, lineHeight: 30 },

  // ── Headings ───────────────────────────────────────────────────────────────
  h1:        { fontSize: 30, fontFamily: fonts.black,   lineHeight: 36 },
  h2:        { fontSize: 24, fontFamily: fonts.black,   lineHeight: 30 },
  h3:        { fontSize: 20, fontFamily: fonts.bold,    lineHeight: 26 },
  h4:        { fontSize: 17, fontFamily: fonts.bold,    lineHeight: 22 },

  // ── Body ───────────────────────────────────────────────────────────────────
  /** Primary body copy */
  body:      { fontSize: 15, fontFamily: fonts.regular, lineHeight: 22 },
  /** Smaller body / list items */
  bodySm:    { fontSize: 13, fontFamily: fonts.regular, lineHeight: 19 },
  /** Emphasized body */
  bodyBold:  { fontSize: 15, fontFamily: fonts.bold,    lineHeight: 22 },

  // ── Label / UI text ────────────────────────────────────────────────────────
  /** Form labels, section headers — SemiBold */
  label:     { fontSize: 13, fontFamily: fonts.semibold, lineHeight: 18 },
  /** Small label */
  labelSm:   { fontSize: 11, fontFamily: fonts.semibold, lineHeight: 14 },
  /** Micro all-caps label */
  overline:  { fontSize: 10, fontFamily: fonts.bold, lineHeight: 12, letterSpacing: 1.5, textTransform: 'uppercase' },
  /** Tab bar, small buttons */
  tab:       { fontSize: 10, fontFamily: fonts.semibold, lineHeight: 12 },

  // ── Button text ────────────────────────────────────────────────────────────
  btnLg:     { fontSize: 16, fontFamily: fonts.bold,    lineHeight: 20, letterSpacing: 0.3 },
  btnMd:     { fontSize: 14, fontFamily: fonts.bold,    lineHeight: 18, letterSpacing: 0.2 },
  btnSm:     { fontSize: 13, fontFamily: fonts.semibold, lineHeight: 16 },

  // ── Caption ────────────────────────────────────────────────────────────────
  caption:   { fontSize: 12, fontFamily: fonts.regular, lineHeight: 16 },
  captionBold:{ fontSize: 12, fontFamily: fonts.semibold, lineHeight: 16 },
});
