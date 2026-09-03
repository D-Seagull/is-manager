# is-manager — Expo SDK 57

Manager phone app for IS Fleet. On **Expo SDK 57** (RN 0.86, expo-router 57) —
upgraded from 54 on 2026-09-03 so the iPhone's Expo Go (57-only) can run it.
`is-driver` was upgraded in lockstep; keep the two aligned.

Keep the mobile stack aligned with `../is-driver`: most `lib/`, hooks, and chat
components port over 1:1. Notable SDK-57 rules:
- **Do NOT import from `@react-navigation/native`** — as of SDK 56 expo-router is
  incompatible with it and Metro fails the bundle. Import navigation pieces
  (`ThemeProvider`, `DarkTheme`, `DefaultTheme`, `useIsFocused`, `useNavigation`,
  `useFocusEffect`) from `expo-router`, and drawer types/components
  (`DrawerContentComponentProps`, `DrawerContentScrollView`, `useDrawerStatus`)
  from `expo-router/drawer`. To open a drawer use `navigation.openDrawer()`, not
  `DrawerActions` (any `@react-navigation/*` runtime import trips the check).
- `@react-navigation/community/datetimepicker` pulls `react-native-windows` as a
  peer, which conflicts with RN 0.86 — the repo has a `.npmrc` with
  `legacy-peer-deps=true` so `npm install` resolves. Keep it.
- app.json must NOT set `newArchEnabled` or `android.edgeToEdgeEnabled` (removed
  from the SDK 57 schema; both are the default now).
- Auth is email+password (`/auth/login` with `mobile: true`), not OTP.
