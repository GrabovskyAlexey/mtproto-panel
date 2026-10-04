import { useState, useEffect, useCallback } from 'react';
import { copyToClipboard } from '../utils/clipboard';
import {
  getAllProxies,
  getNodes,
  deleteProxy,
  getProxyLink,
  NodeData,
  ProxyData,
} from '../api';

interface NodeProxies {
  nodeId: number;
  nodeName: string;
  nodeIp: string;
  proxies: ProxyData[];
}

export function useProxies() {
  const [nodeProxies, setNodeProxies] = useState<NodeProxies[]>([]);
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editProxy, setEditProxy] = useState<{ proxy: ProxyData; nodeId: number } | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [filterNodeId, setFilterNodeId] = useState<string[]>(['all']);

  const loadData = useCallback(async () => {
    try {
      const [allProxies, nodesList] = await Promise.all([
        getAllProxies(),
        getNodes(),
      ]);
      setNodeProxies(allProxies);
      setNodes(nodesList);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const timer = window.setInterval(() => { void loadData(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const handleDelete = async (nodeId: number, proxyId: string) => {
    if (!confirm('Удалить этот прокси?')) return;
    try {
      await deleteProxy(nodeId, proxyId);
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCopyLink = async (nodeId: number, proxyId: string) => {
    try {
      const link = await getProxyLink(nodeId, proxyId);
      await copyToClipboard(link);
      setCopiedId(proxyId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const selectedNodeId = filterNodeId[0] || 'all';

  const allProxies = nodeProxies
    .filter((np) => selectedNodeId === 'all' || np.nodeId.toString() === selectedNodeId)
    .flatMap((np) =>
      np.proxies.map((p) => ({ ...p, nodeId: np.nodeId, nodeName: np.nodeName, nodeIp: np.nodeIp }))
    );

  const totalProxies = nodeProxies.reduce((sum, np) => sum + np.proxies.length, 0);

  const filterOptions = [
    { value: 'all', content: 'Все ноды' },
    ...nodes.map((n) => ({ value: n.id.toString(), content: `${n.name} (${n.ip})` })),
  ];

  return {
    nodes, loading, error, setError,
    showAdd, setShowAdd, editProxy, setEditProxy, copiedId,
    filterNodeId, setFilterNodeId, filterOptions,
    allProxies, totalProxies,
    loadData, handleDelete, handleCopyLink,
  };
}
