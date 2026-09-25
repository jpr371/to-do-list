# TaskFlow

Projeto PHP + MySQL/MariaDB para rodar no XAMPP.

## Como rodar no XAMPP

1. Clone o projeto dentro de `C:\xampp\htdocs`:

```bash
cd C:\xampp\htdocs
git clone https://github.com/jpr371/to-do-list.git todolist
```

2. Abra o XAMPP e inicie:

- Apache
- MySQL

3. Importe o banco que já está no Git:

- abra `http://localhost/phpmyadmin`
- clique em **Importar**
- selecione o arquivo `C:\xampp\htdocs\todolist\database.sql`
- clique em **Executar**

O banco criado se chama:

```text
taskflow_lite
```

4. Abra o projeto:

```text
http://localhost/todolist/
```

## Login inicial

```text
Usuário: zalen
Senha: 123456
```

Também dá para criar uma conta nova em:

```text
http://localhost/todolist/register.php
```

## Configuração do banco

O projeto usa a configuração padrão do XAMPP em `config/database.php`:

```text
host: 127.0.0.1
porta: 3306
usuário: root
senha: vazia
banco: taskflow_lite
```

Se o MySQL do PC tiver senha, altere `DB_PASS` em `config/database.php`.
