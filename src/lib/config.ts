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

/**
 * Where the public legal pages live. Always the deployed web app, even in a
 * development build: a driver must read the published policy, and a localhost
 * URL would simply fail to open on their phone. Overridable for staging.
 */
export const WEB_URL = readString("WEB_URL", "https://app.isfleet.eu");
export const PRIVACY_URL = WEB_URL + "/privacy";
export const TERMS_URL = WEB_URL + "/terms";

// Boot-time sanity log — confirms which API the app is talking to. Remove
// this once the network setup is stable.
console.log("[config]", { API_URL });
