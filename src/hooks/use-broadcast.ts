import { useMutation } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { api } from '@/lib/api';

/**
 * Broadcast a single message to the drivers of all the current manager's
 * trucks. Mirrors the web `useBroadcastToMyTrucks` — POST /trips/broadcast.
 */
export function useBroadcastToMyTrucks() {
  return useMutation({
    mutationFn: async (content: string) => {
      const res = await api.post('/trips/broadcast', { content });
      return res.data as { sent: number };
    },
  });
}

export interface BroadcastTemplate {
  id: string;
  title: string;
  content: string;
}

/**
 * Reusable broadcast templates, stored server-side as announcement drafts
 * (`isTemplate=true`). Same endpoints the web uses.
 */
export function useBroadcastTemplates() {
  const [templates, setTemplates] = useState<BroadcastTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/announcements/drafts?isTemplate=true');
      setTemplates(res.data);
    } catch {
      /* non-fatal — templates are optional */
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(
    async (title: string, content: string) => {
      await api.post('/announcements/drafts', { title, content, isTemplate: true });
      await load();
    },
    [load],
  );

  const remove = useCallback(async (id: string) => {
    await api.delete(`/announcements/drafts/${id}`);
    setTemplates((prev) => prev.filter((tmpl) => tmpl.id !== id));
  }, []);

  return { templates, loading, load, save, remove };
}
