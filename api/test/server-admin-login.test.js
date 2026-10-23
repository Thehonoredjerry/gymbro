/* GymBro: the website is only the admin panel, opened with one password the owner sets on the
   server (ADMIN_PASSWORD). The right password signs in to a built-in admin account; a wrong one
   is a 401 and counts toward the same lockout as any password; without ADMIN_PASSWORD the route
   is not there. Real server.js in a child, same harness as server-admin-create-user.test.js. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'http://localhost:8080';
const PANEL_PW = 'open sesame 42';

async function startServer(t, env = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-al-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN, RP_ID: 'localhost', PASSWORD_LOGIN: '1', ...env },
  });
  const h = { log: '' };
  child.stdout.on('data', d => h.log += d);
  child.stderr.on('data', d => h.log += d);
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(dataDir, { recursive: true, force: true }); });
  h.port = await boundPort(child, () => h.log);
  h.api = `http://127.0.0.1:${h.port}`;
  h.login = async password => {
    const r = await fetch(h.api + '/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN }, body: JSON.stringify({ password }) });
    return { status: r.status, body: await r.json(), cookie: r.headers.get('set-cookie') };
  };
  h.db = () => JSON.parse(fs.readFileSync(path.join(dataDir, 'db.json'), 'utf8'));
  return h;
}

test('the admin password opens the panel as an admin, and the same account every time', async t => {
  const h = await startServer(t, { ADMIN_PASSWORD: PANEL_PW });
  const a = await h.login(PANEL_PW);
  assert.equal(a.status, 200, JSON.stringify(a.body));
  assert.equal(a.body.user.admin, true);
  assert.match(a.cookie || '', /gymsid=/);
  const me = await fetch(h.api + '/api/admin/users', { headers: { Cookie: a.cookie.split(';')[0] } });
  assert.equal(me.status, 200, 'the session is an admin one');
  const b = await h.login(PANEL_PW);
  assert.equal(b.body.user.id, a.body.user.id);
  assert.equal(h.db().users.length, 1);
});

test('a wrong admin password is refused and makes no account', async t => {
  const h = await startServer(t, { ADMIN_PASSWORD: PANEL_PW });
  const r = await h.login('nope nope nope');
  assert.equal(r.status, 401);
  assert.equal(r.cookie, null);
  assert.equal((await h.login('')).status, 400);
  let users = 0; try { users = h.db().users.length } catch {}
  assert.equal(users, 0);
});

test('without ADMIN_PASSWORD there is no admin sign-in', async t => {
  const h = await startServer(t);
  assert.equal((await h.login(PANEL_PW)).status, 404);
});
