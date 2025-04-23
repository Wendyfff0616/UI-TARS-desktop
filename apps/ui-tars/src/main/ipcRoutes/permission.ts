/*
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import { t } from './_base';
import * as env from '@main/env';
import { store } from '@main/store/create';
import { z } from 'zod';

export const permissionRoute = t.router({
  getEnsurePermissions: t.procedure
    .input(z.object({}))
    .handle(async ({ input }) => {
      const { sessionId } = input;

      if (env.isMacOS) {
        const { ensurePermissions } = await import(
          '@main/utils/systemPermissions'
        );
        store.setState({ ensurePermissions: ensurePermissions() });
      } else {
        store.setState({
          ensurePermissions: { screenCapture: true, accessibility: true },
        });
      }

      console.log(
        '[permissionRoute.getEnsurePermissions] ensurePermissions',
        store.getState().ensurePermissions,
      );

      return {
        newSessionId: sessionId,
        data: store.getState().ensurePermissions,
      };
    }),
});
