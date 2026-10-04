import assert from 'node:assert/strict';
import test from 'node:test';
import { getVlessState } from '../src/utils/vlessStatus.ts';

const now = Date.parse('2026-10-04T12:00:00Z');
test('fresh successful probe is connected', () => {
  assert.equal(getVlessState({ state: 'connected', checkedAt: '2026-10-04T11:59:30Z' }, now), 'connected');
});
test('stale, missing and invalid timestamps cannot show successful connectivity', () => {
  for (const checkedAt of ['2026-10-04T11:58:29Z', null, 'invalid', '2026-10-04T12:01:00Z']) {
    assert.equal(getVlessState({ state: 'connected', checkedAt }, now), 'unknown');
  }
});
test('fresh failed probe and stopped container stay distinct', () => {
  assert.equal(getVlessState({ state: 'disconnected', checkedAt: '2026-10-04T11:59:59Z' }, now), 'disconnected');
  assert.equal(getVlessState({ state: 'stopped', checkedAt: '2026-10-04T11:59:59Z' }, now), 'stopped');
  assert.equal(getVlessState({ state: 'stopped', checkedAt: '2026-10-04T11:58:00Z' }, now), 'unknown');
});
test('legacy node without probe status is unknown', () => {
  assert.equal(getVlessState(undefined, now), 'unknown');
});
