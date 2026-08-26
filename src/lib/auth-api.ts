import { api } from './api';

export type UserStatus =
  | 'ONLINE'
  | 'BUSY'
  | 'AWAY'
  | 'SLEEP'
  | 'VACATION';

export type AppLanguage =
  | 'UK'
  | 'EN'
  | 'PL'
  | 'LT'
  | 'UZ'
  | 'KZ'
  | 'HI'
  | 'RU';

/**
 * UI-language preference (`User.uiLocale`) — which locales/*.json the app
 * renders. Kept separate from `language`, which is the chat auto-translation
 * preference. This is the enum the Settings language picker drives, and it is
 * the only one that includes German.
 */
export type UILocale = 'UK' | 'EN' | 'PL' | 'LT' | 'DE' | 'RU';

export interface AuthUser {
  id: string;
  role: 'DRIVER' | 'MANAGER' | 'TEAMLEAD' | 'ADMIN';
  companyId: string | null;
  firstName: string;
  lastName: string | null;
  email?: string | null;
  phone?: string | null;
  avatar?: string | null;
  language?: AppLanguage;
  uiLocale?: UILocale;
  status?: UserStatus;
  statusUntil?: string | null;
  timezone?: string | null;
}

export interface AuthResult {
  user: AuthUser;
  token: string;
  refreshToken: string;
}

/**
 * Manager sign-in with email + password. Passes `mobile: true` so the backend
 * returns the refresh token in the JSON body (instead of an httpOnly cookie
 * the native app can't hold). Backend responds { access_token, refresh_token,
 * user } — we normalise to { token, refreshToken, user } for symmetry with the
 * auth store / api interceptor.
 */
export async function login(email: string, password: string): Promise<AuthResult> {
  try {
    console.log('[auth-api] login →', { email });
    const { data } = await api.post<{
      access_token: string;
      refresh_token: string;
      user: AuthUser;
    }>('/auth/login', { email, password, mobile: true });
    console.log('[auth-api] login ✓', { userId: data.user?.id, role: data.user?.role });
    return {
      token: data.access_token,
      refreshToken: data.refresh_token,
      user: data.user,
    };
  } catch (err) {
    console.warn('[auth-api] login ✗', err);
    throw err;
  }
}

/**
 * Exchange a refresh token for a fresh access+refresh pair (rotation). The
 * backend revokes the old refresh row and issues a new one, so each refresh
 * token is single-use. No cookie is sent → the response keeps refresh_token in
 * the body.
 */
export async function refreshTokens(refreshToken: string): Promise<AuthResult> {
  const { data } = await api.post<{
    access_token: string;
    refresh_token: string;
    user: AuthUser;
  }>('/auth/refresh', { refreshToken });
  return {
    token: data.access_token,
    refreshToken: data.refresh_token,
    user: data.user,
  };
}

/** Best-effort server-side revocation of the refresh token on logout. */
export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  if (!refreshToken) return;
  try {
    await api.post('/auth/logout', { refreshToken });
  } catch {
    /* logout is best-effort — the local session is cleared regardless */
  }
}

/** Validate an existing token on app launch. */
export async function fetchMe(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>('/auth/me');
  return data;
}

/** Request a password-reset email. Backend always resolves (no user enumeration). */
export async function forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
}

/** Complete a password reset with the emailed token. */
export async function resetPassword(token: string, password: string): Promise<void> {
  await api.post('/auth/reset-password', { token, password });
}

export async function setMyTimezone(timezone: string): Promise<void> {
  await api.patch('/users/me/timezone', { timezone });
}

export interface UpdateMePayload {
  firstName?: string;
  lastName?: string | null;
  phone?: string;
  language?: AppLanguage;
  uiLocale?: UILocale;
  status?: UserStatus;
  /** ISO-8601 timestamp at which BUSY/SLEEP should auto-clear, or null for
   *  indefinite. Omit to leave the timer untouched. */
  statusUntil?: string | null;
}

/**
 * Self-update profile fields — wraps PATCH /users/me. Always re-reads /auth/me
 * afterwards so the caller can drop the fresh user into the auth store without
 * juggling response shapes.
 */
export async function updateMe(payload: UpdateMePayload): Promise<AuthUser> {
  await api.patch('/users/me', payload);
  const { data } = await api.get<AuthUser>('/auth/me');
  return data;
}

/**
 * Upload an avatar from the device. The picker gives us a local file URI; we
 * wrap it in FormData with whatever filename / mime we can detect and POST it
 * to `/users/avatar` (same endpoint the web frontend uses).
 */
export async function uploadAvatar(asset: {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
}): Promise<AuthUser> {
  const form = new FormData();
  // RN/Expo FormData accepts the { uri, name, type } shape — TS doesn't model
  // this on the web FormData type so we cast.
  form.append('file', {
    uri: asset.uri,
    name: asset.fileName || 'avatar.jpg',
    type: asset.mimeType || 'image/jpeg',
  } as unknown as Blob);
  await api.post('/users/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const { data } = await api.get<AuthUser>('/auth/me');
  return data;
}

export async function deleteAvatar(): Promise<AuthUser> {
  await api.delete('/users/avatar');
  const { data } = await api.get<AuthUser>('/auth/me');
  return data;
}
