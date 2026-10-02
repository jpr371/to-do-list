import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import router from './routes/index.js';
import { applyMiddlewares } from './middlewares/index.js';
import { testConnection } from './config/database.js';
import { templateLocals } from './utils/viewHelpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

applyMiddlewares(app, __dirname);
app.use((req, res, next) => {
  res.locals = { ...res.locals, ...templateLocals(req) };
  next();
});

app.use(router);

app.use((req, res) => {
  res.status(404).send('Página não encontrada.');
});

await testConnection();

app.listen(port, () => {
  console.log(`TaskFlow rodando em http://localhost:${port}`);
});
