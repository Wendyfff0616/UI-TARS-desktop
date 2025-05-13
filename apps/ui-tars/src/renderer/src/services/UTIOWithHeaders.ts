import { UTIO, UTIOPayload } from '@ui-tars/utio';
import { useSessionStore } from '@renderer/store/session';

/**
 * 在原有 UTIO 基础上，自动带上 X-Session-ID 头
 */
export class UTIOWithHeaders extends UTIO {
  private readonly _endpoint: string;
  constructor(endpoint: string) {
    super(endpoint);
    this._endpoint = endpoint;
  }

  async send<T extends UTIOPayload<any>>(data: T): Promise<void> {
    if (!this._endpoint) return;
    // 从 useSessionStore 里拿当前 sessionId
    const sid = useSessionStore.getState().currentServerSessionId;
    try {
      const res = await fetch(this._endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(sid ? { 'X-Session-ID': sid } : {}),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        throw new Error(`UTIO upload failed: ${res.status}`);
      }
    } catch {
      // silent fail
    }
  }
}
