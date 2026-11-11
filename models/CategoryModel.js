import { query } from '../config/database.js';

export const CATEGORY_NAME_MAX = 60;

export const cleanCategoryName = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, CATEGORY_NAME_MAX);

// Categorias pertencem ao Workspace ativo (o ambiente pessoal também é um Workspace).
// Existem só dois níveis: categoria principal (parent_id NULL) e subcategoria.
export default class CategoryModel {
  static async find(scope, id) {
    const rows = await query(
      `SELECT c.*, p.name AS parent_name FROM categories c LEFT JOIN categories p ON p.id = c.parent_id
       WHERE c.workspace_id = ? AND c.id = ? LIMIT 1`,
      [scope.workspaceId, Number(id) || 0]
    );
    return rows[0] || null;
  }

  // Árvore completa com a contagem de tarefas (a contagem de uma principal inclui as subcategorias).
  static async tree(scope) {
    const rows = await query(
      `SELECT c.id, c.parent_id, c.name, c.created_by,
              COUNT(t.id) AS task_count,
              COALESCE(SUM(t.status = 'done'), 0) AS done_count
       FROM categories c
       LEFT JOIN tasks t ON t.category_id = c.id AND t.workspace_id = c.workspace_id
       WHERE c.workspace_id = ?
       GROUP BY c.id, c.parent_id, c.name, c.created_by
       ORDER BY c.name ASC, c.id ASC`,
      [scope.workspaceId]
    );
    const nodes = rows.map(row => ({
      ...row,
      id: Number(row.id),
      parent_id: row.parent_id ? Number(row.parent_id) : null,
      own_count: Number(row.task_count),
      own_done: Number(row.done_count),
      children: []
    }));
    const byId = new Map(nodes.map(node => [node.id, node]));
    const roots = [];
    nodes.forEach(node => {
      const parent = node.parent_id ? byId.get(node.parent_id) : null;
      if (parent) parent.children.push(node);
      else roots.push(node);
    });
    roots.forEach(root => {
      root.total_count = root.own_count + root.children.reduce((sum, child) => sum + child.own_count, 0);
      root.total_done = root.own_done + root.children.reduce((sum, child) => sum + child.own_done, 0);
      root.children.forEach(child => { child.total_count = child.own_count; child.total_done = child.own_done; });
    });
    return roots;
  }

  // Lista plana para selects: principal seguida das subcategorias.
  static flatten(tree) {
    return tree.flatMap(root => [
      { id: root.id, name: root.name, label: root.name, depth: 0, parent_id: null },
      ...root.children.map(child => ({ id: child.id, name: child.name, label: `${root.name} / ${child.name}`, depth: 1, parent_id: root.id }))
    ]);
  }

  static async siblingExists(workspaceId, parentId, name, exceptId = 0) {
    const rows = await query(
      `SELECT id FROM categories WHERE workspace_id = ? AND parent_id <=> ? AND name = ? AND id <> ? LIMIT 1`,
      [workspaceId, parentId || null, name, exceptId]
    );
    return Boolean(rows[0]);
  }

  // Retorna { id } ou { error }.
  static async create(scope, { name, parentId = null }) {
    const clean = cleanCategoryName(name);
    if (!clean) return { error: 'Informe o nome da categoria.' };
    let parent = null;
    if (parentId) {
      parent = await CategoryModel.find(scope, parentId);
      if (!parent) return { error: 'A categoria principal escolhida não existe.' };
      if (parent.parent_id) return { error: 'Subcategorias só podem ser criadas dentro de uma categoria principal.' };
    }
    if (await CategoryModel.siblingExists(scope.workspaceId, parent?.id, clean)) {
      return { error: parent ? `Já existe a subcategoria "${clean}" em ${parent.name}.` : `Já existe a categoria "${clean}".` };
    }
    const result = await query(
      'INSERT INTO categories (workspace_id, parent_id, name, created_by) VALUES (?, ?, ?, ?)',
      [scope.workspaceId, parent?.id || null, clean, scope.userId]
    );
    return { id: Number(result.insertId), name: clean, parent };
  }

  static async rename(scope, category, name) {
    const clean = cleanCategoryName(name);
    if (!clean) return { error: 'Informe o nome da categoria.' };
    if (await CategoryModel.siblingExists(scope.workspaceId, category.parent_id, clean, category.id)) {
      return { error: `Já existe uma categoria chamada "${clean}" neste nível.` };
    }
    await query('UPDATE categories SET name = ? WHERE id = ? AND workspace_id = ?', [clean, category.id, scope.workspaceId]);
    return { name: clean };
  }

  // Excluir uma principal exclui as subcategorias (FK em cascata); as tarefas ficam sem categoria.
  static async remove(scope, category) {
    const [counts] = await query(
      `SELECT COUNT(DISTINCT c.id) - 1 AS subs, COUNT(t.id) AS tasks
       FROM categories c LEFT JOIN tasks t ON t.category_id = c.id
       WHERE c.workspace_id = ? AND (c.id = ? OR c.parent_id = ?)`,
      [scope.workspaceId, category.id, category.id]
    );
    await query('DELETE FROM categories WHERE id = ? AND workspace_id = ?', [category.id, scope.workspaceId]);
    return { subcategories: Number(counts.subs), tasks: Number(counts.tasks) };
  }

  // Compatibilidade com formulários antigos que enviam o nome da categoria como texto.
  static async findOrCreateByName(scope, name) {
    const clean = cleanCategoryName(name);
    if (!clean) return null;
    const rows = await query(
      'SELECT id FROM categories WHERE workspace_id = ? AND parent_id IS NULL AND name = ? LIMIT 1',
      [scope.workspaceId, clean]
    );
    if (rows[0]) return Number(rows[0].id);
    const created = await CategoryModel.create(scope, { name: clean });
    return created.id || null;
  }
}
