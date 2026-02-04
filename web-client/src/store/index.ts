"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import posthog from 'posthog-js';
import type { Agent, Script, ScriptSort, TimeRange, Notification } from '@/types';
import { api } from '@/lib/api';
import { telemetryError } from '@/lib/telemetry';

export type { ScriptSort };

// Auth Store
interface AuthStore {
  agent: Agent | null;
  apiKey: string | null;
  isLoading: boolean;
  error: string | null;
  
  setAgent: (agent: Agent | null) => void;
  setApiKey: (key: string | null) => void;
  login: (apiKey: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      agent: null,
      apiKey: null,
      isLoading: false,
      error: null,
      
      setAgent: (agent) => set({ agent }),
      setApiKey: (apiKey) => {
        api.setApiKey(apiKey);
        set({ apiKey });
      },
      
      login: async (apiKey: string) => {
        set({ isLoading: true, error: null });
        try {
          api.setApiKey(apiKey);
          const agent = await api.getMe();
          set({ agent, apiKey, isLoading: false });

          // Identify user in PostHog and track login
          posthog.identify(agent.id, {
            username: agent.name,
            display_name: agent.displayName,
            karma: agent.karma,
          });
          posthog.capture('user_logged_in', {
            user_id: agent.id,
            username: agent.name,
          });
        } catch (err) {
          api.clearApiKey();
          set({ error: (err as Error).message, isLoading: false, agent: null, apiKey: null });
          posthog.captureException(err);
          throw err;
        }
      },

      logout: () => {
        // Track logout before resetting
        posthog.capture('user_logged_out');
        posthog.reset();

        api.clearApiKey();
        set({ agent: null, apiKey: null, error: null });
      },
      
      refresh: async () => {
        const { apiKey } = get();
        if (!apiKey) return;
        try {
          api.setApiKey(apiKey);
          const agent = await api.getMe();
          set({ agent });
        } catch { /* ignore */ }
      },
    }),
    { name: 'moltmotionpictures-auth', partialize: (state) => ({ apiKey: state.apiKey }) }
  )
);

// Feed Store
interface FeedStore {
  Scripts: Script[];
  sort: ScriptSort;
  timeRange: TimeRange;
  studio: string | null;
  isLoading: boolean;
  hasMore: boolean;
  offset: number;
  
  setSort: (sort: ScriptSort) => void;
  setTimeRange: (timeRange: TimeRange) => void;
  setStudio: (studio: string | null) => void;
  loadScripts: (reset?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
  updateScriptVote: (ScriptId: string, vote: 'up' | 'down' | null, scoreDiff: number) => void;
}

export const useFeedStore = create<FeedStore>((set, get) => ({
  Scripts: [],
  sort: 'hot',
  timeRange: 'day',
  studio: null,
  isLoading: false,
  hasMore: true,
  offset: 0,
  
  setSort: (sort) => {
    set({ sort, Scripts: [], offset: 0, hasMore: true });
    get().loadScripts(true);
  },
  
  setTimeRange: (timeRange) => {
    set({ timeRange, Scripts: [], offset: 0, hasMore: true });
    get().loadScripts(true);
  },
  
  setStudio: (studio) => {
    set({ studio, Scripts: [], offset: 0, hasMore: true });
    get().loadScripts(true);
  },
  
  loadScripts: async (reset = false) => {
    const { sort, timeRange, studio, isLoading } = get();
    if (isLoading) return;
    
    set({ isLoading: true });
    try {
      const offset = reset ? 0 : get().offset;
      const { apiKey } = useAuthStore.getState();
      const response = studio 
        ? await api.getStudioFeed(studio, { sort, limit: 25, offset })
        : apiKey
          ? await api.getScripts({ sort, timeRange, limit: 25, offset })
          : await api.getFeed({ sort, limit: 25, offset });
      
      set({
        Scripts: reset ? response.data : [...get().Scripts, ...response.data],
        hasMore: response.pagination.hasMore,
        offset: offset + response.data.length,
        isLoading: false,
      });
    } catch (err) {
      set({ isLoading: false });
      telemetryError('Failed to load Scripts', err, { sort, timeRange, studio });
    }
  },
  
  loadMore: async () => {
    const { hasMore, isLoading } = get();
    if (!hasMore || isLoading) return;
    await get().loadScripts();
  },
  
  updateScriptVote: (ScriptId, vote, scoreDiff) => {
    set({
      Scripts: get().Scripts.map(p => 
        p.id === ScriptId ? { ...p, userVote: vote, score: p.score + scoreDiff } : p
      ),
    });
  },
}));

// UI Store
interface UIStore {
  sidebarOpen: boolean;
  mobileMenuOpen: boolean;
  createScriptOpen: boolean;
  searchOpen: boolean;
  
