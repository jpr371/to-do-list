<?php
declare(strict_types=1);

/**
 * Configuração padrão para XAMPP.
 * Se o MySQL tiver senha, altere DB_USER/DB_PASS abaixo.
 */
const DB_HOST = '127.0.0.1';
const DB_PORT = '3306';
const DB_NAME = 'taskflow_lite';
const DB_USER = 'root';
const DB_PASS = '';

function db(bool $withoutDatabase = false): PDO {
    static $connections = [];
    $key = $withoutDatabase ? 'server' : 'database';
    if (isset($connections[$key])) {
        return $connections[$key];
    }

    $dsn = $withoutDatabase
        ? 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';charset=utf8mb4'
        : 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4';

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci",
        ]);
    } catch (PDOException $e) {
        throw new RuntimeException(
            $withoutDatabase
                ? 'Não foi possível conectar ao MySQL. Confirme se o MySQL está iniciado no XAMPP e revise config/database.php.'
                : 'Banco TaskFlow ainda não está disponível. Acesse install.php para criar o banco e as tabelas.',
            0,
            $e
        );
    }

    $connections[$key] = $pdo;
    return $pdo;
}
