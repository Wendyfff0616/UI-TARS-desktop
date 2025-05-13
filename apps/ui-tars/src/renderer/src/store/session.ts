// apps/ui-tars/src/renderer/src/store/session.ts
import localforage from 'localforage';
import { create } from 'zustand';
import {
  sessionManager,
  type SessionItem,
  type SessionMetaInfo,
} from '@renderer/db/session';
import { chatManager } from '@renderer/db/chat';
import { api } from '@renderer/api';
import type { ConversationWithSoM } from '@main/shared/types';

// 本地存储服务器会话ID
const serverSessionStore = localforage.createInstance({
  name: 'ui-tars',
  storeName: 'serverSessionId',
});

interface SessionState {
  loading: boolean;
  error: Error | null;
  currentSessionId: string;
  sessions: SessionItem[];
  chatMessages: ConversationWithSoM[];
  currentServerSessionId: string | null;

  setCurrentSessionId: (id: string) => void;
  setSessions: (sessions: SessionItem[]) => void;
  setChatMessages: (messages: ConversationWithSoM[]) => void;
  setError: (error: Error | null) => void;
  setLoading: (loading: boolean) => void;
  setServerSessionId: (id: string | null) => Promise<void>;

  createMessage: (
    sessionId: string,
    messages: ConversationWithSoM[],
  ) => Promise<ConversationWithSoM[] | null>;
  getMessages: (sessionId: string) => Promise<ConversationWithSoM[]>;
  updateMessages: (
    sessionId: string,
    messages: ConversationWithSoM[],
  ) => Promise<ConversationWithSoM[] | null>;
  deleteMessages: (sessionId: string) => Promise<boolean>;

  fetchSessions: () => Promise<void>;
  createSession: (
    name: string,
    meta?: SessionMetaInfo,
  ) => Promise<SessionItem | null>;
  updateSession: (
    id: string,
    updates: Partial<Pick<SessionItem, 'name' | 'meta'>>,
  ) => Promise<SessionItem | null>;
  deleteSession: (id: string) => Promise<boolean>;
  setActiveSession: (sessionId: string) => Promise<void>;
}

export const useSessionStore = create<SessionState>((set, get) => {
  // 初始化时加载持久化的 serverSessionId
  (async () => {
    const persisted = await serverSessionStore.getItem<string>('id');
    if (persisted) set({ currentServerSessionId: persisted });
  })();

  return {
    sessions: [],
    loading: true,
    error: null,
    currentSessionId: '',
    chatMessages: [],
    currentServerSessionId: null,

    setCurrentSessionId: (id) => set({ currentSessionId: id }),
    setSessions: (sessions) => set({ sessions }),
    setChatMessages: (messages) => set({ chatMessages: messages }),
    setError: (error) => set({ error }),
    setLoading: (loading) => set({ loading }),
    setServerSessionId: async (id) => {
      set({ currentServerSessionId: id });
      await serverSessionStore.setItem('id', id);
    },

    fetchSessions: async () => {
      try {
        set({ loading: true });
        const allSessions = await sessionManager.getAllSessions();
        set({ sessions: allSessions.reverse() });
      } catch (err) {
        console.error('fetchSessions', err);
        set({
          error:
            err instanceof Error ? err : new Error('Failed to fetch sessions'),
        });
      } finally {
        set({ loading: false });
      }
    },

    createSession: async (name, meta = {}) => {
      try {
        // 初始化后端会话
        const newSession = await sessionManager.createSession(name, meta);
        set((state) => ({
          sessions: [newSession, ...state.sessions],
          currentSessionId: newSession.id,
          chatMessages: [],
        }));
        // 获取并设置后端 sessionId
        const sid = await api.runAgent({
          instructions: 'New session instructions',
        });
        await set({ currentServerSessionId: sid });
        return newSession;
      } catch (err) {
        console.error('createSession', err);
        set({
          error:
            err instanceof Error ? err : new Error('Failed to create session'),
        });
        return null;
      }
    },

    updateSession: async (id, updates) => {
      try {
        const updatedSession = await sessionManager.updateSession(id, updates);
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === id ? { ...session, ...updates } : session,
          ),
        }));
        return updatedSession;
      } catch (err) {
        console.error('updateSession', err);
        set({
          error:
            err instanceof Error ? err : new Error('Failed to update session'),
        });
        return null;
      }
    },

    deleteSession: async (id) => {
      try {
        const deleted = await sessionManager.deleteSession(id);
        await get().deleteMessages(id);
        if (deleted) {
          set((state) => {
            const newState: Partial<SessionState> = {
              sessions: state.sessions.filter((s) => s.id !== id),
            };
            if (state.currentSessionId === id) {
              newState.currentSessionId = '';
              newState.currentServerSessionId = null;
              newState.chatMessages = [];
            }
            return newState;
          });
        }
        return deleted;
      } catch (err) {
        console.error('deleteSession', err);
        set({
          error:
            err instanceof Error ? err : new Error('Failed to delete session'),
        });
        return false;
      }
    },

    createMessage: async (sessionId, messages) => {
      try {
        const updatedMessages = await chatManager.createSessionMessages(
          sessionId,
          messages,
        );
        set({ chatMessages: updatedMessages });
        return updatedMessages;
      } catch (err) {
        console.error('createMessage', err);
        set({
          error:
            err instanceof Error ? err : new Error('Failed to add messages'),
        });
        return null;
      }
    },

    getMessages: async (sessionId) => {
      try {
        const messages =
          (await chatManager.getSessionMessages(sessionId)) || [];
        set({ chatMessages: messages });
        return messages;
      } catch (err) {
        console.error('getMessages', err);
        set({
          error:
            err instanceof Error ? err : new Error('Failed to get messages'),
        });
        return [];
      }
    },

    updateMessages: async (sessionId, messages) => {
      try {
        const updatedMessages = await chatManager.updateSessionMessages(
          sessionId,
          messages,
        );
        set({ chatMessages: updatedMessages });
        return updatedMessages;
      } catch (err) {
        console.error('updateMessages', err);
        set({
          error:
            err instanceof Error ? err : new Error('Failed to update messages'),
        });
        return null;
      }
    },

    deleteMessages: async (sessionId) => {
      try {
        await api.clearHistory();
        const deleted = await chatManager.deleteSessionMessages(sessionId);
        if (deleted && sessionId === get().currentSessionId) {
          set({ chatMessages: [] });
        }
        return deleted;
      } catch (err) {
        console.error('deleteMessages', err);
        set({
          error:
            err instanceof Error ? err : new Error('Failed to delete messages'),
        });
        return false;
      }
    },

    setActiveSession: async (sessionId) => {
      try {
        set({ currentSessionId: sessionId, currentServerSessionId: null });
        await get().getMessages(sessionId);
        const sid = await api.runAgent({
          instructions: 'Switching to existing session',
        });
        await set({ currentServerSessionId: sid });
      } catch (err) {
        console.error('setActiveSession', err);
        set({
          error:
            err instanceof Error
              ? err
              : new Error('Failed to set ActiveSession'),
        });
      }
    },
  };
});
