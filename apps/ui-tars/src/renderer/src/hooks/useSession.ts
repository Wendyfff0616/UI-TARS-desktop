/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
// /apps/ui-tars/src/renderer/src/hooks/useSession.ts
import { useSessionStore } from '@renderer/store/session';
import { useEffect, useCallback } from 'react';
import { api } from '@renderer/api';

/**
 * 会话管理Hook - 提供对话会话相关的状态和操作
 *
 * 1. 自动加载会话列表
 * 2. 提供会话操作（创建、更新、删除）
 * 3. 提供消息操作（添加、更新、删除）
 * 4. 管理客户端会话与服务端会话的映射关系
 */
export const useSession = () => {
  const store = useSessionStore();

  // 初始加载
  useEffect(() => {
    store.fetchSessions();

    // 可选：检查服务端会话状态
    const checkServerSession = async () => {
      if (store.currentSessionId && store.currentServerSessionId) {
        // 验证现有服务端会话是否有效
        try {
          // 只需调用任意 API 方法，withSession 包装器会自动处理会话 ID
          await api.getEnsurePermissions();
          console.log('Server session restored:', store.currentServerSessionId);
        } catch (err) {
          console.warn(
            'Server session invalid, will create new on next action',
          );
        }
      }
    };

    checkServerSession();
  }, []);

  // 包装 runAgent 调用，确保服务端会话初始化
  const ensureServerSession = useCallback(async () => {
    if (!store.currentServerSessionId) {
      // 添加必要的 instructions 参数
      return await api.runAgent({ instructions: 'Default instructions' });
    }
    return store.currentServerSessionId;
  }, [store.currentServerSessionId]);

  return {
    loading: store.loading,
    error: store.error,
    currentSessionId: store.currentSessionId,
    sessions: store.sessions,
    chatMessages: store.chatMessages,

    setCurrentSessionId: store.setCurrentSessionId,

    createMessage: store.createMessage,
    updateMessages: store.updateMessages,
    deleteMessages: store.deleteMessages,

    setActiveSession: store.setActiveSession,
    createSession: store.createSession,
    updateSession: store.updateSession,
    deleteSession: store.deleteSession,
    refreshSessions: store.fetchSessions,

    // 服务端会话相关
    currentServerSessionId: store.currentServerSessionId,
    setServerSessionId: store.setServerSessionId,
    ensureServerSession, // 新增：确保服务端会话已初始化
  };
};
