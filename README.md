# TaskFlow

TaskFlow e um ToDoList em Node.js MVC com Express, EJS e MySQL/MariaDB. A aplicacao tem cadastro em etapas, perfil de usuario, preferencias, upload de avatar e separacao de tarefas por Workspace pessoal ou de equipe.

## Tecnologias

- Node.js com ES Modules
- Express 5
- EJS
- MySQL/MariaDB
- CSS e JavaScript proprios
- Multer para upload de imagens em memoria

## Instalacao

```bash
git clone https://github.com/jpr371/to-do-list.git
cd to-do-list
npm install
copy .env.example .env
```

No Linux/macOS, use `cp .env.example .env`.

## Banco de dados

O projeto usa MySQL/MariaDB. Por padrao, a conexao espera:

```text
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=taskflow_lite
DB_USER=root
DB_PASS=
```

Para ambiente local novo, importe `database.sql` pelo phpMyAdmin ou pelo cliente MySQL. Esse arquivo recria o banco `taskflow_lite` do zero, entao nao use em um banco que ja contenha dados importantes.

Depois da importacao inicial, use as migracoes incrementais:

```bash
npm run migrate
```

As migracoes ficam em `config/migrations.js`, registram execucoes em `schema_migrations` e preservam contas e tarefas existentes. O servidor tambem executa migracoes pendentes automaticamente ao iniciar.

## Executar

```bash
npm start
```

Abra:

```text
http://localhost:3000
```

Durante o desenvolvimento:

```bash
npm run dev
```

## Login de demonstracao

```text
Usuario: zalen
Senha: 123456
```

Tambem e possivel criar uma conta nova em `/register`.

## Arquitetura

- `server.js`: configura Express, EJS, locals globais, conexao e migracoes.
- `routes/index.js`: define rotas de autenticacao, perfil, Workspaces, tarefas e Kanban.
- `controllers/`: recebe requisicoes, valida dados e escolhe views/redirecionamentos.
- `models/`: concentra consultas SQL e regras de isolamento por usuario/Workspace.
- `middlewares/`: sessao, assets, uploads estaticos e carregamento do usuario autenticado.
- `views/`: telas EJS e partials compartilhados.
- `assets/`: CSS e JavaScript do frontend.
- `uploads/`: imagens enviadas por usuarios, ignoradas pelo Git.

## Funcionalidades existentes

- Cadastro em quatro etapas com escolha entre uso pessoal e equipe/empresa.
- Criacao automatica de Workspace pessoal para toda conta.
- Criacao de Workspace de equipe para contas profissionais.
- Login automatico apos cadastro.
- Perfil com nome, e-mail, ocupacao, biografia, avatar, preferencias, notificacoes e senha.
- Seletor de Workspace na barra lateral quando o usuario tem mais de um ambiente.
- Tarefas isoladas por Workspace ativo.
- Migracao de contas antigas para Workspace pessoal sem apagar tarefas.
- Edicao de dados e imagem da equipe por proprietario ou administrador.

## Roteiro de teste manual

1. Cadastro pessoal:
   - Acesse `/register`.
   - Escolha `Uso pessoal`.
   - Preencha nome, e-mail e senha.
   - Escolha preferencias opcionais.
   - Confirme e verifique se o painel abre logado.

2. Cadastro profissional:
   - Acesse `/register` sem estar logado.
   - Escolha `Equipe ou empresa`.
   - Preencha dados do responsavel e da equipe.
   - Confirme e verifique se aparecem os Workspaces `Pessoal` e da equipe.

3. Perfil:
   - Acesse `Meu perfil`.
   - Edite nome, ocupacao e biografia.
   - Para alterar e-mail, informe a senha atual.
   - Teste upload e remocao de avatar com JPG, PNG ou WEBP de ate 2 MB.
   - Altere preferencias e confirme o menu lateral.

4. Workspaces:
   - Crie uma tarefa no Workspace pessoal.
   - Troque para a equipe e confirme que a tarefa pessoal nao aparece.
   - Crie uma tarefa na equipe e volte ao pessoal para confirmar o isolamento.
   - Faca logout e login novamente para confirmar que o ultimo Workspace selecionado foi mantido.

5. Permissoes:
   - A pagina `/profile` sempre usa o usuario da sessao; nao ha id de usuario no formulario.
   - A pagina `/workspaces/:id` so abre para membros.
   - A edicao de equipe exige papel `owner` ou `admin` no backend.

## Observacoes de seguranca

- Nao versione `.env`, `uploads/`, `node_modules/`, logs ou dumps com dados reais.
- Uploads sao validados pela assinatura do arquivo, nao apenas pela extensao.
- As migracoes sao nao destrutivas; evite executar `database.sql` sobre bancos com dados reais.
