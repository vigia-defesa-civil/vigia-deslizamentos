# Revisão de design: ajustes finos

Levantamento de 29/10/2026, no build de produção da branch `fix/bloqueantes-entrega` (`frontend/dist`, já sem a tela Monitoramento SC), nas 6 telas, a 320, 768 e 1366 px, nos temas claro e escuro. Só relatório: nenhum layout, paleta, tipografia, direção de arte ou arquitetura de componente muda. São no máximo 15 ajustes baratos, para você escolher quais entram num plano.

## Como foi medido

| Skill | O que rodou | Resultado |
|---|---|---|
| ui-ux-pro-max | `search.py "public safety risk dashboard map" --stack astro` e `--stack react`; buscas `--domain ux` por contraste, foco visível, alvo de toque, rolagem lateral, cor como único indicador, reduced-motion e rótulo de chip que quebra | As buscas por stack **não encontraram diretriz no banco**: astro deu 0 resultados nas duas tentativas, e react só devolveu uma regra de testes, fora do tema. As diretrizes de `ux` vieram do banco e serviram de régua para as medições |
| taste-skill (design-taste-frontend) | Só a auditoria de tela existente: `inspect.mjs --app --widths 1366,768,320` nas 6 telas, e leitura das capturas | Os achados de legibilidade e de quadro estão abaixo. As regras da casa que pediriam trocar a identidade foram descartadas (ver "Achados descartados") |
| design-motion-principles | Modo Audit, `--terminal`, Emil Kowalski como lente principal | Relatório completo no apêndice. O modo terminal não cria a pasta `motion-audits/`, então o `.gitignore` não mudou |
| Medições próprias (Playwright, fora do repositório) | Rolagem lateral, alvos menores que 24 px, foco por Tab, rótulos que quebram, o que ainda se move com reduced-motion, e axe (contraste e tamanho de alvo) a 320 px | Ver "O que já está bom" |
| Referências (`docs/design/referencias/`) | — | **A pasta não existe**, nem versionada nem local. Item pulado |

### O que já está bom (medido)

- **320 px sem rolagem lateral** nas 6 telas, e também a 768 e 1366 px (RNF02).
- **Contraste:** o axe (WCAG 2.1 A/AA) não acusa violação em nenhuma das 18 páginas, a 1366 e a 320 px, nos dois temas. A exceção são os rótulos do gráfico de Dados, que o axe não consegue medir (ajuste 12).
- **Foco visível:** `:focus-visible` com contorno de 3 px (`styles/base.css:38-39`). Nos municípios do mapa, o foco é um traço tracejado diferente da seleção (`styles/mapa.css:45-50`). Em Contatos, o cartão inteiro de emergência acende (`styles/contatos.css:82-86`).
- **prefers-reduced-motion:** com `reduce`, nada se move em nenhuma tela (`styles/base.css:119-126`), e as rolagens suaves consultam a preferência (`Contatos.tsx`, `Cartilha.tsx`, `AreasRisco.tsx`). A única exceção é o mapa (ajuste 6).
- **RN03:** classe sempre com cor, forma e nome; hachura a partir da classe 4. A única falha é que as classes 1 e 2 compartilham o ícone (ajuste 8).

## Ajustes

Tipo: **acessibilidade** é prioritário; **estético** é polimento. Esforço: P (até meia hora) ou M (uma tarde).

