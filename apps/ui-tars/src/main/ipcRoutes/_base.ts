// apps/ui-tars/src/main/ipcRoutes/_base.ts
import { initIpc } from '@ui-tars/electron-ipc/main';
import { z, ZodTypeAny } from 'zod';

// 初始化原生 IPC
const tRaw = initIpc.create();

// 全局可选 sessionId Schema
const SessionInput = z.object({ sessionId: z.string().optional() });

export const t = {
  router: tRaw.router,
  procedure: {
    input: <T extends ZodTypeAny>(schema: T) =>
      tRaw.procedure.input(
        // 用 intersection 组合任意 schema 与 SessionInput：SessionInput & schema
        z.intersection(SessionInput, schema),
      ),
  },
};
