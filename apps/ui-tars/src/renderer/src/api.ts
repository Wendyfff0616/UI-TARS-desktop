// apps/ui-tars/src/renderer/src/api.ts
/**
 * Renderer API 客户端封装
 * 自动注入并维护 sessionId
 */
import { createClient } from '@ui-tars/electron-ipc/renderer';
import type { Router } from '@/main/ipcRoutes';
import { useSessionStore } from '@/renderer/src/store/session';

// 原始 IPC 客户端
const ipcClient = createClient<Router>({
  ipcInvoke: window.electron.ipcRenderer.invoke,
});

/**
 * 包装 RPC 调用：自动注入 sessionId，并在响应中更新 store
 * @param fn 原始 RPC 方法，返回 { newSessionId?, data? }
 */
function withSession<Args extends Record<string, any>, Res = void>(
  fn: (args: Args) => Promise<{ newSessionId: string | undefined; data?: Res }>,
): (args?: Omit<Args, 'sessionId'>) => Promise<string> {
  return async (
    argsWithoutSid: Omit<Args, 'sessionId'> = {} as Omit<Args, 'sessionId'>,
  ) => {
    const store = useSessionStore.getState();
    const sid = store.currentServerSessionId || '';

    // 调用原始方法，并注入 sessionId
    const result = await fn({
      ...(argsWithoutSid as any),
      sessionId: sid,
    } as Args);

    // 更新 store 中的 sessionId (可选，避免重复设置)
    // if (result.newSessionId) {
    //   store.setServerSessionId(result.newSessionId);
    // }

    // 返回新的 sessionId
    return result.newSessionId || '';
  };
}

// 创建一个特殊的包装器，为 runAgent 添加默认的 instructions
function withSessionAndInstructions(fn) {
  return async (args: { instructions?: string } = {}) => {
    // 确保始终有 instructions
    const argsWithInstructions = {
      ...args,
      instructions: args.instructions || 'Default instructions from client',
    };

    // 使用常规的 withSession 包装器
    return await withSession(fn)(argsWithInstructions);
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
