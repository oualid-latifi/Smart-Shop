import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { api } from './api/client';
import type { AppNotification, NotificationFeed } from './api/types';

// Toutes les minutes tant que l'application est ouverte
const POLL_MS = 60_000;

interface NotificationsValue {
  unread: number;
  items: AppNotification[];
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const Context = createContext<NotificationsValue>({
  unread: 0,
  items: [],
  refresh: async () => undefined,
  markRead: async () => undefined,
  markAllRead: async () => undefined,
});

if (Platform.OS !== 'web') {
  // Afficher aussi les alertes quand l'application est au premier plan
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
  });
}

/**
 * Enregistre le téléphone pour les notifications push (stock bas, grosse vente, chèque à encaisser…).
 * Impossible dans Expo Go et sans projet EAS : on se contente alors des alertes locales (voir plus bas).
 */
async function registerPush(): Promise<boolean> {
  if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient') return false;
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId) return false;
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return false;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'SmartShop', importance: Notifications.AndroidImportance.HIGH });
    }
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api('/api/notifications/push-token', { method: 'PUT', body: { token: data } });
    return true;
  } catch {
    return false;
  }
}

/** Alerte locale pour une nouvelle notification reçue pendant que l'application est ouverte. */
async function showLocal(n: AppNotification) {
  if (Platform.OS === 'web') return;
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return;
    await Notifications.scheduleNotificationAsync({ content: { title: n.title, body: n.body ?? undefined }, trigger: null });
  } catch {
    // Alertes indisponibles : la cloche de l'accueil suffit
  }
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [feed, setFeed] = useState<NotificationFeed>({ unread: 0, items: [] });
  const seen = useRef<Set<string> | null>(null);
  const pushEnabled = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const next = await api<NotificationFeed>('/api/notifications');
      // Au premier chargement on mémorise l'existant sans alerter
      if (seen.current && !pushEnabled.current) {
        next.items.filter((n) => !n.read && !seen.current!.has(n.id)).slice(0, 3).forEach((n) => void showLocal(n));
      }
      seen.current = new Set(next.items.map((n) => n.id));
      setFeed(next);
    } catch {
      // Serveur injoignable : on réessaiera au prochain tour
    }
  }, []);

  useEffect(() => {
    void registerPush().then((ok) => (pushEnabled.current = ok));
    void refresh();
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void refresh();
    }, POLL_MS);
    const sub = AppState.addEventListener('change', (state) => state === 'active' && void refresh());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [refresh]);

  const markRead = useCallback(async (id: string) => {
    setFeed((f) => ({
      unread: Math.max(0, f.unread - (f.items.some((n) => n.id === id && !n.read) ? 1 : 0)),
      items: f.items.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
    await api(`/api/notifications/${id}/read`, { method: 'POST' }).catch(() => undefined);
  }, []);

  const markAllRead = useCallback(async () => {
    setFeed((f) => ({ unread: 0, items: f.items.map((n) => ({ ...n, read: true })) }));
    await api('/api/notifications/read-all', { method: 'POST' }).catch(() => undefined);
  }, []);

  return <Context.Provider value={{ ...feed, refresh, markRead, markAllRead }}>{children}</Context.Provider>;
}

export function useNotifications() {
  return useContext(Context);
}
