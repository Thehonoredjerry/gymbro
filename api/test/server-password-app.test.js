/* The GymBro app signs in with a name and a password from its WebView, whose origin is never
   ORIGIN: those two routes answer it with a bearer token (the app has no cookie jar of its own on
   another origin), and accept it only from the two Capacitor origins. A browser keeps the cookie. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../password.js';
import { boundPort } from './helpers.mjs';

const API = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'http://localhost:8080';
const PW = 'correct horse battery';
let child, base;

before(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gym-pwapp-'));
  fs.writeFileSync(path.join(dir, 'secret'), crypto.randomBytes(32).toString('hex'), { mode: 0o600 });
  const created = new Date().toISOString();
  fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify({
    users: [{ id: 'u_app_1', name: 'Mali', created, pw: { h: await hashPassword(PW), set: created } }],
    creds: [], subs: [], invites: [{ code: 'FRIEND1', created, by: 'u_app_1' }]
  }));
  child = spawn(process.execPath, ['server.js'], {
    cwd: API, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT: '0', DATA_DIR: dir, ORIGIN, RP_ID: 'localhost', PASSWORD_LOGIN: '1', INVITE_ONLY: '1', TRUST_PROXY: '1' }
  });
  base = `http://127.0.0.1:${await boundPort(child)}`;
});
after(() => child?.kill());

let ip = 10;
const post = (route, body, headers) => fetch(base + route, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `203.0.113.${ip++}`, ...headers },
  body: JSON.stringify(body)
});
const app = origin => ({ Origin: origin, 'Sec-Fetch-Site': 'cross-site' });

test('app origin signs in with a password and gets a bearer token', async () => {
  const r = await post('/api/login/password', { name: 'Mali', password: PW }, app('https://localhost'));
  assert.equal(r.status, 200);
  const body = await r.json();
  assert.equal(typeof body.token, 'string');
  assert.equal(body.user.name, 'Mali');
  const me = await fetch(base + '/api/me', { headers: { Authorization: 'Bearer ' + body.token } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.name, 'Mali');
});

test('ios app origin (capacitor://localhost) is accepted too', async () => {
  const r = await post('/api/login/password', { name: 'Mali', password: PW }, app('capacitor://localhost'));
  assert.equal(r.status, 200);
  assert.equal(typeof (await r.json()).token, 'string');
});

test('http://localhost is still refused', async () => {
  const r = await post('/api/login/password', { name: 'Mali', password: PW }, app('http://localhost'));
  assert.equal(r.status, 403);
  assert.equal((await r.json()).error, 'cross-origin request refused');
});

test('a browser on the server\'s own origin gets a cookie and no token', async () => {
  const r = await post('/api/login/password', { name: 'Mali', password: PW }, { Origin: ORIGIN, 'Sec-Fetch-Site': 'same-origin' });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).token, undefined);
  assert.ok(r.headers.get('set-cookie'));
});

test('register from the app needs a valid invite, once', async () => {
  const none = await post('/api/register/password', { name: 'Ploy', password: PW }, app('https://localhost'));
  assert.equal(none.status, 403);
  assert.equal((await none.json()).code, 'invite');
  const ok = await post('/api/register/password', { name: 'Ploy', password: PW, code: 'FRIEND1' }, app('https://localhost'));
  assert.equal(ok.status, 200);
  assert.equal(typeof (await ok.json()).token, 'string');
  const again = await post('/api/register/password', { name: 'Nok', password: PW, code: 'FRIEND1' }, app('https://localhost'));
  assert.equal(again.status, 403);
});
