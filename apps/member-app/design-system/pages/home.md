# Home Screen Overrides
> Deviations from MASTER.md for the Home tab (index.tsx)

## Layout
- No `<ScreenHeader>` — uses custom sticky header with avatar + greeting + bell
- `<ScreenWrapper barStyle="dark-content">` wraps the screen
- Custom header sits above `<ScrollView>`; not part of scroll content

## Header
- Left: `<Avatar size="md">` (tappable → Settings)
- Centre: greeting label (`type.caption`) + name (`type.bodyBold` fontSize 17)
- Right: notification bell 42×42pt with `colors.cta` badge dot

## Membership Card (MemberCard)
- Custom `<LinearGradient>` card — NOT `<Card>` component (needs gradient)
- Gradient: `colors.primaryMid` → `colors.primaryDark`
- Height 200, borderRadius `radius.xl + 4`, large shadow
- Progress bar at bottom: white 15% track, white 55% fill

## Stat Row
- Label: `type.overline` in `colors.textMuted`
- Numbers: 26px `fonts.black` in semantic accent color
- Card: `colors.card` + `shadows.card`, `borderRadius: radius.xl`

## Smart Hub
- Section title: `type.h3` inline (not `<SectionHeader>`)
- Urgent cards: `borderWidth 1.5`, `colors.primary + '30'` border
- Cycling cards: fade animation 250ms out / 350ms in, 4s interval
- Nav dots: 4×4 inactive, 4×10 active (primary color)
- Streak icon: `flame` Ionicon in `colors.cta` (NOT emoji)

## Alerts
- Outstanding balance: `colors.primaryBg` + `colors.primary` border
- Expiry warning: amber/red bg depending on days remaining

## Streak Banner
- Ionicons `flame` size 18 `colors.cta`
- Background: `colors.ctaBg`, border `colors.cta + '40'`

## Promotions / Banners
- FlatList horizontal, pagingEnabled, 170px height
- Empty state: dashed border, no `<EmptyState>` component (inline)

## Action Grid
- 2-column wrap grid, cell width `(W - 32 - 10) / 2`
- Each cell: `<Card>`-equivalent with `shadows.card`, `borderRadius: radius.xl`
- Icon box: 50×50, `borderRadius: radius.md + 1`
