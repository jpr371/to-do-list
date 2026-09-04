# STATUS — Revisão de Design (UX/UI/Front-end)

> Levantamento completo do projeto TaskFlow LITE, correções aplicadas e resumo antes/depois.
> Status: **concluído** — todos os itens do levantamento abaixo foram corrigidos e testados
> manualmente no navegador (login, criação/edição/exclusão/conclusão de tarefa, Kanban com
> drag-and-drop, filtros, visão por categoria) em três larguras (375px, 768px, 1440px).

## Escopo revisado

Todos os arquivos do projeto foram lidos por completo: `index.php`, `login.php`, `install.php`,
`dashboard.php`, `tasks.php` (lista, visão por categoria, modal de criar/editar tarefa),
`kanban.php`, `includes/header.php`, `includes/footer.php`, `includes/bootstrap.php`,
`api/task-status.php`, `assets/css/app.css` e `assets/js/app.js`.

Telas/fluxos cobertos: login, instalador de banco, dashboard, lista de tarefas, busca e filtros,
tarefas atrasadas/próximas do prazo, visão por categoria, criação/edição de tarefa (modal),
exclusão de tarefa, ações em lote, Kanban com drag-and-drop, menu de perfil/logout, estados vazios,
alertas de sucesso/erro e toast.

O projeto não é um repositório git — os commits pedidos no processo de trabalho só poderão
começar depois de rodarmos `git init` (ou o repositório for inicializado por você).

---

## Levantamento de melhorias de design

### A. Bug de integração CSS/HTML (não é só estética — o elemento está sem estilo nenhum)

1. **Classe CSS não corresponde à classe usada no HTML.**
   `assets/css/app.css:14` define `.demo-box{...}`, mas o HTML usa `class="login-demo"` em
   [`login.php:79`](login.php:79) e três vezes em [`install.php:113`](install.php:113),
   [`install.php:116`](install.php:116), [`install.php:117`](install.php:117).
   Resultado: a caixa de credenciais de acesso nas telas de login e instalação está **sem nenhum
   estilo aplicado** hoje (sem borda, sem fundo, sem espaçamento) — provavelmente a causa mais
   visível de "aparência inacabada" nessas duas telas. Precisa decidir: renomear a classe no CSS
   para `.login-demo`, ou trocar a classe no HTML — de qualquer forma, unificar.

### B. Rótulo "eyebrow" em caixa alta — padrão genérico repetido em quase toda tela

Classe `.eyebrow` (`assets/css/app.css:6`, `text-transform:uppercase; letter-spacing:.11em`).
Usada de forma excessiva e às vezes redundante:

- `login.php:45` "ORGANIZAÇÃO SEM ATRITO", `login.php:56` "ACESSO AO SISTEMA"
- `install.php:97` "INSTALAÇÃO MYSQL", `install.php:106` "CONFIGURAÇÃO"
- `includes/header.php:20` — eyebrow dinâmico com o perfil do usuário, presente no topo de
  **todas as páginas internas**
- `dashboard.php` — **seis eyebrows na mesma tela**: linhas 75, 91, 106, 122, 132, 142
  ("EXPERIÊNCIA FREELANCER / CRIADOR", "PRAZOS", "PRIORIDADE DINÂMICA", "CATEGORIAS",
  "PROGRESSO", "HISTÓRICO")
- `kanban.php:22` "FLUXO VISUAL"
- `tasks.php:179` "CENTRAL DE EXECUÇÃO"; `tasks.php:209` "CATEGORIA" — este último se repete
  **acima do nome de cada categoria**, uma vez por card, o que é ruído puro, não hierarquia
- `tasks.php:251` "TAREFA" no cabeçalho do modal de criar/editar

Precisa de um novo padrão de cabeçalho de seção que não dependa desse recurso como principal
ferramenta de hierarquia — ou usá-lo com muito mais parcimônia (talvez só no topbar).

### C. Ícones — caracteres Unicode digitados, não um sistema de ícones

Não há nenhum SVG no projeto. Os "ícones" são glifos de texto, que variam de peso e estilo
conforme fonte/SO/navegador e não têm identidade visual própria:

