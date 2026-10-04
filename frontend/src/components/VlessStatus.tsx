import { useEffect, useState } from 'react';
import { Label, Tooltip } from '@gravity-ui/uikit';
import type { VpnStatusData } from '../api';
import { getVlessState } from '../utils/vlessStatus';

const labels = {
  disabled: 'не используется',
  connected: 'соединение проверено',
  disconnected: 'проверка не прошла',
  stopped: 'контейнер остановлен',
  unknown: 'статус неизвестен',
};

export default function VlessStatus({ status }: { status?: VpnStatusData }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(timer);
  }, []);
  const state = getVlessState(status, now);
  const checkedAt = status?.checkedAt ? Date.parse(status.checkedAt) : NaN;
  const theme = state === 'connected' ? 'success' : state === 'disconnected' ? 'danger' : state === 'stopped' ? 'warning' : 'normal';
  const content = (
    <div>
      <div>Проверяется HTTPS-запрос к внешнему ресурсу через VLESS-туннель.</div>
      <div>Результат не подтверждает постоянную сессию или общую работоспособность Telegram.</div>
      <div>{Number.isFinite(checkedAt) ? `Последняя проверка: ${new Date(checkedAt).toLocaleString()}` : 'Проверка ещё не выполнена или не поддерживается нодой.'}</div>
      {state === 'unknown' && status?.state !== 'unknown' && Number.isFinite(checkedAt) && <div>Результат проверки устарел или время проверки некорректно.</div>}
      {state === 'connected' && status?.latencyMs !== undefined && <div>Время запроса: {status.latencyMs} мс</div>}
    </div>
  );
  return <Tooltip content={content}><Label theme={theme} size="s">{labels[state]}</Label></Tooltip>;
}
