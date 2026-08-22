import Constants from "expo-constants";

/**
 * Pulls API base URL from Expo config.
 * Set in app.json → expo.extra, or via EXPO_PUBLIC_* env vars.
 *   - EXPO_PUBLIC_API_URL
 *
 * Defaults are dev-friendly so the app boots without any env tweaks.
 */
const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

function readString(key: string, fallback: string): string {
  const env = process.env[`EXPO_PUBLIC_${key}`];
  if (typeof env === "string" && env.length > 0) return env;
  const fromExtra = extra[key];
  if (typeof fromExtra === "string" && fromExtra.length > 0) return fromExtra;
  return fallback;
}

export const API_URL = readString("API_URL", "http://localhost:3001");

// Boot-time sanity log — confirms which API the app is talking to. Remove
// this once the network setup is stable.
console.log("[config]", { API_URL });