| # | Tela | Problema | Skill que apontou | Correção proposta | Esforço | Tipo | Status |
|---|---|---|---|---|---|---|---|
| 1 | Todas | Rótulos de 10 px: o `.lbl` em caixa alta (`styles/base.css:82-86`), o "DESLIZAMENTOS" da marca (`styles/estrutura.css:88-92`), as tags como "diário · 06:50" e "sem chuva agora", e os rótulos do mapa e da simulação. São 6 a 21 blocos por tela, abaixo do mínimo de 11 px | taste (`tiny-text`) e ui-ux (Typography · Contrast Readability) | Subir esses rótulos para 11–12 px, mantendo a fonte, a caixa alta e o espaçamento. Um token só (`.lbl`) resolve a maior parte | P | acessibilidade | aplicado: 11 px como piso em todos os pontos, inclusive a barra inferior do celular |
| 2 | Monitoramento (320 px) | O resumo flutuante ganhou a linha "Atualizado em … (horário de Brasília)" (RN11, Tarefa 4 desta branch). A 320 px ele vira 4 linhas, quebra a data ("em / 29/10/2026") e cobre parte do mapa | ui-ux (Content · Compact Label Overflow) e capturas | Abaixo de 400 px, versão curta "Atualizado 29/10 06:50", com `white-space: nowrap` na data. O texto completo fica para o leitor de tela. **É uma regressão desta branch: vale corrigir antes do push** | P | acessibilidade | aplicado: abaixo de 400 px aparece "Atualizado 29/10 06:50"; a frase completa fica para o leitor de tela |
| 3 | Monitoramento e Áreas (320 px) | O seletor de camadas corta o rótulo: aparece "Neutrc" | ui-ux (Compact Label Overflow) e capturas | `min-width` no `select` de camadas para caber "Satélite"/"Relevo" sem corte, ou encolher só o `padding` | P | acessibilidade | aplicado: abaixo de 380 px, seta em CSS e a fonte de texto do site (Archivo) no lugar da mono, porque o campo precisa manter 16 px (zoom do iOS, `styles/base.css:43-50`) e a mono não cabe ao lado das Previsões |
| 4 | Dados e Simulação (320 px) | Os seletores segmentados quebram em 2 + 1: "Personalizado" e "Próximas 72h" ficam sozinhos numa segunda linha, com uma célula vazia ao lado | ui-ux (Compact Label Overflow) e capturas | Abaixo de 400 px, grade de colunas iguais (`grid-template-columns: repeat(3, 1fr)`) com rótulo curto ("24 h", "48 h", "72 h"; "Período") | P | estético | pendente (polimento) |
| 5 | Cabeçalho (768 e 320 px) e mapa | "dia-alvo 29/10/2026" fica a 12 px da borda direita, e a atribuição do OpenStreetMap a 5 px | taste (`edge-text`) | `padding-right` de 16 px no cabeçalho em telas estreitas; dar margem igual à atribuição do Leaflet | P | estético | pendente (polimento) |
| 6 | Monitoramento e Áreas | O `fitBounds` do Leaflet faz pan e zoom animados mesmo com `prefers-reduced-motion`: a regra CSS global não alcança a animação feita em JavaScript (`MapaLeaflet.tsx:336,343,350`) | design-motion-principles (acessibilidade, lente Emil) | Passar `animate: !semMovimento()` nas três chamadas, com o mesmo `matchMedia` que as outras telas já usam | P | acessibilidade | aplicado: `animate: !semMovimento()` no `fitBounds` e no zoom (`lib/movimento.ts`) |
| 7 | Monitoramento e Simulação | A troca de dia recolore o mapa com `transition: fill 0.6s` (`styles/mapa.css:32`). É uma interação frequente (setas, ▶ a cada 1,1 s), e 600 ms passam do limite de 500 ms da RNF03 para a troca de dia | design-motion-principles (Emil: frequência e duração) | `fill 160ms ease-out`, ou sem transição | P | estético | aplicado: `fill 0.16s ease-out` |
| 8 | Todas (selos de classe) | RN03: as classes 1 (extremamente baixo) e 2 (muito baixo) usam o mesmo ícone, `circulo-check` (`lib/classes.ts:46-47`); só o nome as diferencia | ui-ux (Accessibility · Color Only) | Um ícone próprio para a classe 2 no mesmo traço (por exemplo, um círculo com um traço), sem mudar cor nem tamanho | P | acessibilidade | aplicado: classe 2 com círculo e traço (`circulo-menos`) |
| 9 | Dados (e números da Simulação e das Áreas) | Só 0 a 20% dos números usam algarismos tabulares: índices, variações e mm não se alinham dígito a dígito na tabela | taste (`tabular`) | `font-variant-numeric: tabular-nums` em `.tab .n`, nos KPIs e no pluviômetro | P | estético | pendente (polimento) |
| 10 | Dados | Os botões do nome do município na tabela têm 20 px de altura (`.tab .linha`, `styles/dados.css:561-567`), abaixo dos 24 px do WCAG 2.2 (2.5.8). A linha inteira responde ao clique, mas no toque e no teclado o alvo é o botão | ui-ux (Accessibility · Target Size) e medição | `padding-block` de 2–4 px no botão (24 px ou mais), sem mudar a altura visual da linha | P | acessibilidade | aplicado: `min-height: 24px` |
| 11 | Simulação | O controle "Chuva em mm" (`input[type=range]`, `styles/simulacao.css:60`) tem 16 px de altura: difícil de pegar com o dedo | ui-ux (Touch · Touch Target Size) e medição | Altura de 24–32 px no `input` (a trilha pode continuar fina) e polegar de 20 px | P | acessibilidade | aplicado: 28 px de altura no `input` |
| 12 | Dados | Os rótulos do gráfico de evolução ("↑ muito baixo", valores, "ALERTA 1,00") ficam sobre as faixas de classe. O axe deixou 116 casos "a conferir à mão", porque não mede texto sobre SVG | ui-ux (Accessibility · Color Contrast) e axe | Conferir à mão nos dois temas e, onde faltar contraste, dar contorno de fundo ao texto (`paint-order: stroke` com a cor do painel) | P | acessibilidade | pendente (acessibilidade, conferência manual) |
| 13 | Simulação e Dados | Animações em propriedades de layout: o marcador da escala da simulação usa `left 0.6s` (`styles/simulacao.css:213`) e as barras do pluviômetro usam `height 0.6s` (`styles/dados.css:436`) | design-motion-principles (Emil e performance) | Trocar por `transform` (`translateX` / `scaleY` com `transform-origin: bottom`) e 200 ms com ease-out | P | estético | pendente (polimento) |
| 14 | Cartilha e Contatos (1366 px) | Cartões esticados até a altura do vizinho ficam com uma faixa vazia: 82 px em "Deixe a mochila pronta", 79 px em "Jogar lixo no barranco" e "Cortar o barranco", e 95 px em "Presidente Getúlio" | taste (`panel-void`) | `align-items: start` na grade, ou ancorar as ações no pé do cartão (`margin-top: auto`, como `.cc .acts` já faz) para o espaço ficar entre texto e botões | P | estético | pendente (polimento) |
| 15 | Monitoramento (320 px) | O balão do município selecionado fica escondido atrás do botão de cadeado da legenda (aparece só "…rimi"), e o cartão de Previsões cobre o terço de cima do mapa | Capturas (taste, leitura das telas) | A 320 px, começar com as Previsões recolhidas (só a linha do dia, que abre ao tocar) e afastar o cadeado da área do balão | M | estético | pendente (polimento) |

