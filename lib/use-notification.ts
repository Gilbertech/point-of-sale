'use client';

import { useCallback } from 'react';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: string;
  type: NotificationType;
  message: string;
  duration?: number;
}

// Simple notification store (in production, use a state management library)
const notifications: Notification[] = [];
let listeners: Array<(notifications: Notification[]) => void> = [];

function notifyListeners() {
  listeners.forEach(listener => listener([...notifications]));
}

export function useNotification() {
  const show = useCallback((message: string, type: NotificationType = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substring(7);
    const notification: Notification = { id, message, type, duration };

    notifications.push(notification);
    notifyListeners();

    if (duration > 0) {
      setTimeout(() => {
        dismiss(id);
      }, duration);
    }

    return id;
  }, []);

  const success = useCallback((message: string) => show(message, 'success'), [show]);
  const error = useCallback((message: string) => show(message, 'error'), [show]);
  const info = useCallback((message: string) => show(message, 'info'), [show]);
  const warning = useCallback((message: string) => show(message, 'warning'), [show]);

  return { show, success, error, info, warning };
}

function dismiss(id: string) {
  const index = notifications.findIndex(n => n.id === id);
  if (index > -1) {
    notifications.splice(index, 1);
    notifyListeners();
  }
}

export function subscribeToNotifications(listener: (notifications: Notification[]) => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(l => l !== listener);
  };
}
