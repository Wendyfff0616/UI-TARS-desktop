// apps/ui-tars/src/main/ipcRoutes/_base.ts
import { initIpc } from '@ui-tars/electron-ipc/main';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// 初始化原生 IPC
const tRaw = initIpc.create();

export const SessionSchema = z.object({
  sessionId: z.preprocess(
    (val) => {
      if (typeof val === 'string' && val.trim() === '') return undefined;
      return val;
    },
    z
      .string()
      .optional()
      .default(() => uuidv4()),
  ),
});

export const t = {
  router: tRaw.router,
  procedure: {
    /**
     * Wrap a Zod schema to include sessionId handling and proper typing.
     * Usage:
     *   t.procedure.input(SessionSchema)
     *   t.procedure.input(SessionSchema.extend({ instructions: z.string() }))
     */
    input: <T extends z.ZodTypeAny>(schema: T) => {
      // Merge raw session schema and user schema
      const combined = z.intersection(SessionSchema, schema);
      // Transform to default a missing sessionId
      const withDefault = combined.transform((data) => ({
        ...data,
        sessionId: data.sessionId ?? uuidv4(),
      }));
      type InputType = z.infer<typeof withDefault>;
      return tRaw.procedure.input<InputType>(withDefault);
    },
  },
};
