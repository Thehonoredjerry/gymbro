/* GymBro: an admin can make a friend's account directly — a name and a starting password — besides
   handing out invite codes. The friend then signs in with both. Real server.js in a child, same
   harness as server-admin-delete.test.js. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { boundPort } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SECRET = crypto.randomBytes(32).toString('hex');
const mintSession = uid => {
  const payload = `${uid}:${Date.now() + 86400000}:0`;
  return payload + '.' + crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
};
const ADMIN = 'u_adm_1', FRIEND = 'u_fr_1';
const ORIGIN = 'http://localhost:8080';
const as = uid => ({ Cookie: `gymsid=${mintSession(uid)}`, 'Content-Type': 'application/json', Origin: ORIGIN });
const GOOD_PW = 'correct horse battery';

async function startServer(t, { password = true } = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-mk-'));
  fs.writeFileSync(path.join(dataDir, 'secret'), SECRET, { mode: 0o600 });
  fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify({
    users: [
      { id: ADMIN, name: 'Adminna', created: new Date().toISOString(), admin: true },
      { id: FRIEND, name: 'Taken', created: new Date().toISOString(), pw: { h: 'x', set: new Date().toISOString() } },  // a name counts as taken once it signs in with a password
    ],
    creds: [], subs: [], invites: [],
  }));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dataDir, ORIGIN, RP_ID: 'localhost', PASSWORD_LOGIN: password ? '1' : '0', INVITE_ONLY: '1' },
  });
  const h = { log: '', dataDir };
  child.stdout.on('data', d => h.log += d);
  child.stderr.on('data', d => h.log += d);
  t.after(() => { child.kill('SIGKILL'); fs.rmSync(dataDir, { recursive: true, force: true }); });
  h.port = await boundPort(child, () => h.log);
  h.api = `http://127.0.0.1:${h.port}`;
  h.post = async (p, body, headers) => {
    const r = await fetch(h.api + p, { method: 'POST', headers, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json() };
  };
  h.create = (body, uid = ADMIN) => h.post('/api/admin/users/new', body, as(uid));
  h.db = () => JSON.parse(fs.readFileSync(path.join(h.dataDir, 'db.json'), 'utf8'));
  return h;
}

test('an admin creates an account that then signs in with its password', async t => {
  const h = await startServer(t);
  const res = await h.create({ name: 'Somchai', password: GOOD_PW });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.user.name, 'Somchai');
  const made = h.db().users.find(u => u.name === 'Somchai');
  assert.ok(made && made.pw?.h, 'stored with a password hash');
  assert.equal(made.admin, undefined, 'not an admin');
  assert.equal(made.createdBy, ADMIN);
  assert.ok(!JSON.stringify(h.db()).includes(GOOD_PW), 'the password itself is never stored');
  const login = await h.post('/api/login/password', { name: 'Somchai', password: GOOD_PW }, { 'Content-Type': 'application/json', Origin: ORIGIN });
  assert.equal(login.status, 200, JSON.stringify(login.body));
});

test('refuses a non-admin, a taken name and a weak password', async t => {
  const h = await startServer(t);
  assert.equal((await h.create({ name: 'Nope', password: GOOD_PW }, FRIEND)).status, 403);
  const taken = await h.create({ name: 'taken', password: GOOD_PW })
  assert.equal(taken.status, 409); assert.equal(taken.body.code, 'name-taken');
  const weak = await h.create({ name: 'Weak', password: 'short' });
  assert.equal(weak.status, 400); assert.equal(weak.body.code, 'too-short');
  assert.equal((await h.create({ name: '', password: GOOD_PW })).status, 400);
  assert.deepEqual(h.db().users.map(u => u.name), ['Adminna', 'Taken']);
});

test('is not there while password sign-in is off', async t => {
  const h = await startServer(t, { password: false });
  assert.equal((await h.create({ name: 'Somchai', password: GOOD_PW })).status, 404);
});
