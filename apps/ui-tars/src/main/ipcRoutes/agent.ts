/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { t } from './_base';
import { StatusEnum } from '@ui-tars/shared/types';
import { store } from '@main/store/create';
import { runAgent } from '@main/services/runAgent';
import { showWindow } from '@main/window/index';
import { closeScreenMarker } from '@main/window/ScreenMarker';
import { GUIAgent } from '@ui-tars/sdk';
import { Operator } from '@ui-tars/sdk/core';
import { z } from 'zod';

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
  runAgent: t.procedure.input(z.object({})).handle(async ({ input }) => {
    const { sessionId } = input;
    const { thinking } = store.getState();
    if (thinking) {
      return { newSessionId: sessionId };
    }
    store.setState({
      abortController: new AbortController(),
      thinking: true,
      errorMsg: null,
    });
    await runAgent(store.setState, store.getState);
    store.setState({ thinking: false });
    return { newSessionId: sessionId };
  }),

  pauseRun: t.procedure.input(z.object({})).handle(async ({ input }) => {
    const { sessionId } = input;
    const guiAgent = GUIAgentManager.getInstance().getAgent();
    if (guiAgent instanceof GUIAgent) {
      guiAgent.pause();
      store.setState({ thinking: false });
    }
    return { newSessionId: sessionId };
  }),

  resumeRun: t.procedure.input(z.object({})).handle(async ({ input }) => {
    const { sessionId } = input;
    const guiAgent = GUIAgentManager.getInstance().getAgent();
    if (guiAgent instanceof GUIAgent) {
      guiAgent.resume();
      store.setState({ thinking: false });
    }
    return { newSessionId: sessionId };
  }),

  stopRun: t.procedure.input(z.object({})).handle(async ({ input }) => {
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
    .input(z.object({ instructions: z.string() }))
    .handle(async ({ input }) => {
      const { sessionId, instructions } = input;
      store.setState({ instructions });
      return { newSessionId: sessionId };
    }),

  setMessages: t.procedure
    .input(z.object({ messages: z.array(z.any()) }))
    .handle(async ({ input }) => {
      const { sessionId, messages } = input;
      store.setState({ messages });
      return { newSessionId: sessionId };
    }),

  clearHistory: t.procedure.input(z.object({})).handle(async ({ input }) => {
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
