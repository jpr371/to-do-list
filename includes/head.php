<?php
// Conteúdo compartilhado do <head>. Espera $headTitle (título completo da aba).
?>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="description" content="TaskFlow — organize tarefas, prazos, categorias e fluxo de trabalho num só lugar.">
    <meta name="theme-color" content="#f2ecdf">
    <script>(function(){try{var t=localStorage.getItem('tf-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    <title><?=htmlspecialchars($headTitle ?? 'TaskFlow', ENT_QUOTES, 'UTF-8')?></title>
    <link rel="stylesheet" href="assets/css/app.css?v=<?=filemtime(__DIR__ . '/../assets/css/app.css')?>">
