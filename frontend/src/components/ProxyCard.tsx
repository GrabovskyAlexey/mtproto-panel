import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Label, DropdownMenu } from '@gravity-ui/uikit';
import { pauseProxy, unpauseProxy, ProxyData } from '../api';
import { formatBytes } from '../utils/format';
import VlessStatus from './VlessStatus';
import s from './ProxyCard.module.scss';

interface Props {
  proxy: ProxyData;
  nodeId: number;
  nodeName?: string;
  copied: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
  onStatusChange?: () => void;
}

export default function ProxyCard({ proxy, nodeId, nodeName, copied, onEdit, onDelete, onCopyLink, onStatusChange }: Props) {
  const navigate = useNavigate();
  const [togglingPause, setTogglingPause] = useState(false);

  const statusTheme = proxy.status === 'running' ? 'success' : proxy.status === 'stopped' || proxy.status === 'paused' ? 'warning' : 'danger';
  const statusLabel = proxy.status === 'running' ? 'работает' : proxy.status === 'paused' ? 'пауза' : proxy.status === 'stopped' ? 'остановлен' : 'ошибка';

  const handleTogglePause = async () => {
    setTogglingPause(true);
    try {
      if (proxy.status === 'paused') {
        await unpauseProxy(nodeId, proxy.id);
      } else {
        await pauseProxy(nodeId, proxy.id);
      }
      onStatusChange?.();
    } catch (err) {
      console.error('Failed to toggle pause:', err);
    } finally {
      setTogglingPause(false);
    }
  };

  const handleCardClick = () => {
    navigate(`/nodes/${nodeId}/proxy/${proxy.id}`);
  };

  const stopProp = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  const menuItems = [
    { text: 'Редактировать', action: () => onEdit() },
    ...(proxy.status === 'running' || proxy.status === 'paused'
      ? [{
          text: proxy.status === 'paused' ? 'Запустить' : 'Пауза',
          action: () => handleTogglePause(),
        }]
      : []),
    { text: 'Удалить', action: () => onDelete(), theme: 'danger' as const },
  ];

  return (
    <Card type="action" view="outlined" className={s.card} onClick={handleCardClick}>
      <div className={s.header}>
        <span className={s.name}>{proxy.name || `Proxy ${proxy.id}`}</span>
        <Label theme={statusTheme} size="s">
          {statusLabel}
        </Label>
      </div>

      {proxy.note && (
        <div className={s.note}>{proxy.note}</div>
      )}

      {nodeName && (
        <div className={s.field}>
          <span className={s.label}>Нода</span>
          <span>{nodeName}</span>
        </div>
      )}
      <div className={s.field}>
        <span className={s.label}>Порт</span>
        <span>{proxy.listenPort || proxy.nginxPort || proxy.port}</span>
      </div>
      <div className={s.field}>
        <span className={s.label}>Домен</span>
        <span>{proxy.domain}</span>
      </div>
      {(proxy.vpnSubscription || proxy.vpnContainerName || (proxy.vpnStatus && proxy.vpnStatus.state !== 'disabled')) && (
        <div className={s.field}>
          <span className={s.label}>VLESS</span>
          <VlessStatus status={proxy.vpnStatus} />
        </div>
      )}
      <div className={s.field}>
        <span className={s.label}>Трафик ↑</span>
        <span>{formatBytes(proxy.trafficUp || 0)}</span>
      </div>
      <div className={s.field}>
        <span className={s.label}>Трафик ↓</span>
        <span>{formatBytes(proxy.trafficDown || 0)}</span>
      </div>
      {proxy.connectedIps && proxy.connectedIps.length > 0 && (
        <div className={s.field}>
          <span className={s.label}>Подключения</span>
          <span>{proxy.connectedIps.length}</span>
        </div>
      )}

      <div className={s.actions}>
        <span onClick={(e) => e.stopPropagation()}>
          <DropdownMenu
            size="s"
            items={menuItems}
          />
        </span>
        <Button
          view="action"
          size="s"
          onClick={stopProp(onCopyLink)}
        >
          {copied ? '✓ Скопировано!' : 'Ссылка'}
        </Button>
      </div>
    </Card>
  );
}
