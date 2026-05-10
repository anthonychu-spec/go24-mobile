# Settings Screen Overrides
> Deviations from MASTER.md for the Settings tab

## Layout
- No `<ScreenHeader>` — this is a tab screen, uses custom profile hero
- Profile avatar: `<Avatar size="xl" />` at top, centered
- Content width: full screen edge-to-edge for list rows

## Cards
- Account details card: `<Card rounded="lg">` wrapping `<ListRow>` items
- Links card: `<Card rounded="xl">` with `<ListRow>` items, no internal padding
- Balance card: Red bg (`colors.primary`) — custom, NOT `<Card>` component

## Semantic Colors for Links
| Link | iconColor | iconBg |
|------|-----------|--------|
| My Memberships | primary | primaryBg |
| Payment History | amber | amberBg |
| Favourite Classes | rose | roseBg |
| Update Payment Card | green | greenBg |
| Notifications | indigo | indigoBg |

## Logout
- Centered, `type.label` sized
- `colors.error` text + icon
- Spatially separated (padding top) from links list — per P9 `destructive-nav-separation`
