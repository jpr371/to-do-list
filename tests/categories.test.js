// Testes de integração de categorias, subcategorias, mover tarefas entre categorias,
// ordem manual. Sobe o servidor real contra um banco de testes:
//
//   TEST_DB_NAME=taskflow_cat_test npm test
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Browser, dbConfig, login, register, resetDatabase, startServer } from './helpers.js';

const DB = dbConfig(process.env.TEST_CAT_DB_NAME || 'taskflow_cat_test');
const PORT = Number(process.env.TEST_CAT_PORT || 3998);
const BASE = `http://127.0.0.1:${PORT}`;

let server;
let db;
const sql = async (query, params = []) => (await db.query(query, params))[0];

const ana = new Browser(BASE);
const lucas = new Browser(BASE);
const santos = new Browser(BASE);
const ids = {};

// { "<id da categoria ou ''>": [ids das tarefas na ordem em que aparecem] } da visão por categoria.
function lists(html) {
  const out = {};
  for (const match of html.matchAll(/data-cat-list data-category-id="(\d*)">([\s\S]*?)<div class="cat-empty">/g)) {
    out[match[1]] = [...match[2].matchAll(/data-task-id="(\d+)"/g)].map(item => Number(item[1]));
  }
  return out;
}
const categoryView = async (browser, query = '') => lists((await browser.get(`/tasks?view=category${query}`)).text);

const task = id => sql('SELECT * FROM tasks WHERE id = ?', [id]).then(rows => rows[0]);
const categoryByName = name => sql('SELECT * FROM categories WHERE name = ?', [name]).then(rows => rows[0]);
const countCategories = name => sql('SELECT COUNT(*) AS n FROM categories WHERE name = ?', [name]).then(rows => Number(rows[0].n));
const flashOf = async (browser, res) => (await browser.follow(res)).text;

async function newTask(browser, title, fields = {}) {
  const res = await browser.post('/tasks', { action: 'save', id: '', title, status: 'pending', priority: 'normal', ...fields });
  assert.equal(res.status, 302, `criar "${title}": ${res.text.slice(0, 200)}`);
  return (await sql('SELECT id FROM tasks WHERE title = ? ORDER BY id DESC LIMIT 1', [title]))[0].id;
}

before(async () => {
  db = await resetDatabase(DB);
  server = await startServer(DB, PORT);
});

after(async () => {
  server?.kill();
  await db?.end();
});

test('cadastro das contas de teste', async () => {
  ids.ana = await register(ana, sql, { name: 'Ana Souza', email: 'ana@test.local' });
  ids.lucas = await register(lucas, sql, { name: 'Lucas Prado', email: 'lucas@test.local', team: 'Equipe Lucas' });
  ids.santos = await register(santos, sql, { name: 'Santos Lima', email: 'santos@test.local' });
  [ids.team] = (await sql("SELECT id FROM workspaces WHERE kind = 'team' AND owner_id = ?", [ids.lucas])).map(row => row.id);

  const invite = await lucas.post(`/workspaces/${ids.team}/invites`, { email: '', role: 'member', expires_in: 7 });
  const page = await lucas.follow(invite);
  const token = page.text.match(/\/invite\/([A-Za-z0-9_-]{20,})/)?.[1];
  assert.ok(token);
  await santos.post(`/invite/${token}/accept`);
  await santos.post('/workspaces/switch', { workspace_id: ids.team });
  const [member] = await sql('SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?', [ids.team, ids.santos]);
  assert.equal(member.role, 'member');
});

test('criar categorias e subcategorias, com validações', async () => {
  let res = await ana.post('/categories', { name: 'Trabalho' });
  assert.equal(res.status, 302);
  ids.work = (await categoryByName('Trabalho')).id;
  assert.equal((await categoryByName('Trabalho')).parent_id, null);

  // Nome vazio e duplicado (sem diferenciar maiúsculas).
  assert.match(await flashOf(ana, await ana.post('/categories', { name: '   ' })), /Informe o nome da categoria/);
  assert.match(await flashOf(ana, await ana.post('/categories', { name: 'trabalho' })), /Já existe a categoria/);
  assert.equal(await countCategories('Trabalho'), 1);

  // Subcategoria vinculada à principal.
  res = await ana.post('/categories', { name: 'Reuniões', parent_id: ids.work });
  assert.equal(res.status, 302);
  ids.meet = (await categoryByName('Reuniões')).id;
  assert.equal((await categoryByName('Reuniões')).parent_id, ids.work);
  assert.match(await flashOf(ana, res), /Subcategoria criada/);

  // Só dois níveis; duplicada no mesmo pai; principal inexistente.
  assert.match(await flashOf(ana, await ana.post('/categories', { name: 'Fundo', parent_id: ids.meet })), /dentro de uma categoria principal/);
  assert.equal(await countCategories('Fundo'), 0);
  assert.match(await flashOf(ana, await ana.post('/categories', { name: 'REUNIÕES', parent_id: ids.work })), /Já existe a subcategoria/);
  assert.match(await flashOf(ana, await ana.post('/categories', { name: 'X', parent_id: 999999 })), /não existe/);

  // O mesmo nome pode existir sob outra principal.
  await ana.post('/categories', { name: 'Pessoal' });
  ids.personal = (await categoryByName('Pessoal')).id;
  await ana.post('/categories', { name: 'Reuniões', parent_id: ids.personal });
  assert.equal(await countCategories('Reuniões'), 2);

  const page = await ana.get('/categories');
  assert.equal(page.status, 200);
  assert.match(page.text, /Gerenciar categorias/);
  assert.match(page.text, /em Trabalho/);
});

