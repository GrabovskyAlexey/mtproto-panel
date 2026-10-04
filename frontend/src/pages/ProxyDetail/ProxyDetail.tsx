import { useNavigate } from 'react-router-dom';
import { Button, Card, Loader, Label, Alert, Tooltip } from '@gravity-ui/uikit';
import { Line } from 'react-chartjs-2';
import zoomPlugin from 'chartjs-plugin-zoom';
import 'chartjs-adapter-date-fns';
import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
} from 'chart.js';
import { ConnectedIpInfo } from '../../api';
import FlagIcon from '../../components/FlagIcon';
import VlessStatus from '../../components/VlessStatus';
import { useProxyDetail } from '../../hooks/useProxyDetail';
import { buildChartOptions, buildChartData } from '../../utils/chart';
import s from './ProxyDetail.module.scss';

ChartJS.register(TimeScale, LinearScale, PointElement, LineElement, Title, ChartTooltip, Legend, Filler, zoomPlugin);

export default function ProxyDetail() {
  const navigate = useNavigate();
  const {
    nodeId, node, stats, statsHistory, ipHistory, blacklist,
    loading, error, setError, copied, togglingPause, clearing, nodeGeo, chartRef,
    connectedIpSet, statusTheme, statusLabel,
    handleCopyLink, handleTogglePause, handleClearHistory,
  } = useProxyDetail();

  if (loading) {
    return <div className={s.loader}><Loader size="l" /></div>;
  }

  return (
    <>
      <div className={s.header}>
        <Button view="flat" onClick={() => navigate(`/nodes/${nodeId}`)}>← Назад</Button>
        {stats && (
          <>
            <h2 style={{ margin: 0 }}>{stats.id}</h2>
            <Label theme={statusTheme} size="s">{statusLabel}</Label>
          </>
        )}
        {node && (
          <Label theme="info" size="s">
            {nodeGeo && <FlagIcon code={nodeGeo} />}{node.name} ({node.ip})
          </Label>
        )}
      </div>

      {error && (
        <div className={s.errorWrap}>
          <Alert theme="danger" message={error} onClose={() => setError('')} />
        </div>
      )}

      {stats && (
        <Card view="outlined" className={s.statsCard}>
          <h3>Статистика в реальном времени</h3>
          <div className={s.statsGrid}>
            <div className={s.statItem}><div className={s.statValue}>{stats.cpuPercent}</div><div className={s.statLabel}>CPU</div></div>
            <div className={s.statItem}><div className={s.statValue}>{stats.memoryUsage}</div><div className={s.statLabel}>Память</div></div>
            <div className={s.statItem}><div className={s.statValue}>{stats.networkRx}</div><div className={s.statLabel}>Вход</div></div>
            <div className={s.statItem}><div className={s.statValue}>{stats.networkTx}</div><div className={s.statLabel}>Исход</div></div>
            <div className={s.statItem}><div className={s.statValue}>{stats.uptime}</div><div className={s.statLabel}>Аптайм</div></div>
            <div className={s.statItem}><div className={s.statValue}>{stats.connectedIps?.length || 0}</div><div className={s.statLabel}>IP</div></div>
            {stats.vpnStatus && stats.vpnStatus.state !== 'disabled' && (
              <div className={s.statItem}>
                <div className={s.statValue}><VlessStatus status={stats.vpnStatus} /></div>
                <div className={s.statLabel}>VLESS</div>
              </div>
            )}
          </div>

          {stats.connectedIps && stats.connectedIps.length > 0 && (
            <div className={s.connectedSection}>
              <div className={s.connectedTitle}>Сейчас подключены:</div>
              <div className={s.connectedList}>
                {stats.connectedIps.map((info: ConnectedIpInfo) => (
                  <Label key={info.ip} size="xs" theme="success">
                    {info.countryCode && <FlagIcon code={info.countryCode} size={16} />}{info.ip}
                  </Label>
                ))}
              </div>
            </div>
          )}

          <div className={s.actions}>
            <Button view="action" size="s" onClick={handleCopyLink}>
              {copied ? '✓ Скопировано!' : 'Копировать ссылку'}
            </Button>
            {(stats.status === 'running' || stats.status === 'paused') && (
              <Button view="outlined" size="s" onClick={handleTogglePause} loading={togglingPause}>
                {stats.status === 'paused' ? 'Запустить' : 'Пауза'}
              </Button>
            )}
          </div>
        </Card>
      )}

      {statsHistory.length > 1 && (
        <Card view="outlined" className={s.chartCard}>
          <div className={s.chartHeader}>
            <h3>Статистика</h3>
            <div className={s.chartButtons}>
              <Button size="xs" view="outlined" onClick={() => chartRef.current?.resetZoom()}>Сбросить зум</Button>
              <Button size="xs" view="outlined-danger" onClick={handleClearHistory} loading={clearing}>Очистить историю</Button>
            </div>
          </div>
          <div className={s.chartHint}>Колёсико мыши — приближение, зажатая ЛКМ — прокрутка. Клик по легенде — скрыть/показать линию.</div>
          <div className={s.chartWrap}>
            <Line ref={chartRef} data={buildChartData(statsHistory)} options={buildChartOptions()} />
          </div>
        </Card>
      )}

      {ipHistory.length > 0 && (
        <Card view="outlined" className={s.ipCard}>
          <h3>История IP ({ipHistory.length})</h3>
          <div className={s.ipList}>
            {ipHistory.map((entry) => {
              const isConnected = connectedIpSet.has(entry.ip);
              const isBlacklisted = blacklist.has(entry.ip);
              const theme = isConnected ? 'success' : isBlacklisted ? 'danger' : 'info';
              const tooltipContent = (
                <div className={s.ipTooltip}>
                  {entry.country && <div>Страна: {entry.country}</div>}
                  <div>Первое подключение: {new Date(entry.firstSeen).toLocaleString('ru-RU')}</div>
                  <div>Последнее: {new Date(entry.lastSeen).toLocaleString('ru-RU')}</div>
                  {isBlacklisted && <div className={s.ipTooltipBlocked}>⛔ В чёрном списке</div>}
                </div>
              );
              return (
                <Tooltip key={entry.ip} content={tooltipContent} placement="top" openDelay={300}>
                  <div className={s.ipItem} tabIndex={0}>
                    <Label theme={theme} size="s">
                      {entry.countryCode && <FlagIcon code={entry.countryCode} size={16} />}{entry.ip}
                    </Label>
                  </div>
                </Tooltip>
              );
            })}
          </div>
          <div className={s.ipLegend}>
            <span><Label theme="success" size="xs">●</Label> подключён</span>
            <span><Label theme="info" size="xs">●</Label> отключён</span>
            <span><Label theme="danger" size="xs">●</Label> заблокирован</span>
          </div>
        </Card>
      )}
    </>
  );
}
