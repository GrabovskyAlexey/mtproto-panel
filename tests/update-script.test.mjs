import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const bash = process.platform === 'win32' && existsSync('C:/Program Files/Git/bin/bash.exe')
  ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
const script = readFileSync(new URL('../update.sh', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const mocks = `
function [() {
  if builtin [ "$1" = '!' ]; then shift; ! '[' "$@"; return; fi
  if builtin [ "$1" = '-f' ] && builtin [ "$2" = '.env' ]; then return 0; fi
  if builtin [ "$1" = '-f' ] && builtin [ "$2" = '/.dockerenv' ]; then builtin [ "$MOCK_IN_CONTAINER" = '1' ]; return; fi
  builtin [ "$@"
}
id() { echo 0; }
sleep() { :; }
`;
// Log mock calls to stderr so command substitutions see only realistic data.
const harness = mocks + `git() {
  { printf 'CALL git'; printf ' <%s>' "$@"; printf '\\n'; } >&2
  case "$*" in
    *rev-parse*) pwd ;;
    'remote show origin') echo 'HEAD branch: master' ;;
  esac
}
docker() {
  { printf 'CALL docker'; printf ' <%s>' "$@"; printf '\\n'; } >&2
  if builtin [ "$*" = 'compose pull' ]; then return "$MOCK_PULL_EXIT"; fi
  if builtin [ "$*" = 'compose build' ]; then return "$MOCK_BUILD_EXIT"; fi
  if builtin [ "$1" = 'inspect' ]; then echo '/opt/mtproto-panel'; fi
  if builtin [ "$*" = 'compose ps --status running --services' ]; then printf 'db\\nbackend\\nfrontend\\n'; fi
}
`;

function run(env = {}, args = []) {
  return spawnSync(bash, ['-c', harness + script, 'bash', ...args], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8',
    env: { ...process.env, UPDATE_WORKER: '1', MOCK_PULL_EXIT: '0', MOCK_BUILD_EXIT: '0', ...env },
  });
}

test('installer and updater have valid Bash syntax', () => {
  for (const file of ['install.sh', 'update.sh']) {
    const result = spawnSync(bash, ['-n'], {
      input: readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n'), encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.error?.message || result.stderr);
  }
});

test('update migrates origin and pulls before replacing services, without down or stash', () => {
  const result = run();
  assert.equal(result.status, 0, result.error?.message || result.stderr + result.stdout);
  assert.match(result.stderr, /remote> <set-url> <origin> <https:\/\/github.com\/GrabovskyAlexey\/mtproto-panel.git>/);
  assert.ok(result.stderr.indexOf('<remote> <set-url>') < result.stderr.indexOf('<fetch>'));
  assert.ok(result.stderr.indexOf('<compose> <pull>') < result.stderr.indexOf('<compose> <up>'));
  assert.match(result.stderr, /<compose> <run> <.*migrate-panel-config/);
  assert.match(result.stderr, /<--workdir> <\/app\/project>/);
  assert.doesNotMatch(result.stderr, /<down>|<stash>/);
});

test('API update launches a detached worker with host paths and forwards branch', () => {
  const result = run({ MOCK_IN_CONTAINER: '1', UPDATE_WORKER: '0' }, ['--b=dev']);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stderr, /<pull> <ghcr.io\/grabovskyalexey\/mtproto-panel-backend:latest>/);
  assert.match(result.stderr, /<run> <--detach>/);
  assert.match(result.stderr, /<--network> <host>/);
  assert.match(result.stderr, /<--volume> <\/opt\/mtproto-panel:\/opt\/mtproto-panel>/);
  assert.match(result.stderr, /<UPDATE_WORKER=1>.*<\.\/update.sh> <--b=dev>/);
  assert.doesNotMatch(result.stderr, /<compose> <up>|<down>/);
});

test('failed pull builds locally; failed build leaves running services alone', () => {
  const fallback = run({ MOCK_PULL_EXIT: '1' });
  assert.equal(fallback.status, 0, fallback.stderr + fallback.stdout);
  assert.match(fallback.stderr, /<compose> <build>/);
  const failure = run({ MOCK_PULL_EXIT: '1', MOCK_BUILD_EXIT: '1' });
  assert.notEqual(failure.status, 0);
  assert.doesNotMatch(failure.stderr, /<up>|<down>/);
});
