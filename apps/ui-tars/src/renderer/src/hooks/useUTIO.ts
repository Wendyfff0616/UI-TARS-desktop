import { UTIOWithHeaders } from '@renderer/services/UTIOWithHeaders';
import { useSetting } from '@renderer/hooks/useSetting';

// optional: memoize per‐endpoint
export function useUTIO() {
  const { settings } = useSetting();
  const endpoint = settings?.utioBaseUrl || '';
  return new UTIOWithHeaders(endpoint);
}
