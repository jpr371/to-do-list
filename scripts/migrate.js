import 'dotenv/config';
import { pool } from '../config/database.js';
import { runMigrations } from '../config/migrations.js';

try {
  await runMigrations();
  console.log('Banco atualizado.');
} catch (err) {
  console.error('Falha ao aplicar migrações:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
