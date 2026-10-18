import { router, useFocusEffect, useNavigation, type Href } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler } from 'react-native';

/**
 * Strict "up" navigation: back always goes ONE level up the hierarchy
 * (chat → Chat list → Menu), never one step along the history.
 *
 * `router.navigate` to a screen already below us PUSHES a fresh copy in
 * expo-router ≥ v4, so the old "navigate back to the Chat list" stacked
 * Menu → Chat → DM → Chat; the list's back then popped to the DM again and
 * you could never leave. `dismissTo` pops down to the parent when it is in
 * the stack and replaces the current screen with it when it isn't (chat
 * opened from a push / the bell / another section).
 *
 * Returns the handler for the header chevron; Android's back button and back
 * gesture are routed to it too — only while this screen is focused, so a
 * screen kept mounted under another one never steals the press. With no
 * `parent` it does nothing (lets a shared header opt in).
 */
export function useBackToParent(parent: Href | (() => void) | undefined) {
  const goBack = useCallback(() => {
    if (typeof parent === 'function') parent();
    else if (parent) router.dismissTo(parent);
  }, [parent]);

  useFocusEffect(
    useCallback(() => {
      if (!parent) return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goBack();
        return true;
      });
      return () => sub.remove();
    }, [parent, goBack]),
  );

  return goBack;
}

// Detail screens that can be opened on top of any section (and of each
// other — a push banner opens a truck over a truck, the bell a DM over a
// truck). They are never someone's parent.
const DETAIL_ROUTES = new Set(['truck/[truckId]', 'dm/[userId]', 'group/[groupId]', 'person/[id]']);

/**
 * "Up" for a detail screen without one fixed parent (the truck panel opens
 * from My Trucks, Fleet, Trips, a person card): pop to the section list it
 * was opened from, skipping any detail screens stacked in between, and fall
 * back to `fallback` when it was opened straight over the Menu or cold.
 */
export function useBackToSection(fallback: Href) {
  const navigation = useNavigation();
  const up = useCallback(() => {
    const state = navigation.getState();
    if (state) {
      for (let i = state.index - 1; i >= 0; i--) {
        const name = state.routes[i].name;
        if (DETAIL_ROUTES.has(name)) continue;
        if (name !== 'index') {
          router.dismiss(state.index - i);
          return;
        }
        break;
      }
    }
    router.dismissTo(fallback);
  }, [navigation, fallback]);
  return useBackToParent(up);
}
