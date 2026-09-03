import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavThemeProvider,
} from 'expo-router';
import { focusManager, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, AppStateStatus, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeProvider } from '@/hooks/use-theme';
import { queryClient } from '@/lib/query';

// Tell React Query when the app returns to foreground from background.
// We track the PREVIOUS state so we only trigger on a real background→active
// transition, not on every 'active' event iOS fires (keyboard, notifications…).
function useAppStateRefetch() {
  useEffect(() => {
    let prevState = AppState.currentState;
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (
        (prevState === 'background' || prevState === 'inactive') &&
        next === 'active'
      ) {
        focusManager.setFocused(true);
      }
      prevState = next;
    });
    return () => sub.remove();
  }, []);
}

// The app UI language follows the device locale by default and is overridden
// only by an explicit pick in Settings (persisted locally via lib/i18n). The
// server `uiLocale` is written on pick for web/cross-device parity but is not
// auto-applied here — otherwise its UK default would override the phone locale.

export const unstable_settings = {
  anchor: '(manager)',
};

export default function RootLayout() {
  useAppStateRefetch();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <NavTheme>
                <Stack>
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                  <Stack.Screen name="(manager)" options={{ headerShown: false }} />
                </Stack>
                <NavBarBlur />
                <StatusBar style="auto" />
              </NavTheme>
            </ThemeProvider>
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function NavTheme({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  return (
    <NavThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      {children}
    </NavThemeProvider>
  );
}

// Android draws edge-to-edge (app.json `edgeToEdgeEnabled`), so screen content
// scrolls under the system navigation bar. Lay a translucent themed scrim over
// just that strip so the bar reads as frosted glass and content no longer hard-
// overlaps it. We deliberately avoid a native blur (expo-blur): real blur is
// unsupported on several OEM builds — notably MIUI/Xiaomi, where it degrades to
// a solid white fill — whereas a translucent scrim looks identical everywhere.
// iOS is left untouched (its home-indicator area is handled per-screen).
function NavBarBlur() {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  if (Platform.OS !== 'android' || insets.bottom <= 0) return null;
  const bg = scheme === 'dark' ? 'rgba(10,10,12,0.72)' : 'rgba(228,229,233,0.8)';
  return (
    <View
      pointerEvents="none"
      style={[styles.navBarBlur, { height: insets.bottom, backgroundColor: bg }]}
    />
  );
}

const styles = StyleSheet.create({
  navBarBlur: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