- Métricas do dashboard: `☷` `▣` `!` `→` `✓` (`dashboard.php:83-87`)
- Busca: `⌕` (`includes/header.php:24`)
- Adicionar tarefa: `＋` (`includes/header.php:25`, `kanban.php:22`, `tasks.php:182`)
- Visão por categoria: `▦` (`tasks.php:181`)
- Editar no Kanban: `↗` (`kanban.php:31`); editar na tabela: `✎`; excluir: `×`
  (`tasks.php:239`, botão fechar do modal `tasks.php:251`)
- Ícones de estado vazio: `→` `✓` `▦` `☷` (dashboard e tasks, vários pontos)

Proposta: substituir por um conjunto pequeno e consistente de ícones SVG inline (12-16 ícones
cobrem o app inteiro), desenhados na mesma linha visual (stroke-width, tamanho de grade).

### D. Cores de status e prioridade — sistema incompleto

O `:root` já define uma paleta base (bom ponto de partida), mas a aplicação dela em
status/prioridade está incompleta:

- `.priority-normal` **não tem regra própria** — cai no `.badge` genérico cinza. Ou seja,
  prioridade "Normal" é visualmente idêntica a qualquer badge sem cor.
- Dos 5 status (`inbox`, `pending`, `progress`, `review`, `done`), só `.status-done` tem cor
  própria (`assets/css/app.css:6`). Na tabela de tarefas e nas colunas do Kanban, uma tarefa
  "Pendente", "Em andamento" e "Em revisão" são visualmente indistinguíveis por cor — o único
  sinal é o texto do badge. Para um app de fluxo/Kanban, isso é uma lacuna grande de hierarquia
  visual.
- Colunas do Kanban (`kanban.php:26`) não têm nenhuma cor de identificação por etapa — todas as
  5 colunas usam o mesmo cabeçalho neutro.

### E. Cards e linhas de tarefa sem hierarquia visual por urgência

- `.kanban-card` (`assets/css/app.css:12`) tem o mesmo fundo/borda para qualquer prioridade —
  a única pista de urgência é o texto pequeno do badge.
- `.row-overdue` (`assets/css/app.css:8`) aplica `background:rgba(255,102,117,.025)` — 2,5% de
  opacidade é, na prática, imperceptível. Uma tarefa atrasada deveria se destacar claramente na
  tabela (`tasks.php`) e nos cards compactos do dashboard.
- `.compact-task` (dashboard) e `.category-task` (`tasks.php`) têm o mesmo tratamento visual
  independente de prioridade/prazo.

### F. Gradientes decorativos sem função clara

- `.hero{background:linear-gradient(115deg,#1c1c1c,#242109)}` — dashboard, sem relação com o
  conteúdo do card.
- `.login-body` — `radial-gradient` dourado decorativo no canto (`assets/css/app.css:14`).
- `.login-brand-panel{background:linear-gradient(145deg,#171717,#252109)}`.
- `.avatar` e `.progress span` usam gradiente dourado→dourado quase idêntico — efeito sutil que
  não agrega, apenas adiciona ruído visual.

Não precisam ser removidos por princípio, mas devem ganhar propósito (ex.: gradiente ligado ao
progresso real, não decorativo) ou dar lugar a um tratamento mais sóbrio.

### G. Espaçamento sem escala sistemática

Não existe uma escala de espaçamento (`--space-1`, `--space-2`...) — os paddings/margins são
valores soltos espalhados pelo CSS (`assets/css/app.css` inteiro: 20px, 18px, 14px, 16px, 22px,
24px, 38px, 62px, 52px, 45px, 42px...). Há também estilo inline pontual fora do sistema:
`dashboard.php:135` (`style="width:<?=$pct?>%"` — esse é aceitável por ser dinâmico) e
`install.php:121` (`style="margin-top:16px"` — esse não precisa ser inline).

### H. Estados vazios tratados como texto simples

`.empty-state` (`assets/css/app.css:6`) é usado em 4 lugares (`dashboard.php:93`,
`dashboard.php:108`, `tasks.php:206`, `tasks.php:230`) com o mesmo tratamento genérico: texto
centralizado + glifo Unicode + link. Não há diferenciação entre "nenhuma tarefa ainda", "busca
sem resultado" e "nenhuma categoria criada" — cada contexto merece uma mensagem e (opcionalmente)
uma ilustração/ícone própria.

### I. Feedback visual insuficiente em ações

