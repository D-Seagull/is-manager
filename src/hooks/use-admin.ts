import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import type { UserStatus } from '@/lib/auth-api';
import { useAuthStore } from '@/store/auth';

export type Role = 'ADMIN' | 'TEAMLEAD' | 'MANAGER' | 'DRIVER';

// ─── Dashboard stats (GET /admin/stats) ─────────────────────────────────────

export interface AdminStats {
  companies: { total: number; active: number; deactivated: number };
  users: {
    total: number;
    byRole: { ADMIN: number; TEAMLEAD: number; MANAGER: number; DRIVER: number };
  };
  onlineNow: { drivers: number; managers: number };
  activeTrips: number;
  recentCompanies: {
    id: string;
    name: string;
    createdAt: string;
    isActive: boolean;
    usersCount: number;
    awaitingInvite: boolean;
  }[];
}

export function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: async () => (await api.get('/admin/stats')).data,
    refetchInterval: 30_000,
  });
}

// ─── Companies list (GET /admin/companies) ──────────────────────────────────

export interface Company {
  id: string;
  name: string;
  email?: string;
  createdAt: string;
  isActive?: boolean;
  _count?: { users: number };
}

export function useCompanies() {
  return useQuery<Company[]>({
    queryKey: ['companies'],
    queryFn: async () => (await api.get('/admin/companies')).data,
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; email: string }) =>
      (await api.post('/admin/companies', payload)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['companies'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

// ─── Company detail (GET /admin/companies/:id) ──────────────────────────────

export interface AdminCompanyUser {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  role: Role;
  status: UserStatus;
  statusUntil: string | null;
  avatar: string | null;
  createdAt: string;
}

export interface AdminCompanyDetail {
  id: string;
  name: string;
  createdAt: string;
  isActive: boolean;
  logo: string | null;
  accountingEmail: string | null;
  hrEmail: string | null;
  directorEmail: string | null;
  inviteToken: string | null;
  inviteExpiry: string | null;
  counts: {
    usersTotal: number;
    usersByRole: { ADMIN: number; TEAMLEAD: number; MANAGER: number; DRIVER: number };
    onlineNow: { drivers: number; managers: number };
    trucks: { total: number; active: number };
    trips: { active: number; thisMonth: number };
    pushCoverage: { withToken: number; outOf: number };
  };
  users: AdminCompanyUser[];
}

export function useAdminCompany(id: string | undefined) {
  return useQuery<AdminCompanyDetail>({
    queryKey: ['admin', 'company', id],
    queryFn: async () => (await api.get(`/admin/companies/${id}`)).data,
    enabled: !!id,
    refetchInterval: 30_000,
  });
}

export function useDeactivateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.patch(`/admin/companies/${id}/deactivate`)).data,
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['admin', 'company', id] });
      qc.invalidateQueries({ queryKey: ['companies'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

export function useReactivateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.patch(`/admin/companies/${id}/activate`)).data,
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['admin', 'company', id] });
      qc.invalidateQueries({ queryKey: ['companies'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}

export function useResendCompanyInvite() {
  return useMutation({
    mutationFn: async ({ id, email }: { id: string; email: string }) =>
      (await api.post(`/admin/companies/${id}/resend-invite`, { email })).data,
  });
}

// ─── Online now (GET /admin/online-users) ───────────────────────────────────

export interface OnlineUser {
  id: string;
  firstName: string;
  lastName: string | null;
  role: string;
  avatar: string | null;
  status: UserStatus;
  company: { id: string; name: string } | null;
}

export const ONLINE_USERS_KEY = ['admin', 'online-users'] as const;

/** Users with a live socket right now (cross-company). Admin dashboard. */
export function useOnlineUsers(enabled = true) {
  return useQuery<OnlineUser[]>({
    queryKey: ONLINE_USERS_KEY,
    queryFn: async () => (await api.get('/admin/online-users')).data,
    enabled,
    refetchInterval: enabled ? 30_000 : false,
  });
}

/**
 * Refetch the online list on every cross-company presence change
 * (`adminPresenceChanged`, emitted to the `admins` room). Mount once in the
 * manager layout so the dashboard list stays live. Admin-only.
 */
export function useOnlineUsersSocketSync() {
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.user?.role);
  useEffect(() => {
    if (!token || role !== 'ADMIN') return;
    const socket = getSocket();
    const onChange = () => {
      void qc.invalidateQueries({ queryKey: ONLINE_USERS_KEY });
      // Keep the dashboard's "Online" KPI (from /admin/stats) live too.
      void qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    };
    socket.on('adminPresenceChanged', onChange);
    return () => {
      socket.off('adminPresenceChanged', onChange);
    };
  }, [qc, token, role]);
}

// ─── Bug reports (GET /bug-reports — ADMIN only) ────────────────────────────

export type BugStatus = 'NEW' | 'TRIAGED' | 'RESOLVED';

export interface BugReportReporter {
  id: string;
  firstName: string;
  lastName: string | null;
  role: string;
  avatar: string | null;
}

export interface BugReport {
  id: string;
  reporterId: string;
  companyId: string | null;
  role: string;
  description: string;
  screenshots: string[];
  appName: string | null;
  appVersion: string | null;
  platform: string | null;
  route: string | null;
  socketState: string | null;
  status: BugStatus;
  createdAt: string;
  resolvedAt: string | null;
  reporter: BugReportReporter;
  company: { id: string; name: string } | null;
}

export const BUG_REPORTS_KEY = ['bug-reports'] as const;

/**
 * All reports, or just those in one status. `enabled` gates the request — the
 * endpoint is ADMIN-only, so pass `false` for non-admins to avoid a 403 (e.g.
 * the menu badge on a manager account).
 */
export function useBugReports(status?: BugStatus, enabled = true) {
  return useQuery<BugReport[]>({
    queryKey: [...BUG_REPORTS_KEY, status ?? 'all'],
    queryFn: async () => {
      const res = await api.get('/bug-reports', {
        params: status ? { status } : undefined,
      });
      return res.data;
    },
    enabled,
    staleTime: 30_000,
    refetchInterval: enabled ? 30_000 : false,
  });
}

/** Count of NEW reports — drives the menu badge. Admin-only; pass `false` else. */
export function useNewBugCount(enabled = true): number {
  const { data } = useBugReports('NEW', enabled);
  return data?.length ?? 0;
}

export function useUpdateBugStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BugStatus }) => {
      const res = await api.patch(`/bug-reports/${id}/status`, { status });
      return res.data as BugReport;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: BUG_REPORTS_KEY });
    },
  });
}

/**
 * Global socket sync — refetch reports whenever a new one lands so the triage
 * feed and the menu NEW badge update in real time. Depends on the token so we
 * re-attach after login/refresh drops the socket. Mount once (in the manager
 * layout) so it stays live everywhere.
 */
export function useBugReportsSocketSync() {
  const qc = useQueryClient();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.user?.role);
  useEffect(() => {
    if (!token || role !== 'ADMIN') return;
    const socket = getSocket();
    const onNew = () => {
      void qc.invalidateQueries({ queryKey: BUG_REPORTS_KEY });
    };
    socket.on('bug_report:new', onNew);
    return () => {
      socket.off('bug_report:new', onNew);
    };
  }, [qc, token, role]);
}
