import type { VpnStatusData } from '../api';

export function getVlessState(status?: VpnStatusData, now = Date.now()): VpnStatusData['state'] {
  if (!status) return 'unknown';
  if (status.state === 'connected' || status.state === 'disconnected' || status.state === 'stopped') {
    const checkedAt = status.checkedAt ? Date.parse(status.checkedAt) : NaN;
    if (!Number.isFinite(checkedAt) || now - checkedAt > 90_000 || checkedAt > now) return 'unknown';
  }
  return status.state;
}