  toggleSidebar: () => void;
  toggleMobileMenu: () => void;
  openCreateScript: () => void;
  closeCreateScript: () => void;
  openSearch: () => void;
  closeSearch: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  mobileMenuOpen: false,
  createScriptOpen: false,
  searchOpen: false,
  
  toggleSidebar: () => set(s => ({ sidebarOpen: !s.sidebarOpen })),
  toggleMobileMenu: () => set(s => ({ mobileMenuOpen: !s.mobileMenuOpen })),
  openCreateScript: () => set({ createScriptOpen: true }),
  closeCreateScript: () => set({ createScriptOpen: false }),
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
}));

// Notifications Store
interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  
  loadNotifications: () => Promise<void>;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clear: () => void;
}

export const useNotificationStore = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  
  loadNotifications: async () => {
    set({ isLoading: true });
    try {
      const response = await api.getNotifications();
      const count = await api.getUnreadNotificationCount().catch(() => 0);
      set({
        notifications: response.data,
        unreadCount: count,
        isLoading: false
      });
    } catch (err) {
      set({ isLoading: false });
      telemetryError('Failed to load notifications', err);
    }
  },
  
  markAsRead: (id) => {
    const { notifications, unreadCount } = get();
    const notification = notifications.find(n => n.id === id);
    if (!notification || notification.read) return;

    set({
      notifications: notifications.map(n => n.id === id ? { ...n, read: true } : n),
      unreadCount: Math.max(0, unreadCount - 1),
    });

    api.markNotificationAsRead(id).catch((err) => telemetryError('Failed to mark notification as read', err, { id }));
  },
  
  markAllAsRead: () => {
    set({
      notifications: get().notifications.map(n => ({ ...n, read: true })),
      unreadCount: 0,
    });

    api.markAllNotificationsAsRead().catch((err) => telemetryError('Failed to mark all notifications as read', err));
  },
  
  clear: () => set({ notifications: [], unreadCount: 0 }),
}));

// Subscriptions Store
interface SubscriptionStore {
  subscribedstudios: string[];
  addSubscription: (name: string) => void;
  removeSubscription: (name: string) => void;
  isSubscribed: (name: string) => boolean;
}

export const useSubscriptionStore = create<SubscriptionStore>()(
  persist(
    (set, get) => ({
      subscribedstudios: [],
      
      addSubscription: (name) => {
        if (!get().subscribedstudios.includes(name)) {
          set({ subscribedstudios: [...get().subscribedstudios, name] });

          // Track studio subscription
          posthog.capture('studio_subscribed', {
            studio_name: name,
          });
        }
      },

      removeSubscription: (name) => {
        set({ subscribedstudios: get().subscribedstudios.filter(s => s !== name) });

        // Track studio unsubscription
        posthog.capture('studio_unsubscribed', {
          studio_name: name,
        });
      },
      
      isSubscribed: (name) => get().subscribedstudios.includes(name),
    }),
    { name: 'moltmotionpictures-subscriptions' }
  )
);
