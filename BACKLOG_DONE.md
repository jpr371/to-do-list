# Backlog marcado como Done — cobertura no TaskFlow

Este arquivo relaciona os itens exibidos como **Done** no GitHub Project com a versão atual do site.

| Item do backlog | Situação | Onde está no sistema |
|---|---|---|
| Organização das tarefas no GitHub Project | Concluído como atividade de gestão | É uma atividade externa ao site; o quadro do GitHub é a evidência |
| Criação do protótipo funcional inicial do sistema | Implementado | Projeto TaskFlow funcional completo deste ZIP |
| Implementar criação de tarefas | Implementado | `tasks.php` → botão **Criar tarefa / Nova tarefa** |
| Implementar visualização de todas as tarefas | Implementado | `tasks.php` → listagem geral |
| Implementar visualização de tarefas atrasadas | Implementado | Dashboard → card **Atrasadas** e `tasks.php?due=overdue` |
| Implementar pesquisa de tarefas | Implementado | `tasks.php` → pesquisa por título, descrição e categoria |
| Implementar visualização de tarefas próximas do prazo | Implementado | Dashboard → **Tarefas próximas do prazo** e filtro **Próximos 7 dias** |
| Implementar visualização de tarefas por categoria | Implementado | `tasks.php?view=category`, filtro de categoria e resumo no Dashboard |
| Reutilização do Projeto To Do List | Concluído como decisão de desenvolvimento | Esta versão foi construída sobre a base do projeto To Do List/TaskFlow já existente |

## Definição de “próximas do prazo”

Para deixar o comportamento objetivo e testável, o sistema considera **próximas do prazo** as tarefas não concluídas com vencimento entre hoje e os próximos 7 dias, inclusive.

# Itens que estavam em Ready/Backlog — agora implementados

| Item do backlog | Onde está no sistema |
|---|---|
| #17 Implementar criação de subcategorias (também #5) | `/categories` → *Subcategoria*; visão por categoria mostra a subcategoria recuada dentro da principal |
| #3 CRUD de categorias | `/categories` → criar, renomear e excluir (tarefas não são apagadas) |
| #6 Tarefas por categoria | `/tasks?view=category` e filtro de categoria (a principal inclui as subcategorias) |
| #19 Movimentação de tarefas entre categorias | Arrastar, seletor da linha e *Mover para outra categoria* nos detalhes; só a categoria muda |
| #20 Reordenação manual na categoria | Arrastar ou botões subir/descer; ordem salva em `tasks.position` e mantida entre sessões |
| #14 / #15 Reabertura de tarefa concluída | Botão *Reabrir* nos detalhes da tarefa concluída (já existia) |
| #21 Validar campos antes de prosseguir | Validação por etapa no cadastro (`assets/js/app.js`) e no servidor (já existia) |
