import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { AppLanguage, UserStatus } from '@/lib/auth-api';

export interface PersonMini {
  id: string;
  firstName: string;
  lastName: string | null;
  avatar: string | null;
}

export interface PersonDetail {
  id: string;
  firstName: string;
  lastName: string | null;
  role: string;
  email: string | null;
  phone: string | null;
  avatar: string | null;
  language?: AppLanguage;
  status?: UserStatus | null;
  statusUntil?: string | null;
  isActive: boolean;
  // managerId — актуальний менеджер водія (менеджер його вантажівки).
  currentTruck?: { id: string; plate: string; status: string; managerId?: string | null } | null;
  // Менеджерські поля (бекенд повертає їх для MANAGER/TEAMLEAD/ADMIN на /users/:id).
  teamlead?: PersonMini | null;
  assignedTrucks?: {
    id: string;
    plate: string;
    status: string;
    currentDriver: PersonMini | null;
  }[];
}

export function useUserDetail(id: string | null | undefined) {
  return useQuery<PersonDetail>({
    queryKey: ['user', id],
    queryFn: async () => {
      const res = await api.get(`/users/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export interface UserRating {
  id: string;
  score: number;
  comment: string | null;
  anonymous: boolean;
  createdAt: string;
  ratedBy: {
    id: string;
    firstName: string;
    lastName: string | null;
    avatar: string | null;
    role: string;
  } | null;
}

export interface RatingsResponse {
  ratings: UserRating[];
  averageRating: number | null;
  ratingCount: number;
}

/** Оцінки користувача. kind='driver' → /ratings (водій), 'manager' → /manager-ratings. */
export function useUserRatings(id: string | null | undefined, kind: 'driver' | 'manager') {
  const path = kind === 'driver' ? 'ratings' : 'manager-ratings';
  return useQuery<RatingsResponse>({
    queryKey: ['user-ratings', kind, id],
    queryFn: async () => {
      const res = await api.get(`/users/${id}/${path}`);
      return res.data;
    },
    enabled: !!id,
  });
}

/** Менеджер оцінює водія (POST /users/:id/ratings). Оцінювати менеджерів можуть лише водії. */
export function useRateDriver(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { score: number; comment?: string; anonymous?: boolean }) => {
      const res = await api.post(`/users/${id}/ratings`, data);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['user-ratings', 'driver', id] });
      qc.invalidateQueries({ queryKey: ['user', id] });
    },
  });
}

export function useCreateDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      firstName: string;
      lastName?: string | null;
      phone: string;
    }) => {
      const res = await api.post('/users/driver', data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-users'] }),
  });
}

export function useCreateManager() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { email: string; phone: string; firstName?: string; lastName?: string | null }) => {
      const res = await api.post('/users/manager', data);
      return res.data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-users'] }),
  });
}

export function useSetUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await api.patch(`/users/${id}/${active ? 'activate' : 'deactivate'}`);
      return res.data;
    },
    onSuccess: (_d, { id }) => {
      qc.invalidateQueries({ queryKey: ['company-users'] });
      qc.invalidateQueries({ queryKey: ['user', id] });
    },
  });
}

/**
 * Код входу для водія, якому не приходить SMS: закріплений менеджер створює
 * одноразовий код і диктує його. Бекенд відмовляє всім іншим.
 */
export function useIssueDriverLoginCode() {
  return useMutation({
    mutationFn: async (driverId: string) => {
      const res = await api.post<{ code: string; expiresAt: string }>(
        `/auth/driver/${driverId}/login-code`,
      );
      return res.data;
    },
  });
}

/** Серверні перемикачі (код входу від менеджера — лише на dev). */
export function useAuthFeatures() {
  return useQuery<{ managerLoginCode: boolean }>({
    queryKey: ['auth-features'],
    queryFn: async () => (await api.get('/auth/features')).data,
    staleTime: Infinity,
  });
}

/**
 * Чи просить водій зараз ЦЬОГО менеджера про код входу («Попросити код у
 * менеджера» в застосунку водія)? Кнопка «Код входу» видна лише тоді.
 * Опитується, поки картка відкрита (як на вебі).
 */
export function useLoginCodeRequest(driverId: string | undefined, enabled: boolean) {
  return useQuery<{ pending: boolean; expiresAt?: string }>({
    queryKey: ['login-code-request', driverId],
    queryFn: async () => (await api.get(`/auth/driver/${driverId}/login-code-request`)).data,
    enabled: enabled && !!driverId,
    refetchInterval: 10_000,
  });
}

export interface Company {
  id: string;
  name: string;
  accountingEmail: string | null;
  hrEmail: string | null;
  directorEmail: string | null;
}

export function useCompany() {
  return useQuery<Company>({
    queryKey: ['company'],
    queryFn: async () => {
      const res = await api.get('/companies');
      return res.data;
    },
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Pick<Company, 'name' | 'accountingEmail' | 'hrEmail' | 'directorEmail'>>) => {
      const res = await api.patch('/companies', payload);
      return res.data as Company;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company'] }),
  });
}
