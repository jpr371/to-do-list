// Testes de integração do sistema colaborativo: sobe o servidor real contra um
// banco MySQL/MariaDB de testes e percorre os fluxos por HTTP, como um navegador.
//
//   TEST_DB_NAME=taskflow_test TEST_DB_PORT=3306 npm test
//
// O banco indicado é APAGADO e recriado; por segurança o nome precisa terminar em "_test".
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB = {
  host: process.env.TEST_DB_HOST || '127.0.0.1',
  port: Number(process.env.TEST_DB_PORT || 3306),
  user: process.env.TEST_DB_USER || 'root',
  password: process.env.TEST_DB_PASS || '',
  database: process.env.TEST_DB_NAME || 'taskflow_test'
};
const PORT = Number(process.env.TEST_PORT || 3999);
const BASE = `http://127.0.0.1:${PORT}`;

if (!/_test$/.test(DB.database)) throw new Error(`Recusando rodar em "${DB.database}": o nome do banco de testes precisa terminar em _test.`);

let server;
let db;

async function sql(query, params = []) {
  const [rows] = await db.query(query, params);
  return rows;
}

// Cliente HTTP com cookie de sessão, sem seguir redirecionamentos automaticamente.
class Browser {
  constructor() { this.cookie = ''; }

  async request(method, url, body) {
    const headers = { cookie: this.cookie };
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      payload = new URLSearchParams(Object.entries(body).flatMap(([k, v]) => [v].flat().map(item => [k, String(item)])));
    }
    const res = await fetch(BASE + url, { method, headers, body: payload, redirect: 'manual' });
    const set = res.headers.get('set-cookie');
    if (set) this.cookie = set.split(';')[0];
    const text = await res.text();
    return { status: res.status, location: res.headers.get('location') || '', text };
  }

  get(url) { return this.request('GET', url); }
  post(url, body = {}) { return this.request('POST', url, body); }

  // Segue até a página final, como o navegador faria.
  async follow(res) {
    let current = res;
    for (let i = 0; i < 5 && current.status >= 300 && current.status < 400; i++) current = await this.get(current.location);
    return current;
  }
}

