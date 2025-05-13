/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { t, SessionSchema } from './_base';
import { StatusEnum } from '@ui-tars/shared/types';
import { store } from '@main/store/create';
import { runAgent as _runAgentService } from '@main/services/runAgent';
import { showWindow } from '@main/window/index';
import { closeScreenMarker } from '@main/window/ScreenMarker';
import { GUIAgent } from '@ui-tars/sdk';
import { Operator } from '@ui-tars/sdk/core';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
export class GUIAgentManager {
  private static instance: GUIAgentManager;
  private currentAgent: GUIAgent<Operator> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}
  public static getInstance(): GUIAgentManager {
    if (!GUIAgentManager.instance) {
      GUIAgentManager.instance = new GUIAgentManager();
    }
    return GUIAgentManager.instance;
  }
  public setAgent(agent: GUIAgent<Operator>) {
    this.currentAgent = agent;
  }
  public getAgent(): GUIAgent<Operator> | null {
    return this.currentAgent;
  }
  public clearAgent() {
    this.currentAgent = null;
  }
}

export const agentRoute = t.router({
  runAgent: t.procedure
    .input(
      SessionSchema.merge(
        z.object({
          instructions: z.string().min(1, 'instructions is required'),
        }),
      ),
    )
    .handle(async ({ input }) => {
      console.log('[agentRoute.runAgent] got sessionId=', input.sessionId);
      // 1) generate or reuse sessionId
      const sid =
        input.sessionId && input.sessionId.trim() ? input.sessionId : uuidv4();
      console.log('[agentRoute.runAgent] generated sessionId=', sid);
      // 2) stash instructions in your main‐process store
      store.setState({ instructions: input.instructions });

      // 3) start your agent only if not already running
      const { thinking } = store.getState();
      if (!thinking) {
        store.setState({
          thinking: true,
          abortController: new AbortController(),
          errorMsg: null,
        });

        try {
          await _runAgentService(store.setState, store.getState);
        } finally {
          store.setState({ thinking: false });
        }
      }

      // 4) return the sessionId to the renderer
      return { newSessionId: sid };
    }),

  pauseRun: t.procedure.input(SessionSchema).handle(async ({ input }) => {
    const { sessionId } = input;
    const guiAgent = GUIAgentManager.getInstance().getAgent();
    if (guiAgent instanceof GUIAgent) {
      guiAgent.pause();
      store.setState({ thinking: false });
    }
    return { newSessionId: sessionId };
  }),

  resumeRun: t.procedure.input(SessionSchema).handle(async ({ input }) => {
    const { sessionId } = input;
    const guiAgent = GUIAgentManager.getInstance().getAgent();
    if (guiAgent instanceof GUIAgent) {
      guiAgent.resume();
      store.setState({ thinking: false });
    }
    return { newSessionId: sessionId };
  }),

  stopRun: t.procedure.input(SessionSchema).handle(async ({ input }) => {
    const { sessionId } = input;
    const { abortController } = store.getState();
    store.setState({ status: StatusEnum.END, thinking: false });
    showWindow();
    abortController?.abort();
    const guiAgent = GUIAgentManager.getInstance().getAgent();
    if (guiAgent instanceof GUIAgent) {
      guiAgent.stop();
    }
    closeScreenMarker();
    return { newSessionId: sessionId };
  }),

  setInstructions: t.procedure
    .input(SessionSchema.merge(z.object({ instructions: z.string() })))
    .handle(async ({ input }) => {
      // If the client sent an empty‐string sessionId, we generate a brand‐new one here:
      const sid = input.sessionId?.length ? input.sessionId : uuidv4();

      // stash the instructions into the main‐process store
      store.setState({ instructions: input.instructions });

      // return our brand‐new sessionId
      return { newSessionId: sid };
    }),

  setMessages: t.procedure
    .input(SessionSchema.merge(z.object({ messages: z.array(z.any()) })))
    .handle(async ({ input }) => {
      const { sessionId, messages } = input;
      store.setState({ messages });
      return { newSessionId: sessionId };
    }),

  clearHistory: t.procedure
    .input(SessionSchema.merge(z.object({})))
    .handle(async ({ input }) => {
      const { sessionId } = input;
      store.setState({
        status: StatusEnum.END,
        messages: [],
        thinking: false,
        errorMsg: null,
      });
      return { newSessionId: sessionId };
    }),
});
