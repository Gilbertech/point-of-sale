// lib/hooks/use-notifications.ts
// Real-time notifications via Supabase Realtime broadcast channel.
// Workers see toasts + a bell counter when admins create announcements,
// shifts, leave decisions, or general alerts.

import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

export type NotifType =
  | 'announcement'
  | 'shift'
  | 'leave_approved'
  | 'leave_rejected'
  | 'query_reply'
  | 'general';

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
  /** Optional: only show to a specific worker (by workerId). Omit = broadcast to all. */
  targetWorkerId?: string;
}

const CHANNEL_NAME = 'app-notifications';
const STORAGE_KEY = 'app_notifications_v1';

function loadStored(): AppNotification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as any[];
    return parsed.map(n => ({ ...n, createdAt: new Date(n.createdAt) }));
  } catch {
    return [];
  }
}

function saveStored(notifications: AppNotification[]) {
  try {
    // Keep latest 50
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 50)));
  } catch {}
}

export function useNotifications(currentUserId?: string, currentWorkerRole?: string) {
  const [notifications, setNotifications] = useState<AppNotification[]>(() => loadStored());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const addNotification = useCallback((notif: Omit<AppNotification, 'read' | 'createdAt'>) => {
    const full: AppNotification = {
      ...notif,
      read: false,
      createdAt: new Date(),
    };
    setNotifications(prev => {
      const next = [full, ...prev].slice(0, 50);
      saveStored(next);
      return next;
    });
  }, []);

  useEffect(() => {
    // Subscribe to broadcast channel
    const channel = supabase
      .channel(CHANNEL_NAME)
      .on('broadcast', { event: 'notification' }, ({ payload }) => {
        const notif = payload as AppNotification;

        // If targeted, only show to the right worker
        if (notif.targetWorkerId && notif.targetWorkerId !== currentUserId) return;

        addNotification({
          id: notif.id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          targetWorkerId: notif.targetWorkerId,
        });
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId, addNotification]);

  const markAllRead = useCallback(() => {
    setNotifications(prev => {
      const next = prev.map(n => ({ ...n, read: true }));
      saveStored(next);
      return next;
    });
  }, []);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => {
      const next = prev.map(n => n.id === id ? { ...n, read: true } : n);
      saveStored(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    saveStored([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, unreadCount, markRead, markAllRead, clearAll };
}

// ── Helper: broadcast a notification from anywhere ─────────────────────────
export async function broadcastNotification(
  notif: Omit<AppNotification, 'read' | 'createdAt'>
) {
  const channel = supabase.channel(CHANNEL_NAME);
  await channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.send({
        type: 'broadcast',
        event: 'notification',
        payload: { ...notif, createdAt: new Date().toISOString() },
      });
      // Small delay then unsub so the send completes
      setTimeout(() => supabase.removeChannel(channel), 500);
    }
  });
}