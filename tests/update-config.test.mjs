import assert from 'node:assert/strict';
import test from 'node:test';
import { migratePanelConfig } from '../scripts/migrate-panel-config.mjs';

const override = 'version: "3.8"\n\nservices:\n  frontend:\n    ports:\n      - "89:443"\n    volumes:\n      - ./nginx-ssl.conf:/etc/nginx/conf.d/default.conf:ro\n      - ./ssl/fullchain.pem:/etc/ssl/certs/fullchain.pem:ro\n      - ./ssl/privkey.pem:/etc/ssl/private/privkey.pem:ro\n';

test('legacy SSL keeps public port, credentials and certificate mounts', () => {
  const env = 'PORT=18080\nDB_PASSWORD=existing-secret\nJWT_SECRET=existing-jwt\n';
  const result = migratePanelConfig(env, override);
  assert.match(result.env, /^PORT=89$/m);
  assert.match(result.env, /^FRONTEND_PORT=443$/m);
  assert.ok(result.env.includes('DB_PASSWORD=existing-secret\nJWT_SECRET=existing-jwt\n'));
  assert.ok(result.override.includes('      - ./ssl/fullchain.pem:/etc/ssl/certs/fullchain.pem:ro'));
  assert.ok(!result.override.includes('ports:'));
  assert.deepEqual(migratePanelConfig(result.env, result.override), { env: result.env, override: result.override, changed: false });
});

test('HTTP and already migrated SSL are unchanged', () => {
  assert.equal(migratePanelConfig('PORT=89\n', undefined).changed, false);
  assert.equal(migratePanelConfig('PORT=89\nFRONTEND_PORT=443\n', override.replace('    ports:\n      - "89:443"\n', '')).changed, false);
});

test('ambiguous custom SSL ports fail instead of silently discarding settings', () => {
  assert.throws(() => migratePanelConfig('PORT=18080\n', override.replace('"89:443"', '"89:443"\n      - "80:80"')), /нестандартная/);
  assert.throws(() => migratePanelConfig('PORT=18080\n', override.replace('89:443', '70000:443')), /порт/);
});

test('migration preserves Windows line endings', () => {
  const result = migratePanelConfig('PORT=18080\r\nDB_PASSWORD=keep\r\n', override.replaceAll('\n', '\r\n'));
  assert.equal(result.env, 'PORT=89\r\nDB_PASSWORD=keep\r\nFRONTEND_PORT=443\r\n');
  assert.ok(!/(?<!\r)\n/.test(result.override));
});
