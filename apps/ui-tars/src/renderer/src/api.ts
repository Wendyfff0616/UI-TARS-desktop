// apps/ui-tars/src/renderer/src/api.ts
/**
 * Renderer API 客户端封装
 * 自动注入并维护 sessionId
 */
import { useSessionStore } from '@renderer/store/session';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * 直接调用后端 /chat/completions，
 * 自动带上 sessionId（从 cookie 或 header）并把服务端返回的 X-Session-ID 同步回 store
 */
export async function chatCompletions(payload: any): Promise<any> {
  const store = useSessionStore.getState();
  const sid = store.currentServerSessionId;

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    credentials: 'include', // 如果用 cookie 存 Sid 就用 include
    headers: {
      'Content-Type': 'application/json',
      ...(sid ? { 'X-Session-ID': sid } : {}),
    },
    body: JSON.stringify(payload),
  });

  // 拿到新 Sid，同步到客户端 store
  const newSid = res.headers.get('X-Session-ID');
  if (newSid) {
    store.setServerSessionId(newSid);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

import { createClient } from '@ui-tars/electron-ipc/renderer';
import type { Router } from '@main/ipcRoutes';

// 原始 IPC 客户端
const ipcClient = createClient<Router>({
  ipcInvoke: window.electron.ipcRenderer.invoke,
});

/**
 * 包装 RPC 调用：自动注入 sessionId，并在响应中更新 store
 * @param fn 原始 RPC 方法，返回 { newSessionId?, data? }
 */
function withSession<Args extends { sessionId?: string }, Res = void>(
  fn: (args: Args) => Promise<{ newSessionId?: string; data?: Res }>,
): (args?: Omit<Args, 'sessionId'>) => Promise<string> {
  return async (args = {} as Omit<Args, 'sessionId'>) => {
    const store = useSessionStore.getState();
    console.log(
      '[withSession] before call, store.currentServerSessionId=',
      store.currentServerSessionId,
    );
    const result = await fn({
      ...args,
      sessionId: store.currentServerSessionId || '',
    } as Args);
    console.log(
      '[withSession] main returned newSessionId=',
      result.newSessionId,
    );
    const sid = result.newSessionId || '';
    store.setServerSessionId(sid);
    console.log(
      '[withSession] after call, store.currentServerSessionId=',
      store.currentServerSessionId,
    );
    return sid;
  };
}

// 创建一个特殊的包装器，为 runAgent 添加默认的 instructions
function withSessionAndInstructions(
  fn: typeof ipcClient.runAgent,
): (args?: { instructions?: string }) => Promise<string> {
  return async ({ instructions = '' } = {}) => {
    return await withSession(fn)({ instructions });
  };
}

// 导出：对 ipcClient 所有方法进行包装
export const api = {
  // 使用特殊包装器处理 runAgent
  runAgent: withSessionAndInstructions(ipcClient.runAgent),
  pauseRun: withSession(ipcClient.pauseRun),
  resumeRun: withSession(ipcClient.resumeRun),
  stopRun: withSession(ipcClient.stopRun),
  setInstructions: withSession(ipcClient.setInstructions),
  setMessages: withSession(ipcClient.setMessages),
  clearHistory: withSession(ipcClient.clearHistory),

  checkBrowserAvailability: withSession(ipcClient.checkBrowserAvailability),

  getEnsurePermissions: withSession(ipcClient.getEnsurePermissions),
  getScreenSize: withSession(ipcClient.getScreenSize),

  openSettingsWindow: withSession(ipcClient.openSettingsWindow),
  closeSettingsWindow: withSession(ipcClient.closeSettingsWindow),
  openLauncher: withSession(ipcClient.openLauncher),
  closeLauncher: withSession(ipcClient.closeLauncher),
  showMainWindow: withSession(ipcClient.showMainWindow),
};

// 导出原始 IPC 客户端
export { ipcClient };