- **Concluir tarefa**: não existe ação rápida de "concluir" — só trocar o status no modal, em
  lote, ou arrastar no Kanban. Nenhuma microinteração (sem risco de texto, sem check animado).
- **Drag-and-drop no Kanban** (`assets/js/app.js:41-76`): o único feedback é `opacity:.45` no
  card arrastado e um toast textual ao soltar — sem destaque na coluna de destino, sem animação
  de entrada do card.
- **Exclusão de tarefa** (`assets/js/app.js:27-35`): usa `confirm()` nativo do navegador, que
  quebra a identidade visual construída no resto do app.
- **Toast** (`assets/css/app.css:14`) é uma caixa cinza genérica, sem ícone, sem diferenciação
  visual forte entre sucesso/erro além da borda.
- **Alertas de sucesso/erro** (`includes/header.php:47-48`) usam o mesmo componente `.alert`
  para tudo, sem ícone, só cor de borda/texto.

### J. Tipografia estática (sem escala fluida)

Nenhum uso de `clamp()`. Os ajustes de tamanho de fonte entre breakpoints são feitos reescrevendo
regras dentro das media queries (ex.: `.page-heading h1{font-size:1.25rem}` dentro de
`@media(max-width:720px)`, `assets/css/app.css:17`) em vez de uma escala tipográfica fluida.

### K. Estados de foco (teclado) não estilizados

Campos de formulário têm `:focus` bem tratado (`assets/css/app.css:8,14`), mas botões/links de
ícone (`.icon-btn`, `.icon-action`, `.avatar`), chips (`.category-chip`, `.quick-filter`) e itens
do menu de perfil não têm nenhum `:focus-visible` próprio — ficam no outline padrão do navegador,
destoando do resto do polimento visual.

### L. Paleta como sistema — variáveis existem, mas o uso é inconsistente

O `:root` (`assets/css/app.css:1-5`) já centraliza as cores principais, o que é uma boa base.
Porém, o restante do CSS ainda usa valores soltos e repetidos em vez de reaproveitar/estender
essas variáveis — por exemplo, várias variações de `rgba(255,214,0,...)` (dourado) em opacidades
diferentes (`.08`, `.09`, `.1`, `.11`, `.2`, `.25`, `.28`, `.32`, `.35`, `.48`, `.55`, `.7`)
espalhadas pelo arquivo, e tons de cinza soltos (`#272727`, `#292929`, `#2f2f2f`, `#303030`,
`#333`, `#383838`, `#3a3a3a`) sem nomes semânticos. Isso torna qualquer ajuste futuro de paleta
mais arriscado, e é a causa raiz de D (prioridade/status incompletos) — não há tokens
`--priority-normal`, `--status-pending`, etc. já prontos para reaproveitar.

### M. Detalhes de polimento final (observações, não prescrições)

- Não há favicon definido em nenhuma página (`<head>` de todas as telas) — o navegador mostra o
  ícone padrão, o que pesa contra a percepção de "produto final".
- As credenciais de demonstração (`zalen / 123456`) ficam expostas diretamente na tela de login
  (`login.php:79-82`) e na tela de instalação (`install.php:113`). Pode ser intencional para fins
  de avaliação/demo do projeto — sinalizando aqui para você decidir se mantém, esconde atrás de
  um clique, ou remove antes da entrega final.
- Não há `<meta name="description">` nem `<meta property="og:*">` em nenhuma página.

---

## Resumo antes → depois

**A — bug do CSS/HTML desalinhado.** Antes: caixa de credenciais sem nenhum estilo (classe
`.demo-box` no CSS nunca batia com `.login-demo` no HTML). Depois: classe unificada, caixa restrita
por padrão dentro de um `<details>` "Credenciais de demonstração" (menos exposta, mas ainda
acessível para quem revisa o projeto).

**B — eyebrows repetidos.** Antes: 15 rótulos em caixa alta espalhados pelo projeto, com 6 só no
dashboard e um repetido por card de categoria. Depois: removidos; cabeçalhos de seção agora usam
um ícone + título (`.section-icon` + `h2`/`h3`), e os 3 usos realmente úteis como contexto de marca
(login, instalador, topbar) viraram um chip `.kicker` com ícone — visualmente diferente do padrão
genérico, usado uma vez por tela em vez de empilhado.

