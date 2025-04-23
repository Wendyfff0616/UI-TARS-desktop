/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { t } from './_base';
import { getScreenSize } from '@main/utils/screen';
import { z } from 'zod';

export const screenRoute = t.router({
  getScreenSize: t.procedure.input(z.object({})).handle(async ({ input }) => {
    const { sessionId } = input;
    const primaryDisplay = getScreenSize();

    const result = {
      screenWidth: primaryDisplay.physicalSize.width,
      screenHeight: primaryDisplay.physicalSize.height,
      scaleFactor: primaryDisplay.scaleFactor,
    };

    return {
      newSessionId: sessionId,
      data: result,
    };
  }),
});
