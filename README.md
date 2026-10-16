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

Para ambiente local novo, importe `database.sql` pelo phpMyAdmin ou pelo cliente MySQL. O arquivo nao apaga nada: cria o banco e as tabelas apenas se nao existirem e insere a conta de demonstracao somente quando o banco ainda nao tem usuarios. Um banco vazio tambem pode ser montado apenas com `npm run migrate`.

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
- Exclusao de conta no perfil, com confirmacao por senha, removendo tarefas, atividades, Workspaces e imagens do usuario.
- Seletor de Workspace na barra lateral quando o usuario tem mais de um ambiente.
- Tarefas isoladas por Workspace ativo.
- Migracao de contas antigas para Workspace pessoal sem apagar tarefas.
- Edicao de dados e imagem da equipe pelo proprietario.

## Colaboracao em equipe

- **Convites** (`/workspaces/:id`, painel *Convidar integrante*): por link ou vinculados a um e-mail, com cargo inicial e validade (1, 3, 7 ou 30 dias). Cada convite vale uma vez; o banco guarda so o hash SHA-256 do token e o link aparece uma unica vez para quem o criou. Convites por e-mail tambem aparecem no painel do destinatario. O sistema nao envia e-mails: o link deve ser repassado pela equipe.
- **Fluxo do convidado** (`/invite/:token`): quem nao esta logado vai para o login ou cadastro e volta ao convite depois; aceitar adiciona o usuario a equipe e ativa o Workspace no seletor lateral.
- **Integrantes e cargos**: lista com avatar, e-mail, cargo e tarefas em aberto; promocao/rebaixamento, transferencia de propriedade, remocao e saida da equipe, sempre com confirmacao.
- **Responsaveis**: tarefas da equipe podem ter um responsavel (tabela `task_assignees`, ja preparada para varios), com filtro por integrante e *Atribuidas a mim* na lista, no Kanban e no Dashboard.
- **Dashboard da equipe**: total, pendentes, em andamento, concluidas, atrasadas, atribuidas a mim, progresso, distribuicao por integrante, resumo de 7 dias e atividade com autor, com filtros por responsavel e status. O modo pessoal mantem o Dashboard individual.

### Cargos

| Acao | Proprietario | Administrador | Membro |
|---|---|---|---|
| Ver tarefas e integrantes da equipe | sim | sim | sim |
| Criar tarefas | sim | sim | sim (responsavel: ele mesmo ou ninguem) |
| Editar/excluir qualquer tarefa e atribuir a qualquer integrante | sim | sim | apenas as que criou |
| Atualizar status | sim | sim | tarefas que criou ou pelas quais e responsavel |
| Convidar | membros e administradores | membros | nao |
| Remover integrantes | administradores e membros | membros | nao |
| Alterar cargos / transferir propriedade | sim | nao | nao |
| Configuracoes da equipe (nome, imagem) | sim | nao | nao |
| Sair da equipe | apos transferir a propriedade | sim | sim |

As regras ficam em `services/permissions.js` e sao aplicadas no backend (`middlewares/workspace.js` e controllers). O proprietario nunca pode ser removido; integrantes removidos perdem o acesso imediatamente e suas atribuicoes sao desfeitas. Convites deixam de valer se quem os criou perder a permissao de conceder aquele cargo.

## Testes automatizados

Os testes de integracao sobem o servidor real contra um banco de testes e percorrem por HTTP os fluxos de convite, cargos, atribuicao, isolamento entre equipes, Dashboard, avatar e login/logout com varias contas:

```bash
TEST_DB_NAME=taskflow_test TEST_DB_PORT=3306 npm test
```

O banco informado e apagado e recriado a cada execucao; por seguranca, o nome precisa terminar em `_test`. Variaveis opcionais: `TEST_DB_HOST`, `TEST_DB_USER`, `TEST_DB_PASS`, `TEST_PORT`.

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
   - A edicao de equipe exige o papel `owner` no backend.

6. Colaboracao:
   - Com uma conta de equipe, abra *Equipe* e gere um convite.
   - Abra o link em uma janela anonima, crie uma conta e aceite.
   - Atribua uma tarefa ao novo integrante, entre com ele e altere o status.
   - Confira o Dashboard da equipe na conta do proprietario.

## Observacoes de seguranca

- Nao versione `.env`, `uploads/`, `node_modules/`, logs ou dumps com dados reais.
- Uploads sao validados pela assinatura do arquivo, nao apenas pela extensao.
- As migracoes e o `database.sql` sao nao destrutivos.
- Tokens de convite nao aparecem no log de requisicoes.
- Defina `APP_URL` no `.env` se os links de convite precisarem usar um endereco diferente do acessado pelo navegador.
