/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { t } from './_base';
import {
  LauncherWindow,
  closeSettingsWindow,
  createSettingsWindow,
  showWindow,
} from '@main/window/index';
import { z } from 'zod';

export const windowRoute = t.router({
  openSettingsWindow: t.procedure
    .input(z.object({}))
    .handle(async ({ input }) => {
      const { sessionId } = input;
      createSettingsWindow();
      return { newSessionId: sessionId };
    }),

  closeSettingsWindow: t.procedure
    .input(z.object({}))
    .handle(async ({ input }) => {
      const { sessionId } = input;
      closeSettingsWindow();
      return { newSessionId: sessionId };
    }),

  openLauncher: t.procedure.input(z.object({})).handle(async ({ input }) => {
    const { sessionId } = input;
    LauncherWindow.getInstance().show();
    return { newSessionId: sessionId };
  }),

  closeLauncher: t.procedure.input(z.object({})).handle(async ({ input }) => {
    const { sessionId } = input;
    LauncherWindow.getInstance().blur();
    LauncherWindow.getInstance().hide();
    return { newSessionId: sessionId };
  }),

  showMainWindow: t.procedure.input(z.object({})).handle(async ({ input }) => {
    const { sessionId } = input;
    showWindow();
    return { newSessionId: sessionId };
  }),
});