Em 30/10/2026 entraram na branch os ajustes 1, 2, 3, 6, 7, 8, 10 e 11, um commit cada. Continuam pendentes o 12 (acessibilidade, conferência manual de contraste no gráfico) e os de polimento 4, 5, 9, 13, 14 e 15.

## Achados descartados (e por quê)

Estes apontamentos do inspetor da taste-skill vêm das regras da casa dela. Segui-los mudaria a identidade do VIGIA, o que está fora do escopo:

- **Rótulos em caixa alta com espaçamento e a IBM Plex Mono** (`micro-label`, monoespaçada): fazem parte da tipografia do projeto. Só o tamanho entra (ajuste 1).
- **Ícones em quadrados coloridos** (`icon-chips`): são os selos de classe da RN03, codificação de status, não decoração.
- **Sombra pesada** (`heavy-shadow`): são painéis que flutuam de fato sobre o mapa (Previsões, resumo).
- **Muita cor na tela** (`colour-sprawl`, 19%) e **gráfico com 6 cores** (`rainbow-chart`): o mapa colorido e a escala de classes do GeoRisk são o dado.
- **Bordas escuras na Cartilha** (`heavy-borders`, 1,96:1): bordas decorativas, sem informação.
- **Título coberto ao rolar** (`covered-text`, Cartilha e Contatos a 320 px): é o cabeçalho e as abas fixas passando por cima do título durante a rolagem, comportamento esperado.

Nada aqui copia identidade de órgão oficial: as propostas não tocam em cor, brasão nem logotipo (RN04).

---