test('renomear categoria', async () => {
  assert.match(await flashOf(ana, await ana.post(`/categories/${ids.work}`, { name: 'Pessoal' })), /Já existe uma categoria/);
  const ok = await ana.post(`/categories/${ids.work}`, { name: 'Trabalho Novo' });
  assert.match(await flashOf(ana, ok), /Categoria renomeada/);
  assert.equal((await categoryByName('Trabalho Novo')).id, ids.work);
  assert.equal((await ana.post('/categories/999999', { name: 'Nada' })).status, 404);
});

test('tarefas entram na categoria escolhida, em ordem, e a visão por categoria mostra a hierarquia', async () => {
  const fields = { priority: 'high', status: 'pending', due_date: '2030-01-15', description: 'Descrição original' };
  ids.a = await newTask(ana, 'Tarefa A', { ...fields, category_id: ids.work });
  ids.b = await newTask(ana, 'Tarefa B', { category_id: ids.work });
  ids.c = await newTask(ana, 'Tarefa C', { category_id: ids.work });
  ids.sub = await newTask(ana, 'Tarefa Sub', { category_id: ids.meet });
  assert.deepEqual((await sql('SELECT position FROM tasks WHERE category_id = ? ORDER BY position', [ids.work])).map(r => r.position), [1, 2, 3]);

  const html = (await ana.get('/tasks?view=category')).text;
  const found = lists(html);
  assert.deepEqual(found[ids.work], [ids.a, ids.b, ids.c]);
  assert.deepEqual(found[ids.meet], [ids.sub]);
  // A subcategoria aparece recuada dentro do bloco da categoria principal.
  assert.match(html, new RegExp(`data-category-id="${ids.work}"[\\s\\S]*?class="cat-subs"[\\s\\S]*?is-sub[\\s\\S]*?data-category-id="${ids.meet}"`));
  // Categorias sem tarefas também aparecem (ex.: "Pessoal").
  assert.ok(Object.hasOwn(found, ids.personal));

  // Filtro pela principal inclui a subcategoria; pela subcategoria, só ela.
  const parent = (await ana.get(`/tasks?category=${ids.work}`)).text;
  assert.match(parent, /Tarefa A/);
  assert.match(parent, /Tarefa Sub/);
  const child = (await ana.get(`/tasks?category=${ids.meet}`)).text;
  assert.match(child, /Tarefa Sub/);
  assert.doesNotMatch(child, /Tarefa A/);
  // A busca encontra pelo nome da categoria.
  assert.match((await ana.get('/tasks?q=Reuni')).text, /Tarefa Sub/);
});

test('mover tarefa entre categorias (#19)', async () => {
  const before = await task(ids.a);
  const res = await ana.postJson('/api/tasks/move', { id: ids.a, category_id: ids.meet });
  assert.equal(res.status, 200);
  assert.equal(res.data.ok, true);
  assert.equal(res.data.category, 'Trabalho Novo / Reuniões');

  const after = await task(ids.a);
  assert.equal(after.category_id, ids.meet);
  for (const field of ['title', 'description', 'status', 'priority', 'due_date', 'user_id']) {
    assert.deepEqual(after[field], before[field], `${field} não pode mudar ao mover`);
  }
  // Aparece no destino (no fim) e some da origem, imediatamente.
  const moved = await categoryView(ana);
  assert.deepEqual(moved[ids.work], [ids.b, ids.c]);
  assert.deepEqual(moved[ids.meet], [ids.sub, ids.a]);

  // Para "Sem categoria" e de volta para a categoria de origem (formulário sem JavaScript).
  assert.equal((await ana.postJson('/api/tasks/move', { id: ids.a, category_id: '' })).status, 200);
  assert.equal((await task(ids.a)).category_id, null);
  assert.ok((await categoryView(ana))[''].includes(ids.a));
  const form = await ana.post('/tasks', { action: 'move', id: ids.a, category_id: ids.work, view: 'category' });
  assert.equal(form.status, 302);
  assert.equal(form.location, `/tasks?action=view&id=${ids.a}&view=category`);
  assert.equal((await task(ids.a)).category_id, ids.work);
  assert.deepEqual((await categoryView(ana))[ids.work], [ids.b, ids.c, ids.a]);

  // A tela de detalhes oferece a opção de mover.
  const detail = await ana.get(`/tasks?action=view&id=${ids.a}`);
  assert.match(detail.text, /data-move-form/);
  assert.match(detail.text, /Mover para outra categoria/);

  // Categoria inexistente não move nada.
  const bad = await ana.postJson('/api/tasks/move', { id: ids.a, category_id: 999999 });
  assert.equal(bad.status, 422);
  assert.equal((await task(ids.a)).category_id, ids.work);
});

