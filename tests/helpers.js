// Apoio dos testes de integração: banco de testes descartável, servidor real e um
// "navegador" HTTP com cookie de sessão. O banco indicado é APAGADO e recriado;
// por segurança o nome precisa terminar em "_test".
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function dbConfig(defaultName) {
  const config = {
    host: process.env.TEST_DB_HOST || '127.0.0.1',
    port: Number(process.env.TEST_DB_PORT || 3306),
    user: process.env.TEST_DB_USER || 'root',
    password: process.env.TEST_DB_PASS || '',
    database: defaultName
  };
  if (!/_test$/.test(config.database)) throw new Error(`Recusando rodar em "${config.database}": o nome do banco de testes precisa terminar em _test.`);
  return config;
}

export async function resetDatabase(config) {
  const admin = await mysql.createConnection({ ...config, database: undefined });
  await admin.query(`DROP DATABASE IF EXISTS \`${config.database}\``);
  await admin.query(`CREATE DATABASE \`${config.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();
  return mysql.createConnection(config);
}

// Sobe o servidor real contra o banco de testes e espera ele ficar pronto.
export async function startServer(config, port, extraEnv = {}) {
  const server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env, PORT: String(port), NODE_ENV: 'test', SESSION_SECRET: 'test-secret',
      DB_HOST: config.host, DB_PORT: String(config.port), DB_USER: config.user, DB_PASS: config.password, DB_NAME: config.database,
      ...extraEnv
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let log = '';
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Servidor não iniciou:\n${log}`)), 20000);
    server.stdout.on('data', chunk => { log += chunk; if (log.includes('rodando')) { clearTimeout(timer); resolve(); } });
    server.stderr.on('data', chunk => { log += chunk; });
    server.on('exit', code => reject(new Error(`Servidor encerrou (${code}):\n${log}`)));
  });
  return server;
}

// Cliente HTTP com cookie de sessão, sem seguir redirecionamentos automaticamente.
export class Browser {
  constructor(base) { this.base = base; this.cookie = ''; }

  async request(method, url, body, json = false) {
    const headers = { cookie: this.cookie };
    let payload;
    if (json) {
      headers['content-type'] = 'application/json';
      payload = JSON.stringify(body);
    } else if (body) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      payload = new URLSearchParams(Object.entries(body).flatMap(([k, v]) => [v].flat().map(item => [k, String(item)])));
    }
    const res = await fetch(this.base + url, { method, headers, body: payload, redirect: 'manual' });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* resposta em HTML */ }
    return { status: res.status, location: res.headers.get('location') || '', text, data };
  }

  get(url) { return this.request('GET', url); }
  post(url, body = {}) { return this.request('POST', url, body); }
  postJson(url, body = {}) { return this.request('POST', url, body, true); }

  // Segue até a página final, como o navegador faria.
  async follow(res) {
    let current = res;
    for (let i = 0; i < 5 && current.status >= 300 && current.status < 400; i++) current = await this.get(current.location);
    return current;
  }
}

export async function register(browser, sql, { name, email, team = null }) {
  const body = {
    account_type: team ? 'team' : 'personal', name, email,
    password: 'senha-segura-123', password_confirmation: 'senha-segura-123',
    features_sent: '1', features: ['kanban', 'categories', 'deadlines']
  };
  if (team) Object.assign(body, { team_name: team, team_type: 'development', team_size: '1-5', team_purpose: 'tasks' });
  const res = await browser.post('/register', body);
  assert.equal(res.status, 302, `cadastro de ${email}: ${res.text.slice(0, 300)}`);
  const [user] = await sql('SELECT id FROM users WHERE email = ?', [email]);
  return user.id;
}

export async function login(browser, email) {
  return browser.post('/login', { identifier: email, password: 'senha-segura-123' });
}
