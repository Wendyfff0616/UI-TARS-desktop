// apps/ui-tars/src/main/ipcRoutes/browser.ts
import { t } from './_base';
import { checkBrowserAvailability } from '../services/browserCheck';
import { z } from 'zod';

export const browserRoute = t.router({
  checkBrowserAvailability: t.procedure
    // 自动注入 sessionId，不需要手写 SessionInput
    .input(z.object({}))
    .handle(async ({ input }) => {
      const { sessionId } = input;
      const available = await checkBrowserAvailability();
      // 返回结果时把 newSessionId 带回前端
      return { newSessionId: sessionId, data: available };
    }),
});
