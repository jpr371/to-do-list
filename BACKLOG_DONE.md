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
