import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { copyToClipboard } from '../utils/clipboard';
import {
  getNode,
  getProxies,
  deleteProxy,
  getProxyLink,
  getNodeDomains,
  updateNodeDomains,
  getNodeBlacklist,
  updateNodeBlacklist,
  exportNodeProxies,
  importNodeProxies,
  NodeData,
  ProxyData,
} from '../api';

export function useNodeDetail() {
  const { id } = useParams<{ id: string }>();
  const nodeId = parseInt(id || '0', 10);

  const [node, setNode] = useState<NodeData | null>(null);
  const [proxies, setProxies] = useState<ProxyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editProxy, setEditProxy] = useState<ProxyData | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [domainsText, setDomainsText] = useState('');
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [domainsSaving, setDomainsSaving] = useState(false);
  const [domainsLoaded, setDomainsLoaded] = useState(false);
  const [blacklistText, setBlacklistText] = useState('');
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [blacklistSaving, setBlacklistSaving] = useState(false);
  const [blacklistLoaded, setBlacklistLoaded] = useState(false);
  const [nodeGeo, setNodeGeo] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; errors: string[] } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [nodeData, proxiesData] = await Promise.all([
        getNode(nodeId),
        getProxies(nodeId),
      ]);
      setNode(nodeData);
      setProxies(proxiesData);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [nodeId]);

  useEffect(() => {
    loadData();
    getNode(nodeId).then((n) => {
      fetch(`http://ip-api.com/json/${n.ip}?fields=countryCode`)
        .then((r) => r.json())
        .then((d: any) => { if (d.countryCode) setNodeGeo(d.countryCode); })
        .catch(() => {});
    }).catch(() => {});

    setDomainsLoading(true);
    getNodeDomains(nodeId)
      .then((domains) => { setDomainsText(domains.join('\n')); setDomainsLoaded(true); })
      .catch(() => {})
      .finally(() => setDomainsLoading(false));

    setBlacklistLoading(true);
    getNodeBlacklist(nodeId)
      .then((ips) => { setBlacklistText(ips.join('\n')); setBlacklistLoaded(true); })
      .catch(() => {})
      .finally(() => setBlacklistLoading(false));
  }, [loadData]);

  useEffect(() => {
    const timer = window.setInterval(() => { void loadData(); }, 30_000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const handleDelete = async (proxyId: string) => {
    if (!confirm('Удалить этот прокси?')) return;
    try {
      await deleteProxy(nodeId, proxyId);
      setProxies((prev) => prev.filter((p) => p.id !== proxyId));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleCopyLink = async (proxyId: string) => {
    try {
      const link = await getProxyLink(nodeId, proxyId);
      await copyToClipboard(link);
      setCopiedId(proxyId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSaveDomains = async () => {
    setDomainsSaving(true);
    try {
      const domains = domainsText.split('\n').map((d) => d.trim()).filter((d) => d.length > 0);
      const saved = await updateNodeDomains(nodeId, domains);
      setDomainsText(saved.join('\n'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDomainsSaving(false);
    }
  };

  const handleSaveBlacklist = async () => {
    setBlacklistSaving(true);
    try {
      const ips = blacklistText.split('\n').map((ip) => ip.trim()).filter((ip) => ip.length > 0);
      const saved = await updateNodeBlacklist(nodeId, ips);
      setBlacklistText(saved.join('\n'));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBlacklistSaving(false);
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const blob = await exportNodeProxies(nodeId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proxies-node-${nodeId}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setExportLoading(false);
    }
  };

  const handleImport = async (file: File) => {
    setImportLoading(true);
    setImportResult(null);
    try {
      const result = await importNodeProxies(nodeId, file);
      setImportResult(result);
      if (result.imported > 0) await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setImportLoading(false);
    }
  };

  return {
    nodeId, node, proxies, loading, error, setError,
    showAdd, setShowAdd, editProxy, setEditProxy, copiedId,
    domainsText, setDomainsText, domainsLoading, domainsSaving, domainsLoaded,
    blacklistText, setBlacklistText, blacklistLoading, blacklistSaving, blacklistLoaded,
    nodeGeo, loadData, handleDelete, handleCopyLink, handleSaveDomains, handleSaveBlacklist,
    exportLoading, importLoading, importResult, handleExport, handleImport,
  };
}