**C — ícones de texto.** Antes: `☷ ▣ ⌕ ＋ ▦ ↗ ✎ × ✓ !` digitados como caracteres. Depois: sistema
de ~24 ícones SVG inline centralizado em [includes/icons.php](includes/icons.php), mesmo
stroke-width/grid em todo o projeto.

**D/L — cores de status e prioridade incompletas / soltas.** Antes: prioridade "Normal" e os
status `inbox/pending/progress/review` sem cor própria (badge cinza genérico); dezenas de valores
`rgba(255,214,0,.XX)` e cinzas soltos repetidos pelo CSS. Depois: paleta completa em `:root`
(`--priority-*`, `--status-*`) aplicada de forma consistente em badges, colunas do Kanban, barra de
progresso do dashboard e chip de categoria.

**E — sem hierarquia visual por urgência.** Antes: cards do Kanban e linhas da tabela idênticos
independente da prioridade; `.row-overdue` com 2,5% de opacidade (imperceptível). Depois: borda de
destaque colorida por prioridade em cards do Kanban e linhas da tabela (`data-priority`), tarefas
atrasadas com tom de fundo bem mais perceptível.

**F — gradientes decorativos.** Antes: gradiente dourado→oliva no hero do dashboard e glow radial
genérico no login, sem propósito. Depois: hero com painel sólido + glow sutil só no canto (menos
"banner de protótipo"), avatar e barra de progresso com cor sólida em vez de gradiente quase
idêntico.

**G — espaçamento sem escala.** Antes: paddings/margins em valores soltos. Depois: escala
`--space-1` a `--space-10` em `:root`, aplicada nos componentes principais.

**H — estados vazios genéricos.** Antes: mesmo texto+glifo para "sem tarefas", "busca sem
resultado" e "sem categoria". Depois: ícone dedicado por contexto e mensagem diferente quando há
filtro ativo ("nenhuma tarefa encontrada com esses filtros" + limpar) vs. quando não há tarefas
("criar sua primeira tarefa"); colunas vazias do Kanban ganharam um placeholder tracejado.

**I — feedback fraco em ações.** Antes: `window.confirm()` nativo para excluir, sem feedback ao
concluir tarefa (só editar status manualmente), toast sem ícone. Depois: diálogo de confirmação
customizado (Esc/clique fora/cancelar funcionam), botão "concluir" rápido na tabela (remove a linha
com animação e persiste via a API já existente), toast com ícone de sucesso/erro, cartão do Kanban
pulsa ao ser solto com sucesso — tudo pulando a animação sob `prefers-reduced-motion`.

**J — tipografia estática.** Antes: tamanhos fixos reescritos em cada media query. Depois:
`clamp()` nos títulos principais (hero, cabeçalhos de seção, telas de login/instalador).

**K — foco de teclado não estilizado.** Antes: outline padrão do navegador em botões/ícones/chips.
Depois: `:focus-visible` global consistente com a paleta (contorno dourado).

**M — polimento final.** Favicon SVG adicionado, `<meta name="description">` nas páginas,
credenciais de demonstração escondidas atrás de um `<details>`.

## Verificação manual (funcionalidade preservada)

- Login com `zalen / 123456` autentica e chega ao dashboard; alternância mostrar/ocultar senha
  mantém o ícone sincronizado com o estado.
- Criação de tarefa (modal) grava título, categoria, prioridade e status corretamente.
- Ação rápida "concluir" na tabela atualiza o status via `api/task-status.php` e persiste após
  recarregar a página.
- Exclusão: diálogo customizado cancela sem excluir; confirmar excluir de fato remove a tarefa.
- Kanban: arrastar-e-soltar entre colunas atualiza o status no banco (testado via simulação de
  eventos de drag e confirmado após reload da página).
- Filtros e busca, visão por categoria e ações em lote testados sem alteração de comportamento.
- Responsivo conferido em 375px (mobile), 768px (tablet) e 1440px (desktop): navegação por abas no
  mobile, grade de métricas em 1/2/5 colunas conforme largura, tabela e quadro Kanban com rolagem
  horizontal própria (padrão já existente, preservado).

## Próximos passos

Nenhum item pendente do levantamento original. Sugestões fora do escopo desta revisão (não
implementadas): dark/light mode alternável, remover de vez as credenciais de demonstração antes de
uma entrega pública real.