test('reordenar tarefas dentro da categoria e manter a ordem entre sessões (#20)', async () => {
  assert.deepEqual((await categoryView(ana))[ids.work], [ids.b, ids.c, ids.a]);
  const snapshot = await sql('SELECT id, title, status, priority, due_date, updated_at, category_id FROM tasks WHERE category_id = ? ORDER BY id', [ids.work]);

  const res = await ana.postJson('/api/tasks/reorder', { id: ids.a, category_id: ids.work, ids: [ids.a, ids.b, ids.c] });
  assert.equal(res.status, 200);
  assert.deepEqual((await categoryView(ana))[ids.work], [ids.a, ids.b, ids.c]);
  assert.deepEqual((await sql('SELECT position FROM tasks WHERE category_id = ? ORDER BY position', [ids.work])).map(r => r.position), [1, 2, 3]);

  // Outra sessão (novo login) vê a mesma ordem.
  const second = new Browser(BASE);
  await login(second, 'ana@test.local');
  assert.deepEqual((await categoryView(second))[ids.work], [ids.a, ids.b, ids.c]);

  // A reorganização não altera status, prioridade, prazo, categoria nem a data de atualização.
  const after = await sql('SELECT id, title, status, priority, due_date, updated_at, category_id FROM tasks WHERE category_id = ? ORDER BY id', [ids.work]);
  assert.deepEqual(after, snapshot);

  // Com filtro, só as tarefas visíveis trocam de lugar entre si; as ocultas ficam onde estão.
  const subset = await ana.postJson('/api/tasks/reorder', { id: ids.c, category_id: ids.work, ids: [ids.c, ids.a] });
  assert.equal(subset.status, 200);
  assert.deepEqual((await categoryView(ana))[ids.work], [ids.c, ids.b, ids.a]);

  // Ids de outra categoria, repetidos ou a tarefa arrastada fora da lista são recusados.
  assert.equal((await ana.postJson('/api/tasks/reorder', { id: ids.a, category_id: ids.work, ids: [ids.a, ids.sub] })).status, 409);
  assert.equal((await ana.postJson('/api/tasks/reorder', { id: ids.a, category_id: ids.work, ids: [ids.a, ids.a] })).status, 409);
  assert.equal((await ana.postJson('/api/tasks/reorder', { id: ids.a, category_id: ids.work, ids: [ids.b, ids.c] })).status, 422);
  assert.deepEqual((await categoryView(ana))[ids.work], [ids.c, ids.b, ids.a]);

  // Nova tarefa entra no fim; trocar a categoria pela edição também manda para o fim do destino.
  ids.d = await newTask(ana, 'Tarefa D', { category_id: ids.work });
  assert.deepEqual((await categoryView(ana))[ids.work], [ids.c, ids.b, ids.a, ids.d]);
  const edit = await ana.post('/tasks', { action: 'save', id: ids.c, title: 'Tarefa C', status: 'pending', priority: 'normal', category_id: ids.meet });
  assert.equal(edit.status, 302);
  const finalView = await categoryView(ana);
  assert.deepEqual(finalView[ids.work], [ids.b, ids.a, ids.d]);
  assert.deepEqual(finalView[ids.meet], [ids.sub, ids.c]);
});

test('formulário antigo com o nome da categoria continua funcionando', async () => {
  await newTask(ana, 'Legado 1', { category: 'Estudos' });
  await newTask(ana, 'Legado 2', { category: 'Estudos' });
  assert.equal(await countCategories('Estudos'), 1);
  const [{ n }] = await sql('SELECT COUNT(*) AS n FROM tasks WHERE category_id = ?', [(await categoryByName('Estudos')).id]);
  assert.equal(Number(n), 2);
  // Sem os campos de categoria, editar não mexe na categoria atual.
  await ana.post('/tasks', { action: 'save', id: ids.b, title: 'Tarefa B', status: 'done', priority: 'normal' });
  assert.equal((await task(ids.b)).category_id, ids.work);
  // Categoria que não existe no formulário novo é recusada.
  const bad = await ana.post('/tasks', { action: 'save', id: '', title: 'Sem destino', status: 'pending', priority: 'normal', category_id: 999999 });
  assert.equal(bad.status, 302);
  assert.match(bad.location, /action=new/);
  assert.equal((await sql("SELECT COUNT(*) AS n FROM tasks WHERE title = 'Sem destino'"))[0].n, 0);
});

