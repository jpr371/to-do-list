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
