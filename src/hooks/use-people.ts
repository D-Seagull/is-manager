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
  currentTruck?: { id: string; plate: string; status: string } | null;
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
    mutationFn: async (data: { firstName: string; lastName?: string | null; phone: string }) => {
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