## Apêndice: auditoria de movimento (modo terminal)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 AUDIT SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔴 0 Critical  |  🟡 2 Important  |  🟢 4 Opportunities
Primary lens: Emil Kowalski (painel de risco, uso recorrente, contenção)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Reconhecimento.** Astro + React, CSS puro, sem biblioteca de animação. Há 13 transições e 1 `@keyframes` (`piscar`), todas curtas, e uma regra global de `prefers-reduced-motion`. Os componentes que aparecem e somem (diálogos, avisos, painéis) trocam sem animação. Na lente de Emil, para um painel consultado várias vezes por dia isso é o certo, não uma lacuna. Peso: **Emil** principal, **Jakub** secundário, **Jhey** seletivo (nenhum ponto pede encanto: é tela de risco).

**Avaliação geral.** O movimento está contido e quase sempre a serviço da leitura: nada entra animado, nada pulsa à toa, e com reduced-motion tudo para. Os pontos fracos são dois: a troca de dia, que é a interação mais frequente, demora 600 ms para recolorir; e o pan do mapa ignora a preferência de movimento.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ EMIL KOWALSKI — Contenção e velocidade      (Primary)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

What's Working Well
- ✓ Nenhuma animação de entrada em telas nem em seções. Os dados aparecem prontos.
- ✓ A largura do menu lateral usa 180 ms (`styles/estrutura.css:270`), e as dicas do menu usam 120 ms (`:340`, `:385`): rápido e discreto.
- ✓ O ponto do gráfico cresce em 150 ms no foco (`styles/dados.css:239`): retorno imediato.
- ✓ A reprodução das previsões só começa a pedido, tem pausa e é anunciada ao leitor de tela (`components/Previsoes.tsx:40-48`).

Issues to Address
- ✗ 🟡 A troca de dia recolore o mapa em 600 ms — `styles/mapa.css:32`
  Interação frequente e também por teclado, que deveria ser quase instantânea. Passa da RNF03 (500 ms). → 160 ms ease-out, ou nenhuma transição.
- ✗ 🟢 Marcador da simulação em `left 0.6s` e barras do pluviômetro em `height 0.6s` — `styles/simulacao.css:213`, `styles/dados.css:436`
  Lentos para um resultado que o usuário pediu, e em propriedades de layout. → `transform`, 200 ms.

Through Emil's lens: o projeto já faz a pergunta certa ("isso precisa animar?") quase sempre. Falta encurtar a única animação de alta frequência.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ JAKUB KREHEL — Acabamento de produção      (Secondary)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

What's Working Well
- ✓ O aviso flutuante ("toast") some com opacidade e um deslocamento curto (`styles/monitoramento.css:116-124`), sem exagero.
- ✓ Os cartões da Cartilha usam opacidade e transform em 250 ms (`styles/cartilha.css:176`).

Issues to Address
- ✗ 🟢 `transition: 0.2s` e `transition: 0.12s` sem nomear as propriedades — `styles/monitoramento.css:123`, `styles/estrutura.css:385`
  Animam qualquer propriedade que mude no futuro. → Listar `opacity, transform`.
- ✗ 🟢 Curva `ease` padrão em transições de entrada. → `ease-out` nas que mostram algo, como o aviso e as dicas.

Through Jakub's lens: o acabamento é consistente. Os ajustes são de higiene, não de estilo.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎨 JHEY TOMPKINS — Experimentação           (Selective)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

What's Working Well
- ✓ O "piscar" do município achado pela busca (`styles/mapa.css:53-60`, 2 × 1,2 s) é o único movimento expressivo, e tem função: mostrar onde está o município.

Opportunities
- 🟢 Nenhuma nova. Numa tela de risco, encanto extra iria contra a RN04 (não parecer alerta). Se algum dia houver estado vazio ("nenhum município em alerta"), cabe ali.

Through Jhey's lens: a contenção aqui é a decisão certa.

**Acessibilidade (obrigatória).**
- ✓ Regra global `prefers-reduced-motion: reduce` zera animações, transições e rolagem suave (`styles/base.css:119-126`). Medido: nada se move nas 6 telas com `reduce`.
- ✗ 🟡 O pan e o zoom do Leaflet no `fitBounds` são animação em JavaScript e escapam da regra CSS (`components/MapaLeaflet.tsx:336,343,350`). → `animate: !semMovimento()` (ajuste 6).
- ✓ O "piscar" fica abaixo de 3 flashes por segundo e para depois de 2 ciclos.
