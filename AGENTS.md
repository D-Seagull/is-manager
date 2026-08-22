# is-manager — Expo SDK 54

Manager phone app for IS Fleet. Pinned to **Expo SDK 54** (RN 0.81, expo-router 6)
to match `is-driver` and stay compatible with Expo Go — the project was created on
SDK 57 but downgraded because no Expo Go build supports SDK 57 yet.

Keep the mobile stack aligned with `../is-driver`: most `lib/`, hooks, and chat
components port over 1:1. Notable SDK-54 rules:
- Import navigation theme pieces from `@react-navigation/native` (expo-router 6
  does NOT re-export `ThemeProvider`/`DarkTheme`/`DefaultTheme`).
- Auth is email+password (`/auth/login` with `mobile: true`), not OTP.