async function register(browser, { name, email, team = null }) {
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

async function login(browser, email) {
  return browser.post('/login', { identifier: email, password: 'senha-segura-123' });
}

async function createInvite(browser, workspaceId, { email = '', role = 'member', days = 7 } = {}) {
  const res = await browser.post(`/workspaces/${workspaceId}/invites`, { email, role, expires_in: days });
  if (res.status !== 302) return { res };
  const page = await browser.follow(res);
  const token = page.text.match(/\/invite\/([A-Za-z0-9_-]{20,})/)?.[1];
  return { res, token };
}

const taskId = async title => (await sql('SELECT id FROM tasks WHERE title = ?', [title]))[0]?.id;
const assigneeOf = async id => (await sql('SELECT user_id FROM task_assignees WHERE task_id = ?', [id])).map(r => r.user_id);
const roleOf = async (ws, user) => (await sql('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?', [ws, user]))[0]?.role || null;

const lucas = new Browser();
const santos = new Browser();
const ribas = new Browser();
const externo = new Browser();
const ids = {};

before(async () => {
  const admin = await mysql.createConnection({ ...DB, database: undefined });
  await admin.query(`DROP DATABASE IF EXISTS \`${DB.database}\``);
  await admin.query(`CREATE DATABASE \`${DB.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await admin.end();
  db = await mysql.createConnection(DB);

  server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: {
      ...process.env, PORT: String(PORT), NODE_ENV: 'test', SESSION_SECRET: 'test-secret',
      DB_HOST: DB.host, DB_PORT: String(DB.port), DB_USER: DB.user, DB_PASS: DB.password, DB_NAME: DB.database
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
});

after(async () => {
  server?.kill();
  await db?.end();
});

test('cadastro de quatro contas em dois Workspaces de equipe', async () => {
  ids.lucas = await register(lucas, { name: 'Lucas Prado', email: 'lucas@test.local', team: 'Estúdio Lucas' });
  ids.santos = await register(santos, { name: 'Santos Lima', email: 'santos@test.local' });
  ids.ribas = await register(ribas, { name: 'Ribas Costa', email: 'ribas@test.local' });
  ids.externo = await register(externo, { name: 'Externo Silva', email: 'externo@test.local', team: 'Outra Equipe' });
  [ids.w1] = (await sql("SELECT id FROM workspaces WHERE kind = 'team' AND owner_id = ?", [ids.lucas])).map(r => r.id);
  [ids.w2] = (await sql("SELECT id FROM workspaces WHERE kind = 'team' AND owner_id = ?", [ids.externo])).map(r => r.id);
  assert.ok(ids.w1 && ids.w2);
  assert.equal(await roleOf(ids.w1, ids.lucas), 'owner');
  // Cadastro de equipe abre direto no Workspace da equipe.
  const dash = await lucas.get('/dashboard');
  assert.match(dash.text, /Estúdio Lucas/);
  assert.match(dash.text, /Total de tarefas/);
});

test('convite por e-mail aparece no painel e é aceito pelo destinatário', async () => {
  const { token } = await createInvite(lucas, ids.w1, { email: 'santos@test.local' });
  assert.ok(token, 'link do convite exibido uma vez para quem criou');
  const [row] = await sql('SELECT token_hash FROM workspace_invites WHERE invited_email = ?', ['santos@test.local']);
  assert.equal(row.token_hash.length, 64);
  assert.notEqual(row.token_hash, token, 'o banco guarda somente o hash');

  // Segunda visita à página da equipe não mostra mais o link.
  const again = await lucas.get(`/workspaces/${ids.w1}`);
  assert.doesNotMatch(again.text, new RegExp(token));
  assert.match(again.text, /santos@test\.local/);

  const dup = await createInvite(lucas, ids.w1, { email: 'santos@test.local' });
  assert.equal(dup.res.status, 422);
  assert.match(dup.res.text, /Já existe um convite pendente/);
  assert.equal((await sql("SELECT COUNT(*) AS n FROM workspace_invites WHERE invited_email = 'santos@test.local'"))[0].n, 1);

  const dash = await santos.get('/dashboard');
  assert.match(dash.text, /Convites recebidos/);
  const inviteId = dash.text.match(/\/invites\/(\d+)\/accept/)[1];
  // Outra conta não consegue aceitar o convite de Santos pelo id.
  const stolen = await externo.post(`/invites/${inviteId}/accept`);
  assert.equal(stolen.status, 302);
  assert.equal(await roleOf(ids.w1, ids.externo), null);

  const res = await santos.post(`/invites/${inviteId}/accept`);
  assert.equal(res.location, '/dashboard');
  assert.equal(await roleOf(ids.w1, ids.santos), 'member');
  const after = await santos.get('/dashboard');
  assert.match(after.text, /ws-switch/);
  assert.match(after.text, /Estúdio Lucas/);
});

test('convite por link: usuário deslogado entra e volta para o convite; link não pode ser reutilizado', async () => {
  const { token } = await createInvite(lucas, ids.w1);
  await ribas.get('/logout');
  const guest = await ribas.get(`/invite/${token}`);
  assert.equal(guest.status, 200);
  assert.match(guest.text, /Estúdio Lucas/);
  assert.match(guest.text, /href="\/login"/);
  const loginPage = await ribas.get('/login');
  assert.match(loginPage.text, /aceitar o convite para <b>Estúdio Lucas<\/b>/);

  const logged = await login(ribas, 'ribas@test.local');
  assert.equal(logged.location, `/invite/${token}`, 'depois do login volta para o convite');
  const page = await ribas.get(logged.location);
  assert.match(page.text, /Aceitar convite/);
  const accept = await ribas.post(`/invite/${token}/accept`);
  assert.equal(accept.location, '/dashboard');
  assert.equal(await roleOf(ids.w1, ids.ribas), 'member');

  const reuse = await externo.post(`/invite/${token}/accept`);
  assert.equal(reuse.status, 410);
  assert.match(reuse.text, /já foi utilizado/);
  assert.equal(await roleOf(ids.w1, ids.externo), null);

  const bogus = await externo.get('/invite/token-que-nao-existe-123456789');
  assert.equal(bogus.status, 404);
});

test('usuário sem conta: cadastro preserva o convite', async () => {
  const novo = new Browser();
  const { token } = await createInvite(lucas, ids.w1, { email: 'novo@test.local' });
  await novo.get(`/invite/${token}`);
  const form = await novo.get('/register');
  assert.match(form.text, /confirma o convite para <b>Estúdio Lucas<\/b>/);
  assert.match(form.text, /value="novo@test\.local"/);
  const res = await novo.post('/register', {
    account_type: 'personal', name: 'Novo Integrante', email: 'novo@test.local',
    password: 'senha-segura-123', password_confirmation: 'senha-segura-123', features_sent: '1'
  });
  assert.equal(res.location, `/invite/${token}`);
  const accept = await novo.post(`/invite/${token}/accept`);
  assert.equal(accept.location, '/dashboard');
  ids.novo = (await sql("SELECT id FROM users WHERE email = 'novo@test.local'"))[0].id;
  assert.equal(await roleOf(ids.w1, ids.novo), 'member');
});

test('convites vencidos, cancelados e de outro e-mail não dão acesso', async () => {
  const expired = await createInvite(lucas, ids.w1);
  await sql('UPDATE workspace_invites SET expires_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE token_hash = SHA2(?, 256)', [expired.token]);
  const r1 = await externo.post(`/invite/${expired.token}/accept`);
  assert.equal(r1.status, 410);
  assert.match(r1.text, /expirou/);

  const revoked = await createInvite(lucas, ids.w1);
  const [inv] = await sql('SELECT id FROM workspace_invites WHERE token_hash = SHA2(?, 256)', [revoked.token]);
  await lucas.post(`/workspaces/${ids.w1}/invites/${inv.id}/revoke`);
  const r2 = await externo.post(`/invite/${revoked.token}/accept`);
  assert.equal(r2.status, 410);
  assert.match(r2.text, /cancelado/);

  const other = await createInvite(lucas, ids.w1, { email: 'alguem@test.local' });
  const r3 = await externo.post(`/invite/${other.token}/accept`);
  assert.equal(r3.status, 403);
  assert.match(r3.text, /outro e-mail/);

  assert.equal(await roleOf(ids.w1, ids.externo), null);
});

test('fluxo obrigatório: Lucas atribui ao Ribas, Ribas altera o status, Lucas vê a mudança', async () => {
  const save = await lucas.post('/tasks', {
    action: 'save', id: '', title: 'Relatório mensal', description: 'Fechar números', category: 'Financeiro',
    priority: 'high', status: 'pending', due_date: '', assignee_id: ids.ribas
  });
  assert.equal(save.status, 302);
  ids.task = await taskId('Relatório mensal');
  assert.deepEqual(await assigneeOf(ids.task), [ids.ribas]);

  const mine = await ribas.get('/tasks?assignee=me');
  assert.match(mine.text, /Relatório mensal/);
  assert.match(mine.text, /Ribas Costa/);
  const kanban = await ribas.get('/kanban');
  assert.match(kanban.text, new RegExp(`draggable="true" data-id="${ids.task}"`));

  const moved = await ribas.post('/api/task-status', { id: ids.task, status: 'progress' });
  assert.equal(moved.status, 200);
  assert.equal((await sql('SELECT status FROM tasks WHERE id = ?', [ids.task]))[0].status, 'progress');

  const view = await lucas.get(`/tasks?action=view&id=${ids.task}`);
  assert.match(view.text, /Em andamento/);
  const dash = await lucas.get('/dashboard');
  assert.match(dash.text, /Distribuição por integrante/);
  assert.match(dash.text, /Ribas Costa/);
  assert.match(dash.text, /Ribas Costa · /, 'atividade da equipe mostra quem fez');
});

test('permissões de tarefa para membros', async () => {
  // Ribas é responsável, mas não criou: só atualiza o status.
  const edit = await ribas.post('/tasks', { action: 'save', id: ids.task, title: 'Alterado', status: 'done', priority: 'low' });
  assert.equal(edit.status, 403);
  const del = await ribas.post('/tasks', { action: 'delete', id: ids.task });
  assert.equal(del.status, 403);
  const editForm = await ribas.get(`/tasks?action=edit&id=${ids.task}`);
  assert.equal(editForm.status, 302);
  // Santos não é responsável nem criador: não altera.
  const status = await santos.post('/api/task-status', { id: ids.task, status: 'done' });
  assert.equal(status.status, 403);
  const bulk = await santos.post('/tasks', { action: 'bulk_status', ids: [ids.task], bulk_status: 'done' });
  assert.equal(bulk.status, 302);
  assert.equal((await sql('SELECT title, status FROM tasks WHERE id = ?', [ids.task]))[0].status, 'progress');

  // Membro cria tarefa própria, mas não pode atribuí-la a outra pessoa.
  const own = await santos.post('/tasks', { action: 'save', id: '', title: 'Tarefa do Santos', status: 'inbox', priority: 'normal', assignee_id: ids.ribas });
  assert.equal(own.status, 403);
  const own2 = await santos.post('/tasks', { action: 'save', id: '', title: 'Tarefa do Santos', status: 'inbox', priority: 'normal', assignee_id: ids.santos });
  assert.equal(own2.status, 302);
  ids.santosTask = await taskId('Tarefa do Santos');
  assert.deepEqual(await assigneeOf(ids.santosTask), [ids.santos]);
  // Todos os integrantes veem as tarefas da equipe.
  assert.match((await ribas.get('/tasks')).text, /Tarefa do Santos/);
});

test('isolamento: usuários externos e IDs manipulados', async () => {
  // Atribuir a quem não é da equipe.
  const ext = await lucas.post('/tasks', { action: 'save', id: ids.task, title: 'Relatório mensal', status: 'progress', priority: 'high', assignee_id: ids.externo });
  assert.equal(ext.status, 422);
  assert.deepEqual(await assigneeOf(ids.task), [ids.ribas]);

  // Externo (Workspace "Outra Equipe") tentando a tarefa da equipe de Lucas.
  const view = await externo.get(`/tasks?action=view&id=${ids.task}`);
  assert.doesNotMatch(view.text, /Relatório mensal/);
  assert.equal((await externo.post('/api/task-status', { id: ids.task, status: 'done' })).status, 404);
  assert.equal((await externo.post('/tasks', { action: 'save', id: ids.task, title: 'Invadido', status: 'done', priority: 'low' })).status, 404);
  assert.equal((await externo.post('/tasks', { action: 'delete', id: ids.task })).status, 404);
  await externo.post('/tasks', { action: 'bulk_status', ids: [ids.task], bulk_status: 'done' });
  assert.equal((await sql('SELECT title, status FROM tasks WHERE id = ?', [ids.task]))[0].title, 'Relatório mensal');
  assert.equal((await sql('SELECT status FROM tasks WHERE id = ?', [ids.task]))[0].status, 'progress');

  // Páginas e ações da equipe alheia.
  assert.equal((await externo.get(`/workspaces/${ids.w1}`)).status, 404);
  assert.equal((await externo.post(`/workspaces/${ids.w1}/invites`, { role: 'member' })).status, 404);
  assert.equal((await externo.post(`/workspaces/${ids.w1}/members/${ids.ribas}/remove`)).status, 404);
  await externo.post('/workspaces/switch', { workspace_id: ids.w1 });
  assert.doesNotMatch((await externo.get('/tasks')).text, /Relatório mensal/);

  // Lucas não enxerga a equipe do Externo.
  await externo.post('/tasks', { action: 'save', id: '', title: 'Segredo da Outra Equipe', status: 'inbox', priority: 'normal' });
  assert.doesNotMatch((await lucas.get('/tasks')).text, /Segredo da Outra Equipe/);
  const secret = await taskId('Segredo da Outra Equipe');
  assert.equal((await lucas.post('/api/task-status', { id: secret, status: 'done' })).status, 404);

  // Filtro por responsável com id de fora da equipe é ignorado.
  assert.match((await lucas.get(`/tasks?assignee=${ids.externo}`)).text, /Relatório mensal/);
});

test('cargos: bloqueios e alterações autorizadas', async () => {
  const self = await santos.post(`/workspaces/${ids.w1}/members/${ids.santos}/role`, { role: 'admin' });
  assert.equal(self.status, 403);
  assert.equal((await santos.post(`/workspaces/${ids.w1}/members/${ids.ribas}/role`, { role: 'admin' })).status, 403);
  assert.equal((await santos.post(`/workspaces/${ids.w1}/invites`, { role: 'member' })).status, 403);
  assert.equal((await santos.post(`/workspaces/${ids.w1}`, { name: 'Hack', team_type: 'design', team_size: '1-5', team_purpose: 'tasks' })).status, 403);
  assert.equal(await roleOf(ids.w1, ids.santos), 'member');

  const promote = await lucas.post(`/workspaces/${ids.w1}/members/${ids.santos}/role`, { role: 'admin' });
  assert.equal(promote.status, 302);
  assert.equal(await roleOf(ids.w1, ids.santos), 'admin');

  // Administrador: não mexe no proprietário nem promove administradores.
  assert.equal((await santos.post(`/workspaces/${ids.w1}/members/${ids.lucas}/role`, { role: 'member' })).status, 403);
  assert.equal((await santos.post(`/workspaces/${ids.w1}/members/${ids.lucas}/remove`)).status, 403);
  assert.equal((await santos.post(`/workspaces/${ids.w1}/members/${ids.ribas}/role`, { role: 'admin' })).status, 403);
  assert.equal((await santos.post(`/workspaces/${ids.w1}/invites`, { role: 'admin' })).status, 403);
  assert.equal((await santos.post(`/workspaces/${ids.w1}`, { name: 'Hack', team_type: 'design', team_size: '1-5', team_purpose: 'tasks' })).status, 403);
  assert.equal(await roleOf(ids.w1, ids.lucas), 'owner');

  // Administrador convida membros e gerencia tarefas da equipe.
  const inv = await createInvite(santos, ids.w1, { role: 'member' });
  assert.ok(inv.token);
  const edit = await santos.post('/tasks', { action: 'save', id: ids.task, title: 'Relatório mensal', status: 'review', priority: 'high', assignee_id: ids.ribas });
  assert.equal(edit.status, 302);

  // Proprietário não pode ser removido nem sair; não altera o próprio cargo.
  assert.equal((await lucas.post(`/workspaces/${ids.w1}/members/${ids.lucas}/remove`)).status, 403);
  assert.equal((await lucas.post(`/workspaces/${ids.w1}/members/${ids.lucas}/role`, { role: 'member' })).status, 403);
  assert.equal((await lucas.post(`/workspaces/${ids.w1}/leave`)).status, 403);
  assert.equal(await roleOf(ids.w1, ids.lucas), 'owner');

  // Convite criado por quem perdeu o cargo de administrador deixa de valer.
  await lucas.post(`/workspaces/${ids.w1}/members/${ids.santos}/role`, { role: 'member' });
  const blocked = await externo.post(`/invite/${inv.token}/accept`);
  assert.equal(blocked.status, 410);
  assert.equal(await roleOf(ids.w1, ids.externo), null);
});

test('transferência de propriedade', async () => {
  const res = await lucas.post(`/workspaces/${ids.w1}/members/${ids.santos}/role`, { role: 'owner' });
  assert.equal(res.status, 302);
  assert.equal(await roleOf(ids.w1, ids.santos), 'owner');
  assert.equal(await roleOf(ids.w1, ids.lucas), 'admin');
  assert.equal((await sql('SELECT owner_id FROM workspaces WHERE id = ?', [ids.w1]))[0].owner_id, ids.santos);
  assert.equal((await sql("SELECT COUNT(*) AS n FROM workspace_members WHERE workspace_id = ? AND role = 'owner'", [ids.w1]))[0].n, 1);
  await santos.post(`/workspaces/${ids.w1}/members/${ids.lucas}/role`, { role: 'owner' });
  assert.equal(await roleOf(ids.w1, ids.lucas), 'owner');
  assert.equal(await roleOf(ids.w1, ids.santos), 'admin');
});

test('indicadores do Dashboard batem com o banco', async () => {
  await lucas.post('/tasks', { action: 'save', id: '', title: 'Atrasada da equipe', status: 'pending', priority: 'urgent', due_date: '2020-01-01' });
  await lucas.post('/tasks', { action: 'save', id: '', title: 'Concluída da equipe', status: 'done', priority: 'low', assignee_id: ids.lucas });
  const [real] = await sql(
    `SELECT COUNT(*) AS total, SUM(status IN ('inbox','pending')) AS pending, SUM(status IN ('progress','review')) AS progress,
            SUM(status = 'done') AS done, SUM(status <> 'done' AND due_date < CURDATE()) AS late
     FROM tasks WHERE workspace_id = ?`, [ids.w1]);
  const html = (await lucas.get('/dashboard')).text;
  const stat = label => Number(html.match(new RegExp(`<div class="n">(\\d+)</div><div class="l">${label}</div>`))[1]);
  assert.equal(stat('Total de tarefas'), Number(real.total));
  assert.equal(stat('Pendentes'), Number(real.pending));
  assert.equal(stat('Em andamento'), Number(real.progress));
  assert.equal(stat('Concluídas'), Number(real.done));
  assert.equal(stat('Atrasadas'), Number(real.late));
  const ribasDash = (await ribas.get('/dashboard')).text;
  assert.equal(Number(ribasDash.match(/<div class="n">(\d+)<\/div><div class="l">Atribuídas a mim<\/div>/)[1]), 1);

  const filtered = (await lucas.get(`/dashboard?assignee=${ids.ribas}`)).text;
  assert.equal(Number(filtered.match(/<div class="n">(\d+)<\/div><div class="l">Total de tarefas<\/div>/)[1]), 1);
  const byStatus = (await lucas.get('/dashboard?status=done')).text;
  assert.equal(Number(byStatus.match(/<div class="n">(\d+)<\/div><div class="l">Total de tarefas<\/div>/)[1]), Number(real.done));
  assert.ok((await sql('SELECT completed_at FROM tasks WHERE title = ?', ['Concluída da equipe']))[0].completed_at);
});

test('remover integrante tira o acesso e as atribuições', async () => {
  const res = await lucas.post(`/workspaces/${ids.w1}/members/${ids.ribas}/remove`);
  assert.equal(res.status, 302);
  assert.equal(await roleOf(ids.w1, ids.ribas), null);
  assert.deepEqual(await assigneeOf(ids.task), []);
  assert.equal((await ribas.get(`/workspaces/${ids.w1}`)).status, 404);
  assert.equal((await ribas.post('/api/task-status', { id: ids.task, status: 'done' })).status, 404);
  const tasks = await ribas.get('/tasks');
  assert.doesNotMatch(tasks.text, /Relatório mensal/);
  assert.doesNotMatch((await ribas.get('/dashboard')).text, /Estúdio Lucas/);
  await ribas.post('/workspaces/switch', { workspace_id: ids.w1 });
  assert.doesNotMatch((await ribas.get('/tasks')).text, /Relatório mensal/);
  // As tarefas criadas pelo integrante removido continuam na equipe? (Ribas não criou nenhuma.)
  assert.ok(await taskId('Relatório mensal'));
});

test('integrante sai da equipe', async () => {
  const res = await novoLeave();
  assert.equal(res.status, 302);
  assert.equal(await roleOf(ids.w1, ids.novo), null);
});

async function novoLeave() {
  const novo = new Browser();
  await login(novo, 'novo@test.local');
  await novo.post('/workspaces/switch', { workspace_id: ids.w1 });
  return novo.post(`/workspaces/${ids.w1}/leave`);
}

test('modo pessoal preservado e separado da equipe', async () => {
  const [personal] = await sql("SELECT id FROM workspaces WHERE owner_id = ? AND kind = 'personal'", [ids.lucas]);
  await lucas.post('/workspaces/switch', { workspace_id: personal.id });
  await lucas.post('/tasks', { action: 'save', id: '', title: 'Tarefa pessoal do Lucas', status: 'inbox', priority: 'normal', assignee_id: ids.santos });
  const id = await taskId('Tarefa pessoal do Lucas');
  assert.deepEqual(await assigneeOf(id), [], 'tarefas pessoais não recebem responsável');
  const list = (await lucas.get('/tasks')).text;
  assert.match(list, /Tarefa pessoal do Lucas/);
  assert.doesNotMatch(list, /Relatório mensal/);
  assert.doesNotMatch(list, /Responsável/);
  const dash = (await lucas.get('/dashboard')).text;
  assert.match(dash, /Resumo do dia/);
  assert.doesNotMatch(dash, /Distribuição por integrante/);
  assert.doesNotMatch((await santos.get('/tasks')).text, /Tarefa pessoal do Lucas/);
  assert.equal((await santos.post('/api/task-status', { id, status: 'done' })).status, 404);
  // Exclusão continua funcionando (diálogo presente na página).
  assert.match((await lucas.get(`/tasks?action=view&id=${id}`)).text, /id="overlayDelete"/);
  await lucas.post('/tasks', { action: 'delete', id });
  assert.equal(await taskId('Tarefa pessoal do Lucas'), undefined);
  await lucas.post('/workspaces/switch', { workspace_id: ids.w1 });
});

test('avatar, logout e rotas protegidas', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const form = new FormData();
  form.append('avatar', new Blob([png], { type: 'image/png' }), 'a.png');
  const up = await santos.request('POST', '/profile/avatar', form);
  assert.equal(up.status, 302);
  const [row] = await sql('SELECT avatar_path FROM users WHERE id = ?', [ids.santos]);
  assert.match(row.avatar_path, /^\/uploads\/avatars\/.+\.png$/);
  assert.match((await lucas.get(`/workspaces/${ids.w1}`)).text, new RegExp(row.avatar_path));

  await santos.get('/logout');
  for (const url of ['/dashboard', '/tasks', '/kanban', `/workspaces/${ids.w1}`]) {
    const r = await santos.get(url);
    assert.equal(r.location, '/login', url);
  }
  assert.equal((await santos.post('/api/task-status', { id: ids.task, status: 'done' })).location, '/login');
  assert.equal((await santos.post(`/workspaces/${ids.w1}/invites`, { role: 'member' })).location, '/login');
  const back = await login(santos, 'santos@test.local');
  assert.equal(back.location, '/dashboard');
  assert.match((await santos.get('/tasks')).text, /Relatório mensal/, 'Workspace ativo mantido após novo login');
});

test('excluir conta de integrante mantém as tarefas que ele criou na equipe', async () => {
  const res = await santos.post('/profile/delete', { current_password: 'senha-segura-123' });
  assert.equal(res.status, 302);
  const [task] = await sql('SELECT user_id, workspace_id FROM tasks WHERE id = ?', [ids.santosTask]);
  assert.equal(task.user_id, ids.lucas);
  assert.equal(task.workspace_id, ids.w1);
});
