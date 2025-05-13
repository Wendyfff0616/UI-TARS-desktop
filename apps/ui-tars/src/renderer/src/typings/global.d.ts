/**
 * Copyright (c) 2025 Bytedance, Inc. and its affiliates.
 * SPDX-License-Identifier: Apache-2.0
 */
import type { LocalStore } from '@main/store/types';
export {};

declare global {
  interface ImportMetaEnv {
    readonly VITE_API_BASE_URL: string;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
  interface Window {
    electron: {
      ipcRenderer: {
        invoke(channel: string, ...args: unknown[]): Promise<unknown>;
        sendMessage(channel: string, ...args: unknown[]): void;
        on(channel: string, ...args: unknown[]): () => void;
        once(channel: string, ...args: unknown[]): void;
      };
      utio: {
        shareReport(params: unknown): Promise<void>;
      };
      setting: {
        getSetting(): Promise<Partial<LocalStore>>;
        clearSetting(): Promise<unknown>;
        updateSetting(s: unknown): Promise<unknown>;
        importPresetFromText(t: string): Promise<unknown>;
        importPresetFromUrl(u: string, a: boolean): Promise<unknown>;
        updatePresetFromRemote(): Promise<unknown>;
        resetPreset(): Promise<unknown>;
        onUpdate(cb: (s: unknown) => void): void;
      };
    };
  }
}
