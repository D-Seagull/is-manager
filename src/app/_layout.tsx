import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavThemeProvider,
} from '@react-navigation/native';
import { focusManager, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
