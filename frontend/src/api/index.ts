const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

// Auth
export async function login(username: string, password: string) {
  const data = await request<{ token: string; user: { id: number; username: string } }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  localStorage.setItem('token', data.token);
  return data;
}

export async function getMe() {
  return request<{ user: { userId: number; username: string } }>('/auth/me');
}

export async function getPanelVersion(): Promise<{ version: string }> {
  return request<{ version: string }>('/system/version');
}

export async function updatePanel(): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>('/system/update', { method: 'POST' });
}

export function logout() {
  localStorage.removeItem('token');
  window.location.href = '/login';
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// Nodes
export interface NodeData {
  id: number;
  name: string;
  ip: string;
  port: number;
  token?: string;
  domain?: string;
  created_at: string;
  online?: boolean;
}

export async function getNodes(): Promise<NodeData[]> {
  return request<NodeData[]>('/nodes');
}

export async function getNode(id: number): Promise<NodeData> {
  return request<NodeData>(`/nodes/${id}`);
}

export async function createNode(data: { name?: string; ip: string; port: number; token: string; domain?: string }) {
  return request<NodeData>('/nodes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateNode(id: number, data: { name?: string; ip?: string; port?: number; token?: string; domain?: string }) {
  return request<NodeData>(`/nodes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function exportNodeProxies(nodeId: number): Promise<Blob> {
  const token = getToken();
  const response = await fetch(`${API_BASE}/nodes/${nodeId}/export`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Export failed');
  }
  return response.blob();
}

export async function importNodeProxies(nodeId: number, file: File): Promise<{ imported: number; errors: string[] }> {
  const token = getToken();
  const text = await file.text();
  const bundle = JSON.parse(text);
  const response = await fetch(`${API_BASE}/nodes/${nodeId}/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(bundle),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Import failed');
  return data;
}

export async function deleteNode(id: number) {
  return request<{ success: boolean }>(`/nodes/${id}`, { method: 'DELETE' });
}

export async function checkNodeHealth(id: number): Promise<{ online: boolean; version?: string | null }> {
  return request<{ online: boolean; version?: string | null }>(`/nodes/${id}/health`);
}

export async function checkNodeConnection(ip: string, port: number, token: string): Promise<{ online: boolean }> {
  return request<{ online: boolean }>('/nodes/check-health', {
    method: 'POST',
    body: JSON.stringify({ ip, port, token }),
  });
}

export async function updateNodeService(id: number): Promise<{ success: boolean; output?: string; error?: string }> {
  return request<{ success: boolean; output?: string; error?: string }>(`/nodes/${id}/update`, {
    method: 'POST',
  });
}

// Proxies
export interface ConnectedIpInfo {
  ip: string;
  country?: string;
  countryCode?: string;
}

export interface VpnStatusData {
  state: 'disabled' | 'connected' | 'disconnected' | 'stopped' | 'unknown';
  checkedAt: string | null;
  latencyMs?: number;
}

export interface ProxyData {
  id: string;
  name: string;
  note: string;
  port: number;
  secret: string;
  domain: string;
  containerName: string;
  status: 'running' | 'stopped' | 'paused' | 'error';
  createdAt: string;
  tag?: string;
  trafficUp: number;
  trafficDown: number;
  connectedIps: string[];
  maxConnections?: number;
  nginxPort?: number;
  listenPort?: number;
  vpnSubscription?: string;
  vpnContainerName?: string;
  vpnStatus?: VpnStatusData;
  maskHost?: string;
  natIp?: string;
  tunnelInterface?: string;
  useMiddleProxy?: boolean;
  fastMode?: boolean;
  me2dcFallback?: boolean;
  me2dcFast?: boolean;
  meKeepaliveEnabled?: boolean;
  meKeepaliveIntervalSecs?: number;
  meKeepaliveJitterSecs?: number;
  meKeepalivePayloadRandom?: boolean;
  meReconnectBackoffBaseMs?: number;
  meReconnectBackoffCapMs?: number;
  meReconnectFastRetryCount?: number;
  desyncAllFull?: boolean;
  meWriterPickMode?: string;
  meWarmupStaggerEnabled?: boolean;
  meWarmupStepDelayMs?: number;
  meWarmupStepJitterMs?: number;
  beobachten?: boolean;
  beobachtenMinutes?: number;
  beobachtenFlushSecs?: number;
  beobachtenFile?: string;
  upstreamConnectRetryAttempts?: number;
  upstreamConnectRetryBackoffMs?: number;
  tgConnect?: number;
  rstOnClose?: string;
  logLevel?: string;
  unknownDcFileLogEnabled?: boolean;
  updateEvery?: number;
  networkPrefer?: string;
  stunServers?: string[];
  serverClientMss?: number;
  censorshipTlsDomain?: string;
  censorshipTlsEmulation?: boolean;
  censorshipTlsFrontDir?: string;
  meInitRetryAttempts?: number;
}

export interface ProxyStatsData {
  vpnStatus?: VpnStatusData;
  id: string;
  containerName: string;
  status: string;
  cpuPercent: string;
  memoryUsage: string;
  memoryLimit: string;
  networkRx: string;
  networkTx: string;
  networkRxBytes: number;
  networkTxBytes: number;
  uptime: string;
  connectedIps: ConnectedIpInfo[];
}

export interface CreateProxyRequest {
  secret?: string;
  domain?: string;
  tag?: string;
  name?: string;
  note?: string;
  maxConnections?: number;
  listenPort?: number;
  vpnSubscription?: string;
  maskHost?: string;
  natIp?: string;
  tunnelInterface?: string;
  useMiddleProxy?: boolean;
  fastMode?: boolean;
  me2dcFallback?: boolean;
  me2dcFast?: boolean;
  meKeepaliveEnabled?: boolean;
  meKeepaliveIntervalSecs?: number;
  meKeepaliveJitterSecs?: number;
  meKeepalivePayloadRandom?: boolean;
  meReconnectBackoffBaseMs?: number;
  meReconnectBackoffCapMs?: number;
  meReconnectFastRetryCount?: number;
  desyncAllFull?: boolean;
  meWriterPickMode?: string;
  meWarmupStaggerEnabled?: boolean;
  meWarmupStepDelayMs?: number;
  meWarmupStepJitterMs?: number;
  beobachten?: boolean;
  beobachtenMinutes?: number;
  beobachtenFlushSecs?: number;
  beobachtenFile?: string;
  upstreamConnectRetryAttempts?: number;
  upstreamConnectRetryBackoffMs?: number;
  tgConnect?: number;
  rstOnClose?: string;
  logLevel?: string;
  unknownDcFileLogEnabled?: boolean;
  updateEvery?: number;
  networkPrefer?: string;
  stunServers?: string[];
  serverClientMss?: number;
  censorshipTlsDomain?: string;
  censorshipTlsEmulation?: boolean;
  censorshipTlsFrontDir?: string;
  meInitRetryAttempts?: number;
}

export interface UpdateProxyRequest {
  domain?: string;
  tag?: string;
  name?: string;
  note?: string;
  maxConnections?: number;
  listenPort?: number;
  vpnSubscription?: string;
  maskHost?: string;
  natIp?: string;
  tunnelInterface?: string;
  useMiddleProxy?: boolean;
  fastMode?: boolean;
  me2dcFallback?: boolean;
  me2dcFast?: boolean;
  meKeepaliveEnabled?: boolean;
  meKeepaliveIntervalSecs?: number;
  meKeepaliveJitterSecs?: number;
  meKeepalivePayloadRandom?: boolean;
  meReconnectBackoffBaseMs?: number;
  meReconnectBackoffCapMs?: number;
  meReconnectFastRetryCount?: number;
  desyncAllFull?: boolean;
  meWriterPickMode?: string;
  meWarmupStaggerEnabled?: boolean;
  meWarmupStepDelayMs?: number;
  meWarmupStepJitterMs?: number;
  beobachten?: boolean;
  beobachtenMinutes?: number;
  beobachtenFlushSecs?: number;
  beobachtenFile?: string;
  upstreamConnectRetryAttempts?: number;
  upstreamConnectRetryBackoffMs?: number;
  tgConnect?: number;
  rstOnClose?: string;
  logLevel?: string;
  unknownDcFileLogEnabled?: boolean;
  updateEvery?: number;
  networkPrefer?: string;
  stunServers?: string[];
  serverClientMss?: number;
  censorshipTlsDomain?: string;
  censorshipTlsEmulation?: boolean;
  censorshipTlsFrontDir?: string;
  meInitRetryAttempts?: number;
}

export interface StatsSnapshotData {
  timestamp: string;
  cpuPercent: number;
  memoryBytes: number;
  networkRxBytes: number;
  networkTxBytes: number;
  connectedCount: number;
}

export interface IpHistoryEntryData {
  ip: string;
  country?: string;
  countryCode?: string;
  firstSeen: string;
  lastSeen: string;
}

export async function getProxies(nodeId: number): Promise<ProxyData[]> {
  return request<ProxyData[]>(`/nodes/${nodeId}/proxies`);
}

export async function getAllProxies(): Promise<{ nodeId: number; nodeName: string; nodeIp: string; proxies: ProxyData[] }[]> {
  return request<{ nodeId: number; nodeName: string; nodeIp: string; proxies: ProxyData[] }[]>('/proxies/all');
}

export async function createProxy(nodeId: number, data: CreateProxyRequest) {
  return request<ProxyData>(`/nodes/${nodeId}/proxies`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateProxy(nodeId: number, proxyId: string, data: UpdateProxyRequest) {
  return request<ProxyData>(`/nodes/${nodeId}/proxies/${proxyId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteProxy(nodeId: number, proxyId: string) {
  return request<{ success: boolean }>(`/nodes/${nodeId}/proxies/${proxyId}`, { method: 'DELETE' });
}

export async function getProxyStats(nodeId: number, proxyId: string): Promise<ProxyStatsData> {
  return request<ProxyStatsData>(`/nodes/${nodeId}/proxies/${proxyId}/stats`);
}

export async function getProxyLink(nodeId: number, proxyId: string): Promise<string> {
  const data = await request<{ link: string }>(`/nodes/${nodeId}/proxies/${proxyId}/link`);
  return data.link;
}

export async function pauseProxy(nodeId: number, proxyId: string): Promise<ProxyData> {
  return request<ProxyData>(`/nodes/${nodeId}/proxies/${proxyId}/pause`, { method: 'POST' });
}

export async function unpauseProxy(nodeId: number, proxyId: string): Promise<ProxyData> {
  return request<ProxyData>(`/nodes/${nodeId}/proxies/${proxyId}/unpause`, { method: 'POST' });
}

// Node domains
export async function getNodeDomains(nodeId: number): Promise<string[]> {
  const data = await request<{ domains: string[] }>(`/nodes/${nodeId}/domains`);
  return data.domains;
}

export async function updateNodeDomains(nodeId: number, domains: string[]): Promise<string[]> {
  const data = await request<{ domains: string[] }>(`/nodes/${nodeId}/domains`, {
    method: 'PUT',
    body: JSON.stringify({ domains }),
  });
  return data.domains;
}

// Node IP blacklist
export async function getNodeBlacklist(nodeId: number): Promise<string[]> {
  const data = await request<{ ips: string[] }>(`/nodes/${nodeId}/blacklist`);
  return data.ips;
}

export async function updateNodeBlacklist(nodeId: number, ips: string[]): Promise<string[]> {
  const data = await request<{ ips: string[] }>(`/nodes/${nodeId}/blacklist`, {
    method: 'PUT',
    body: JSON.stringify({ ips }),
  });
  return data.ips;
}

// Stats history
export async function getProxyStatsHistory(nodeId: number, proxyId: string): Promise<StatsSnapshotData[]> {
  return request<StatsSnapshotData[]>(`/nodes/${nodeId}/proxies/${proxyId}/stats-history`);
}

// IP history
export async function getProxyIpHistory(nodeId: number, proxyId: string): Promise<IpHistoryEntryData[]> {
  return request<IpHistoryEntryData[]>(`/nodes/${nodeId}/proxies/${proxyId}/ip-history`);
}

// Clear proxy history
export async function clearProxyHistory(nodeId: number, proxyId: string): Promise<void> {
  await request(`/nodes/${nodeId}/proxies/${proxyId}/clear-history`, { method: 'DELETE' });
}