test('equipe: permissões de categoria e de mover/reordenar', async () => {
  await lucas.post('/categories', { name: 'Design' });
  ids.design = (await categoryByName('Design')).id;
  await santos.post('/categories', { name: 'Dev' });
  ids.dev = (await categoryByName('Dev')).id;
  assert.equal((await categoryByName('Dev')).created_by, ids.santos, 'qualquer integrante cria categoria');

  const l1 = await newTask(lucas, 'Tarefa do Lucas', { category_id: ids.design });
  const l2 = await newTask(lucas, 'Outra do Lucas', { category_id: ids.design });
  const s1 = await newTask(santos, 'Tarefa do Santos', { category_id: ids.dev });
  assert.ok(l1 && l2 && s1);

  // Membro não mexe em tarefa de outra pessoa.
  assert.equal((await santos.postJson('/api/tasks/move', { id: l1, category_id: ids.dev })).status, 403);
  assert.equal((await santos.postJson('/api/tasks/reorder', { id: l1, category_id: ids.design, ids: [l2, l1] })).status, 403);
  assert.equal((await task(l1)).category_id, ids.design);
  // Mas move a própria tarefa; e quem administra (Lucas) move a de qualquer um.
  assert.equal((await santos.postJson('/api/tasks/move', { id: s1, category_id: ids.design })).status, 200);
  assert.equal((await lucas.postJson('/api/tasks/move', { id: s1, category_id: ids.dev })).status, 200);
  assert.deepEqual((await categoryView(lucas))[ids.design], [l1, l2]);

  // Renomear/excluir: só quem criou a categoria ou administra.
  assert.match(await flashOf(santos, await santos.post(`/categories/${ids.design}`, { name: 'Hack' })), /permissão/);
  assert.match(await flashOf(santos, await santos.post(`/categories/${ids.design}/delete`)), /permissão/);
  assert.equal((await categoryByName('Design')).id, ids.design);
  assert.match(await flashOf(santos, await santos.post(`/categories/${ids.dev}`, { name: 'Desenvolvimento' })), /Categoria renomeada/);
  assert.match(await flashOf(lucas, await lucas.post(`/categories/${ids.dev}`, { name: 'Dev Time' })), /Categoria renomeada/);

  // Isolamento: categorias e tarefas de outro Workspace não são alcançáveis.
  assert.equal((await lucas.postJson('/api/tasks/move', { id: l1, category_id: ids.work })).status, 422);
  assert.equal((await lucas.postJson('/api/tasks/move', { id: ids.a, category_id: ids.design })).status, 404);
  assert.equal((await lucas.post(`/categories/${ids.work}`, { name: 'Invadida' })).status, 404);
  assert.equal((await lucas.post(`/categories/${ids.work}/delete`)).status, 404);
  assert.equal((await categoryByName('Trabalho Novo')).id, ids.work);
  assert.doesNotMatch((await lucas.get('/categories')).text, /Trabalho Novo/);

  // Excluir categoria: as tarefas ficam, sem categoria.
  const removed = await flashOf(lucas, await lucas.post(`/categories/${ids.design}/delete`));
  assert.match(removed, /Categoria excluída/);
  assert.match(removed, /ficaram sem categoria/);
  assert.equal(await categoryByName('Design'), undefined);
  assert.equal((await task(l1)).category_id, null);
});

test('excluir categoria principal remove as subcategorias e preserva as tarefas', async () => {
  const res = await ana.post(`/categories/${ids.work}/delete`);
  assert.match(await flashOf(ana, res), /ficaram sem categoria/);
  assert.equal(await categoryByName('Trabalho Novo'), undefined);
  assert.equal(await sql('SELECT id FROM categories WHERE id = ?', [ids.meet]).then(rows => rows.length), 0, 'subcategoria vai junto');
  for (const id of [ids.a, ids.b, ids.c, ids.d, ids.sub]) {
    const row = await task(id);
    assert.ok(row, 'a tarefa continua existindo');
    assert.equal(row.category_id, null);
  }
  // Sobra a outra subcategoria "Reuniões" (sob Pessoal).
  assert.equal(await countCategories('Reuniões'), 1);
});
