# TaskFlow

Projeto ToDoList em Node.js MVC usando MySQL/MariaDB do XAMPP.

## Tecnologias

- Node.js
- Express
- EJS
- MySQL/MariaDB
- CSS e JavaScript proprios

## Como rodar

1. Clone o projeto dentro de `C:\xampp\htdocs`:

```bash
cd C:\xampp\htdocs
git clone https://github.com/jpr371/to-do-list.git todolist
cd todolist
```

2. Inicie o MySQL pelo XAMPP.

3. Importe o banco que ja esta no Git:

- abra `http://localhost/phpmyadmin`
- clique em **Importar**
- selecione `C:\xampp\htdocs\todolist\database.sql`
- clique em **Executar**

O banco criado se chama:

```text
taskflow_lite
```

4. Instale e rode o projeto:

```bash
npm install
copy .env.example .env
npm start
```

5. Abra:

```text
http://localhost:3000
```

## Atualizacoes do banco (migracoes)

Ao rodar `npm start`, o servidor aplica automaticamente as migracoes pendentes
(`config/migrations.js`). Elas sao incrementais e nao apagam nada: contas, tarefas
e categorias existentes sao mantidas. Cada migracao roda uma unica vez e fica
registrada na tabela `schema_migrations`.

Para aplicar manualmente, sem subir o servidor:

```bash
npm run migrate
```

Se o banco ja estiver importado, **nao e preciso importar o `database.sql` de novo**
(ele recria o banco do zero).

## Cadastro, perfil e equipes

- **Cadastro em etapas** (`/register`): escolha entre *Uso pessoal* e *Equipe ou empresa*,
  dados da conta, personalizacao (opcional) ou dados da equipe, e confirmacao.
- **Meu perfil** (`/profile`, pelo menu do usuario): nome, e-mail, ocupacao, biografia,
  foto de perfil (JPG, PNG ou WEBP ate 2 MB), preferencias, notificacoes e troca de senha.
- **Equipe** (`/workspaces/:id`): dados, imagem e informacoes da equipe. Somente
  proprietario ou administrador pode editar.
- Toda conta tem um ambiente **Pessoal**. Quem cria uma equipe alterna entre os ambientes
  pelo seletor na barra lateral, com a mesma conta. As tarefas ficam separadas por ambiente.
- As imagens enviadas ficam em `uploads/` (fora do Git).

## Login inicial

```text
Usuario: zalen
Senha: 123456
```

Tambem da para criar uma conta nova em:

```text
http://localhost:3000/register
```

## Configuracao do banco

Por padrao o projeto usa:

```text
host: 127.0.0.1
porta: 3306
usuario: root
senha: vazia
banco: taskflow_lite
```

Se o MySQL tiver senha, altere `DB_PASS` no arquivo `.env`.
