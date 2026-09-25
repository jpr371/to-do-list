<?php
// Conteúdo compartilhado do <head>. Espera $headTitle (título completo da aba).
?>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
    <meta name="description" content="TaskFlow — organize tarefas, prazos, categorias e fluxo de trabalho num só lugar.">
    <meta name="theme-color" content="#f2ecdf">
    <script>(function(){try{var t=localStorage.getItem('tf-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();</script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
    <link rel="icon" type="image/svg+xml" href="assets/favicon.svg">
    <title><?=htmlspecialchars($headTitle ?? 'TaskFlow', ENT_QUOTES, 'UTF-8')?></title>
    <link rel="stylesheet" href="assets/css/app.css">
