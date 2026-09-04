# TaskFlow LITE — MySQL

Versão enxuta do TaskFlow feita para o Projeto To Do List, usando PHP + MySQL/MariaDB no XAMPP.

## Funcionalidades implementadas

Esta versão cobre as funcionalidades que já estavam marcadas como **Done** no backlog:

- criação do protótipo funcional do sistema;
- criação de tarefas;
- visualização de todas as tarefas;
- visualização de tarefas atrasadas;
- pesquisa de tarefas por título, descrição ou categoria;
- visualização de tarefas próximas do prazo (hoje até os próximos 7 dias);
- categorias nas tarefas;
- filtro de tarefas por categoria;
- visualização agrupada de tarefas por categoria.

Além disso, a versão mantém:

- login com sessão PHP;
- Dashboard;
- Kanban com drag-and-drop;
- prioridades e status;
- edição e exclusão de tarefas;
- ações em lote;
- histórico de atividades;
- banco MySQL/MariaDB.

> “Organização das tarefas no GitHub Project” e “Reutilização do Projeto To Do List” são atividades de desenvolvimento/gestão do projeto, e não telas ou funções executadas pelo sistema.

## Instalação no XAMPP

1. Extraia a pasta `TaskFlow_LITE` em `C:\xampp\htdocs\`.
2. Inicie **Apache** e **MySQL** no XAMPP.
3. Abra `http://localhost/TaskFlow_LITE/install.php`.
4. Clique em **Criar / atualizar banco**.
5. Acesse `http://localhost/TaskFlow_LITE/`.

### Login inicial

- Usuário: `zalen`
- Senha: `123456`

## Atualizando a versão anterior

Se você já tinha instalado a primeira versão MySQL, **não precisa apagar o banco**.

Substitua os arquivos do projeto pela nova versão e abra novamente:

`http://localhost/TaskFlow_LITE/install.php`

O instalador detecta se o campo de categoria não existe e faz a migração automaticamente, preservando as tarefas antigas.

## Banco

Configuração padrão em `config/database.php`:

- host: `127.0.0.1`
- porta: `3306`
- usuário: `root`
- senha: vazia
- banco: `taskflow_lite`

O arquivo `database.sql` está incluído para instalação manual pelo phpMyAdmin em uma instalação nova.
