# Auditoria README × código

Levantamento de 29/10/2026 sobre a `main` em `f98621c`. Tudo foi conferido no código, nos dados publicados, na branch `estado` e no GitHub (variáveis, secrets e execuções), sem depender do que o README afirma.

Legenda: ✅ feito e verificado · 🟡 parcial · ❌ não feito · ⚠️ README desatualizado ou contraditório

## Resultado das verificações executadas

| Verificação | Comando | Resultado |
|---|---|---|
| Testes do backend | `py -m pytest -W error` em `backend/` (Python 3.14 local; o CI usa 3.12) | ✅ 516 passaram, 2 de rede ficaram de fora (`-m 'not rede'`) |
| Testes do frontend | `npm ci --ignore-scripts` + `npm test` em `frontend/` | ✅ 214 passaram (22 arquivos) |
| Tipos do frontend | `npm run typecheck` | ✅ sem erros |
| Build do frontend | `npm run build` | ✅ 21 páginas (7 telas × 3 idiomas), mais os 3 redirects de `/estacoes` |
| Testes do Worker | `npm test` + `npm run typecheck` em `bot-worker/` | ✅ 66 passaram, tipos ok. Aviso: `@cloudflare/vitest-pool-workers` foi renomeado para `@cloudflare/vitest-plugin` |
| PR #20 mesclado com a `main` | `git merge-tree` + pytest sobre o resultado, numa cópia fora do repositório | ✅ sem conflito, 516 passaram |
| `npm audit` (frontend) | `npm audit --omit=dev` | 🟡 3 altas (`vite`, `undici`, `zod`) e moderadas (`vitest`, `fast-uri`). São ferramentas de build: nada disso vai para o navegador, mas vale um `npm audit fix` |
| Segredos | regex de token do Telegram (`\d{8,10}:AA…`) e do GitHub (`gh[pousr]_…`, `github_pat_…`) na árvore, no `dist/`, em todo o histórico (`git log --all -p`) e no `vigia.db` da `estado` | ✅ nada encontrado; só valores falsos de teste |
| HTTPS do Pages | `gh api repos/…/pages` | ✅ `https_enforced: true` |
| Execuções do pipeline | `gh run list --workflow pipeline.yml -L 40` | 🟡 todas verdes, mas com 2 a 5 h de atraso e, desde 26/10, só 3 execuções por dia |

## 1. Tabela por item

### Requisitos funcionais

| ID | Descrição | Status | Evidência | O que falta |
|---|---|---|---|---|
| RF01 | Mapa dos 27 municípios com classe, nome, índice e total em alerta | ✅ | `frontend/src/components/Monitoramento.tsx:97` ("de N municípios em alerta"), `MapaLeaflet.tsx:4,135` (tooltip com nome e índice) | — |
| RF02 | Seleção por clique, toque, teclado ou busca; painel com índice, classe, alerta, EfR e limiar | ✅ | `Monitoramento.tsx:16,40` (busca), `:182` (em alerta + classe), `:197-201` (EfR, limiar, razão) | — |
| RF03 | Previsão dos próximos 3 dias | ✅ | `Previsoes.tsx:19,81` | — |
| RF04 | Compartilhar, abrir a simulação e assinar o Telegram pelo painel | ✅ | `Monitoramento.tsx:66-69,149-153` (compartilhar), `:155` (simulação), `:162-164` (Telegram) | — |
| RF05 | Simulação por município ou região, 24/48/72 h | ✅ | `Simulacao.tsx:33`, `lib/simulacao.ts:39-47` (`regional`) | — |
| RF06 | Evolução do índice, chuva acumulada 24–96 h × limiar e tabela com tendência | ✅ | `Dados.tsx:231-272` (evolução e pluviômetro), `:308-395` (tabela) | — |
| RF07 | Probabilidades, fontes e dados brutos com data da coleta; CPRM se viável | 🟡 | Probabilidades e dados brutos em `Dados.tsx:401-409` (EfR, chuva prevista, limiar, fonte do limiar, membros, horário da execução em Brasília). Nenhuma referência a CPRM/GeoSGB/suscetibilidade no frontend | Listar as fontes de cada análise (Open-Meteo e os modelos GFS, ECMWF IFS e ICON). Só existe o horário da execução (`gerado_em`), não o da coleta. Camada CPRM ❌: decidir se sai do escopo, já que a setorização do SGB em Áreas de risco ocupa esse lugar |
| RF08 | Incorporar o mapa da Defesa Civil de SC, ou só o link | ⚠️ | `lib/config.ts:20` (`PUBLIC_SC_IFRAME`, não definido em produção), `MonitoramentoSC.tsx:16,58-59` (fallback "O mapa não pôde ser carregado aqui") | A tela sai (Fase 2): RF08 precisa ser reescrito ou removido |
| RF09 | Estações do INMET como camada opcional em Áreas de risco | ✅ | `AreasRisco.tsx:6-7,69,131`, `public/data/estacoes.json` | — |
| RF10 | Cartilha e contatos | ✅ / 🟡 | `pages/[...lang]/cartilha.astro`, `contatos.astro`, `conteudo/cartilha.ts:74-77` | Contatos dependem da RN09 |
| RF11 | Levar ao bot; `/start`, `/status`, `/parar` | ✅ | `lib/config.ts:17` (`t.me/…?start=<ibge>`), `bot-worker/src/comandos.ts:89-102` | — |
| RF12 | Aviso quando o índice chega a ≥ 1,00 | ✅ | `backend/app/bot/regra_aviso.py:62-72`, `app/bot/avisos.py` | — |
| RF13 | PT/ES/EN, tema claro/escuro (padrão do sistema), paleta para daltonismo, lembrar a escolha | ✅ | `i18n/index.ts:47-50` (3 rotas), `lib/preferencias.ts:6-19`, `layouts/Base.astro:45` (`localStorage`) | O valor de "Fonte do limiar" vem do `municipios.json` em português e não é traduzido (`Dados.tsx:407`) |

### Requisitos não funcionais

| ID | Descrição | Status | Evidência | O que falta |
|---|---|---|---|---|
| RNF01 | WCAG 2.1 AA, teclado e leitor de tela | ❌ (verificação) | Nenhum workflow roda axe-core (`.github/workflows/ci.yml`, `pages.yml`). O código tem cuidados de acessibilidade (`aria-live` em `Dados.tsx:200`, tabela rolável focável em `:317`, `anunciar.ts`) | Pôr axe-core no CI sobre o `dist/` e corrigir o que ele apontar. Hoje não dá para afirmar AA |
| RNF02 | 320 px até desktop sem rolagem lateral | 🟡 | Não medido nesta fase (fica para a Fase 3). A tabela de Dados rola dentro do próprio contêiner (`Dados.tsx:316-317`) | Conferir no navegador a 320 px |
| RNF03 | Página principal em até 2,5 s no 4G; simulação e troca de dia em até 500 ms | 🟡 | Não medido. Maiores JS do build: `Mapa` 254 KB, `client` 204 KB, `jsx-runtime` 72 KB (sem gzip) | Medir com Lighthouse em perfil 4G |
| RNF04 | Se a atualização falhar, exibir o último índice com data e hora | ✅ | `backend/app/pipeline.py:238-242` (nada é publicado sem município calculado), `frontend/src/lib/dados.ts:10,76` + `Cabecalho.tsx:108-113` (aviso depois de 12 h) | — |
| RNF05 | LGPD: só chat e municípios, apagados com `/parar` ou bloqueio | ✅ | `bot-worker/migrations/0001_inscritos.sql`, `comandos.ts:99-101`, `app/bot/avisos.py:97-102` (`Forbidden` apaga o chat), `bot-worker/src/index.ts:25` | — |
| RNF06 | Só HTTPS; nenhum token no frontend | ✅ | Varredura sem achados (ver acima); Pages com `https_enforced: true`; o frontend só lê `PUBLIC_*` (`src/env.d.ts:5-9`) | — |
| RNF07 | Parâmetros por município em configuração | ✅ | `backend/config/municipios.json`, `app/config.py` | — |

### Regras de negócio

| ID | Descrição | Status | Evidência | O que falta |
|---|---|---|---|---|
| RN01 | Classes com corte único em 1,80 | ✅ | `backend/app/classificacao/classes.py:99-106`, `frontend/src/lib/classes.ts:45-53` | — |
| RN02 | Em alerta com índice ≥ 1,00 | ✅ | `classes.py:110,137-141`, `lib/classes.ts:66-67` | — |
| RN03 | Risco nunca só por cor: ícone e nome | 🟡 | `SeloClasse.tsx:4-40` (cor e forma, nome ao lado), hachura a partir da classe 4 (`lib/classes.ts:49-52`) | As classes 1 e 2 usam o mesmo ícone, `circulo-check` (`lib/classes.ts:46-47`): só o nome as diferencia |
| RN04 | Texto condicional e aviso de que não é alerta oficial | ✅ | `Monitoramento.tsx:168`, `Simulacao.tsx:209`, `Dados.tsx:293`, `AreasRisco.tsx:411`, `lib/simulacao.ts:100-123`, `backend/app/bot/mensagens.py:43,48` | — |
| RN05 | Vírgula decimal | ✅ | `frontend/src/lib/formato.ts:1-39` | — |
| RN06 | D1–D3 marcados como estimados | ✅ | `Previsoes.tsx:81` ("valores estimados"); o bot só avisa pelo D0 (`regra_aviso.py:8-9`) | — |
| RN07 | Simulação = (EfR + chuva) ÷ limiar, sem alterar dados nem disparar alertas | ✅ ⚠️ | `lib/simulacao.ts:30-35`: `(EfR_D0 × 0,5^((h−24)/MV) + chuva) ÷ limiar`; texto em `Simulacao.tsx:207` | No código já não há fórmula ilustrativa. O README ainda diz que o protótipo usa uma e não menciona o decaimento do EfR para 48 e 72 h |
| RN08 | Aviso não se repete na mesma classe | ✅ | `regra_aviso.py:62-72` (só avisa se a classe sobe; descer não avisa) | — |
| RN09 | Só contatos verificados com a prefeitura | 🟡 | `public/data/contatos.json`: 6 entradas, **2 verificadas** (Ibirama e Presidente Getúlio); 21 municípios sem entrada. O site filtra os verificados (`lib/contatos.ts:1,38`) | Levantar e confirmar os outros 25 municípios |
| RN10 | Mapa de SC só com autorização | ⚠️ | Sem autorização; iframe desligado (`lib/config.ts:20`) | Sai com a tela (Fase 2) |
| RN11 | Dia-alvo e horário da última atualização sempre visíveis | 🟡 | O dia-alvo fica no cabeçalho (`Cabecalho.tsx:92-98`). O horário saiu do cabeçalho em 22/10 (commit `057b80b`) e hoje aparece só em Dados (`Dados.tsx:235,409`), na Simulação (`Simulacao.tsx:85`) e no aviso de dados desatualizados | No Monitoramento o horário não aparece. Ou ele volta, ou a RN11 é reescrita |

### Casos de uso

| ID | Status | Evidência | Observação |
|---|---|---|---|
| UC01 | ✅ | RF01/RF02; exceção (dados desatualizados) em `Cabecalho.tsx:108-113` | — |
| UC02 | ✅ | `Previsoes.tsx` | — |
| UC03 | ✅ | Faixa de 0 a 400 mm em `lib/simulacao.ts:11,28` | — |
| UC04 | ✅ | `lib/config.ts:17`: o link `t.me` abre a página do bot no navegador quando o Telegram não está instalado | — |
| UC05 | ✅ | `regra_aviso.py`, `avisos.py` | Hoje `notificacoes` está vazia na `estado`: nenhum município entrou em alerta desde 15/10 |
| UC06 | ✅ | `pipeline.py:238-242`; erros viram avisos no resumo do run (`pipeline.yml:96-113`) | O run continua verde de propósito |

### Telas

| Tela | Rota | Status | Observação |
|---|---|---|---|
| Monitoramento | `/` | ✅ ⚠️ | O README diz "N de 6 em alerta"; o site mostra "de N municípios em alerta" |
| Simulação | `/simulacao` | ✅ | — |
| Dados da análise | `/dados` | ✅ | Ver RF07 e a nota sobre a troca de limiar (seção 2) |
| Monitoramento SC | `/monitoramento-sc` | ⚠️ | Em produção só aparece o fallback; sai na Fase 2 |
| Áreas de risco | `/areas-de-risco` | ✅ | `/estacoes` redireciona para cá (`astro.config.mjs:9-13`) |
| Cartilha | `/cartilha` | ✅ | — |
| Contatos | `/contatos` | 🟡 | RN09: 2 de 27 verificados |

### Roteiro de desenvolvimento

| Passo | Status | Evidência |
|---|---|---|
| 1. Requisitos e regras | ✅ | README, seção "Especificação do sistema" |
| 2. Parâmetros por município | 🟡 | `municipios.json` com IBGE, pontos e MV; limiar ainda provisório (150 mm na `main`, alvo 100 mm) |
| 3. Fontes de precipitação | ✅ / 🟡 | Open-Meteo (`app/coleta/open_meteo.py`). A comparação com o INMET (`app/coleta/inmet.py`) não roda em produção: o secret `INMET_TOKEN` não existe (`gh secret list`) |
| 4. Cálculo GeoRisk | ✅ | `app/calculo/`, `app/classificacao/` |
| 5. Banco e JSON | ✅ | `app/modelos/banco.py`, `app/exportacao/` |
| 6. Mapa e painéis | ✅ | `frontend/src/components/` |
| 7. Bot do Telegram | ✅ | `bot-worker/`, `app/bot/` |
| 8. Conferir os cálculos contra o GeoRisk | ❌ | Nenhum teste, script ou documento compara resultados com o GeoRisk |
| 9. Publicação | ✅ | Pages no ar (`https://vigia-defesa-civil.github.io/vigia-deslizamentos/`), pipeline agendado e verde |

### Metodologia GeoRisk

| Item | Status | Evidência | Observação |
|---|---|---|---|
| EfR em 168 h, MV = 24 h | ✅ | `app/calculo/chuva_efetiva.py:10,38`; janela em `agregacao.py:35,126-134`; `mv_h: 24` nos 27 municípios | t = 0 é o rótulo da meia-noite UTC do dia-alvo (`docs/decisoes/ensemble.md` §2) |
| SubIR = (EfR + Rtotal) ÷ limiar | ✅ | `app/calculo/indice.py:55-65`; Rtotal com os 24 rótulos certos em `agregacao.py:137-144,176-185` | — |
| Índice ponderado (*time-lagged ensemble*) | ✅ | `agregacao.py:85-119`: recência linear até 36 h, × 1,0 nas rodadas 00/12 UTC e × 0,8 nas 06/18 UTC | Só dois atrasos são alcançáveis (0 h e 24 h, pela Previous Runs API) com 3 modelos: no máximo 6 membros, mínimo 3 (`agregacao.py:47`) |
| Classes com corte único em 1,80 | ✅ | `classes.py:99-106` | — |
| Probabilidades complementares | ✅ | `probabilidades.py:179-181,211-235` (fração do peso estritamente acima de 1,0, 1,8 e 2,6) | — |
| Maior subíndice por município | ✅ | `agregacao.py:235-267` (por membro, o maior entre os pontos) | Hoje cada município tem 1 ponto, então a regra não faz diferença na prática |
| UTC ↔ Brasília | ✅ / 🟡 | O cálculo é em UTC (`agregacao.py:418-434`) e a exibição em `America/Sao_Paulo` (`formato.ts:28-39`) | O D0 é a data UTC: das 21 h à meia-noite de Brasília, o "dia-alvo" já mostra o dia seguinte. A limitação está declarada no README:164 |

### 27 municípios

| Item | Status | Evidência |
|---|---|---|
| `municipios.json` | ✅ / ❌ | 27 itens, códigos IBGE iguais à tabela do README, `mv_h` 24, 1 ponto cada, microrregião 42011 (20) e 42014 (7). **Limiar: 150 mm nos 27; o alvo é 100 mm** |
| GeoJSON do frontend | ✅ | `src/data/municipios.geojson`: 47 polígonos, 27 com `monitorado: true` (iguais ao config) e 20 vizinhos de contexto |
| Teclado do bot por região | ✅ | `bot.json` da `estado`: grupos "Região de Rio do Sul" (20) e "Região de Ituporanga" (7) |
| Textos que ainda falam em 6 | ⚠️ | `README.md:311` ("N de 6 em alerta"); `README.md:272` (nota sobre quem assinou "Todos" com 6, ainda válida); `docs/pendencias.md:33` ("os outros quatro municípios"); comentários em `backend/tests/test_inmet.py:142,172` e `test_open_meteo.py:666`; `docs/decisoes/ensemble.md:372,400,429,460,474` (registro histórico, já com nota de atualização) |

### Pipeline

| Item | Status | Evidência | Observação |
|---|---|---|---|
| Cron às 3, 9, 15 e 21 UTC | ✅ / 🟡 | `.github/workflows/pipeline.yml:6` (`7 3,9,15,21 * * *`) | O GitHub atrasa de 2 a 5 h (runs perto de 08h, 14h, 19h e 00h UTC) e, desde 26/10, só faz 3 execuções por dia. Com o limite de 12 h, o aviso de "dados desatualizados" pode aparecer |
| Branch `estado` | ✅ | `pipeline.yml:37-53,78-94`; contém só `vigia.db` e `bot.json` | — |
| Commit automático do `indices.json` | ✅ | `app/exportacao/publicar.py:45-62` (pula quando o sha é igual); vai para a `main` com o `TOKEN_DADOS` | O PAT é pessoal: os commits aparecem como "Kaique de Oliveira". Vence antes de 03/01/2027 (`docs/pendencias.md:11`) |
| Falha (RNF04 e exceção do UC06) | ✅ | `pipeline.py:238-242`; `pipeline.yml:96-113` | — |

### Bot

| Item | Status | Evidência | Observação |
|---|---|---|---|
| Worker com `/start`, `/status`, `/parar` e D1 | ✅ | `bot-worker/src/comandos.ts:89-102`, `inscritos.ts`, `migrations/0001_inscritos.sql` | — |
| Inscrito apagado ao bloquear o bot | ✅ | `app/bot/avisos.py:97-102` → `bot-worker/src/index.ts:25` | — |
| Avisos enviados pelo pipeline | ✅ | `app/bot/avisos.py`, `pipeline.py` | — |
| RN08 sem repetição | ✅ | `regra_aviso.py:62-72` | — |
| **`/simular` removido** | ❌ | **Existe e está ligado em produção.** A variável do repositório `VIGIA_SIMULACAO=1` está definida desde 15/10 (`gh variable list`), e o `bot.json` da `estado` (gerado em 29/10 09:50 UTC) traz `simulacao` preenchida. Código: `backend/app/bot/simulacao.py`, `app/bot/bot.py:41,146-170,212-216`, `app/config.py:40-42,89,224`, `app/pipeline.py:206`, `app/exportacao/bot_json.py:34-36,49,61-63,102,147`, `.env.exemplo:31-34`, `pipeline.yml:64`, `bot-worker/src/comandos.ts:17-43,103-104`, `bot-worker/src/tipos.ts:41`, testes `tests/test_simulacao.py`, `tests/test_bot_json.py`, `bot-worker/test/*.test.ts`, fixture `bot.exemplo.json`; docs em `backend/README.md:87,123` e `docs/contratos-de-dados.md:208` | Lista completa de remoção em `docs/pendencias.md:52`. Mesmo antes do código sair, dá para apagar a variável `VIGIA_SIMULACAO` no GitHub: na execução seguinte o `bot.json` volta com `simulacao: null` e o Worker deixa de responder ao `/simular` |

### Itens específicos

| Item | Status | Evidência / observação |
|---|---|---|
| RF07: camada CPRM | ❌ | Nada no frontend nem nos scripts. O README a trata como dado estático "será baixado" (README:196) e como funcionalidade prevista (README:211) |
| RF07: fontes e dados brutos com data/hora | 🟡 | Os dados brutos existem (`Dados.tsx:404-409`); falta a lista de fontes e modelos, e só há o horário da execução |
| RN09: contatos verificados | 🟡 | 2 de 27 |
| i18n PT/ES/EN | ✅ / 🟡 | Varri todas as chamadas `t("…")` de `src/` (inclusive `lib/` e ternários): 301 frases, **nenhuma faltando** em `es.json` ou `en.json` (o único achado, `'acc'` em `Legenda.tsx:60`, é falso positivo). Polimento: cerca de 106 chaves sem uso, que sobraram do protótipo (ex.: "Cálculo ilustrativo…", "{M} · Cemaden", "{M} · Epagri/Ciram", "VIGIA — Monitoramento SC"); o valor `fonte_limiar` não é traduzido; as mensagens do bot existem só em PT (o README não promete outra coisa) |
| RNF01: axe-core no workflow | ❌ | Não roda em nenhum workflow |
| RNF06: segredos | ✅ | Ver "Resultado das verificações executadas" |
| Testes e build | ✅ | Ver "Resultado das verificações executadas" |

### Fontes de dados: o que o código consome × o que o README diz

| Fonte | No código | README | Situação |
|---|---|---|---|
| Open-Meteo previsão (`/v1/forecast`, `past_days=7`, best match) | ✅ antecedente de 168 h (`app/coleta/open_meteo.py`) | "chuva observada" (README:187) | ⚠️ É o blend de modelo e análise da Open-Meteo, não medição de pluviômetro |
| Open-Meteo Previous Runs (`gfs_global`, `ecmwf_ifs025`, `icon_global`) | ✅ membros do ensemble | "Modelos… (a definir na integração)" (README:151) | ⚠️ Os modelos já estão definidos |
| Open-Meteo arquivo ERA5 | ✅ só por script (`scripts/gerar_historico_reconstruido.py`) | ✅ README:188 | — |
| INMET | ✅ `estacoes.json` por script; comparação de chuva só com `INMET_TOKEN` | "comparação e validação" (README:189) | ⚠️ Sem o secret, a comparação não roda em produção |
| IBGE | Códigos via API de Localidades; malha via `tbrugz/geodata-br` fixada num commit (`scripts/gerar_municipios.py`, `frontend/scripts/gerar-geojson.mjs:6-8`) | "IBGE — Localidades e Malhas" (README:190) | ⚠️ A malha é um derivado do IBGE, não a API de Malhas |
| Atlas Digital (S2iD) e SGB | ✅ por script, versionados | ✅ README:197-198 | — |
| CPRM/GeoSGB (suscetibilidade) | ❌ | "será baixado uma vez" (README:196) | ⚠️ Não foi feito |
| **Epagri/Ciram** | ❌ nada consome | Aparece no Ecossistema da RADIAN (README:250) | ⚠️ Contradição: tirar do README, ou integrar |
| CEMADEN | ❌ só citado no aviso "não substitui o Cemaden" | "não será integrada" (README:202) | ✅ coerente (é só referência metodológica) |
| ANA | ❌ | "não será integrada" (README:202) | ✅ coerente |
| Defesa Civil SC | só o link/iframe da tela Monitoramento SC | "Defesa Civil SC (iframe)" (README:249-250) | Sai na Fase 2 |

## 2. Troca do limiar para 100 mm

Decisão da equipe: **100 mm nos 27 municípios**. Na `main`, tudo ainda está em 150 mm.

### O que ainda depende de 150 mm

| Onde | Linha(s) | O PR #20 cobre? | Ação |
|---|---|---|---|
| `backend/config/municipios.json` | `limiar_mm` e `fonte_limiar` nos 27 itens (`:5-6` … `:239-240`) | ✅ | Trocar para 100 e para a nova fonte (critério da Defesa Civil de Blumenau) |
| `backend/scripts/gerar_municipios.py` | `:38-42` (`FONTE_LIMIAR_PROVISORIA`, `LIMIAR_PROVISORIO_MM = 150`) | ✅ | — |
| `backend/tests/test_gerar_municipios.py` | `:93,153` | ✅ (passa a usar a constante) | — |
| `backend/tests/test_main.py` | `:279-290` (150 mm e 180 mm de chuva) | ✅ (100 mm e 120 mm) | — |
| `frontend/public/data/historico_reconstruido.json` | `limiar_mm: 150` nos 27; o `test_arquivo_versionado` (`backend/tests/test_gerar_historico_reconstruido.py:145-154`) exige que bata com o config | ✅ (regerado com o script, 27 × 100) | Se o plano for refeito, regerar de novo com `py -m scripts.gerar_historico_reconstruido --fim 2026-10-14` |
| `README.md` | `:86` (150 mm e a justificativa dos "cerca de 230 mm"), `:153` (tabela de simplificações) | ✅ | — |
| `docs/contratos-de-dados.md` | `:13` | ✅ | — |
| `docs/pendencias.md` | `:26,37,63` | ✅ | O PR data a troca como "22/10/2026": acertar para a data real do merge |
| `frontend/src/fixtures/indices.exemplo.json` | 6 municípios com `limiar_mm: 150` e a fonte antiga | ❌ (fica de propósito) | O `npm run dev` lê esses exemplos (`frontend/.env.development:1`), então a demonstração local continua mostrando "150 mm" e a fonte antiga. Recomendo atualizar |
| `backend/tests/test_config.py:387`, `test_banco.py:283-300`, `test_gerar_historico_reconstruido.py:34-84`, `test_preparar_estado.py:23,52` | 150 como valor de teste | — | Não dependem do config; não precisam mudar |
| `frontend/src/lib/graficos.ts:11` | `PLUV_MIN_MM = 150` | — | É o fundo de escala mínimo do pluviômetro, não o limiar. Com 100 mm a linha tracejada continua dentro da escala |
| Textos do site e do bot | — | — | Nenhum texto fixo com 150: o limiar vem do `indices.json` e do config (`Dados.tsx:406`, `Monitoramento.tsx:200`, `app/bot/mensagens.py`) |
| Branch `estado` (`vigia.db`) | 3.612 cálculos, **todos com `limiar_mm` 150**, de 15/10 a 01/11 (dias-alvo) | — | Ver abaixo |

### PR #20: mesclar ou refazer?

- **Mescla sem conflito.** O `git merge-tree` com a `main` atual não acusa conflito, os 516 testes do backend passam sobre o resultado e o CI do PR está verde (backend, frontend e worker).
- O segundo commit (`c9e85a3`, endereço novo do repositório) já está na `main` com o mesmo conteúdo: não muda nada.
- O que falta no PR: a data real da troca no `pendencias.md`, a fixture do frontend e a nota na tela Dados (abaixo). E ele não remove o `/simular`, que é outro assunto.
- **Recomendação:** fechar o PR #20 e refazer num plano novo, numa branch local criada da `main` de hoje, reaproveitando o commit `e9ff5ad` (cherry-pick). Assim a troca entra junto com a nota na tela Dados, a fixture atualizada e a data certa, numa sequência de commits revisável, como pedem as regras do projeto. Mesclar o PR como está também funciona, mas deixa esses três ajustes para depois. O PR é do Guilherme: combinem antes de fechar.

### Índices já gravados com 150 mm: como deixar claro na tela Dados

O que acontece com o histórico depois da troca: `banco.historico()` converte cada cálculo antigo para o limiar atual (`índice × 150 ÷ 100`, classe recalculada) sem alterar o banco (`docs/contratos-de-dados.md:40,83`). Como o índice é `(EfR + Rtotal) ÷ limiar`, a conversão é exata para o mesmo cálculo. O gráfico, portanto, fica contínuo e coerente, mas mostra valores que o site **não publicou** na época. Efeito nos dados de hoje: o maior índice do `historico.json` passa de 0,64 para 0,96 (nenhum alerta retroativo), e o maior D0 atual passa de 0,12 para 0,17.

Proposta, do mais barato ao mais completo:

1. **Nota de texto** abaixo do gráfico de Evolução, no mesmo padrão da nota dos dias reconstruídos (`Dados.tsx:259`): "Até DD/MM/2026 o VIGIA calculou com limiar de 150 mm. Os índices desses dias aparecem convertidos para o limiar atual de 100 mm (índice × 1,5), e não como foram publicados na época." Nas 3 línguas, usando a data real do merge.
2. **Marca vertical no gráfico** na data da troca, com o rótulo "limiar 150 → 100 mm", reaproveitando a lógica do `inicioReal` (o marco do início dos dados reais).
3. Opcional: uma linha em "Detalhes do cálculo" ("Limiar anterior: 150 mm até DD/MM/2026").

Para a data não ficar escrita à mão em três arquivos, ela pode ir num campo do config (por exemplo `limiar_desde`), exportado no `indices.json`. Isso muda o contrato de dados: decidir no plano.

Atenção também ao bot: com 100 mm os índices ficam 1,5 vez maiores e os avisos ficam mais frequentes (`docs/pendencias.md:26`). Hoje nenhum município passaria de 1,00, então a troca não dispara avisos imediatos.

## 3. Falta fazer

### Bloqueante para a entrega

| # | Item | Esforço |
|---|---|---|
| B1 | **Desligar e remover o `/simular`.** Primeiro passo imediato: apagar a variável `VIGIA_SIMULACAO` no GitHub. Depois, remover o código segundo `docs/pendencias.md:52` (backend, Worker, contrato, testes, fixture, docs, workflow) e fazer o deploy do Worker | M |
| B2 | **Limiar de 100 mm** (seção 2): config, script, testes, `historico_reconstruido.json` regerado, README, contrato, pendências, fixture e nota na tela Dados | M |
| B3 | **Remover a tela Monitoramento SC** (Fase 2), com RF08, RN10 e o README | M |
| B4 | **RNF01:** axe-core no CI (`ci.yml`/`pages.yml`) sobre o `dist/`, e corrigir as violações | M |
| B5 | **RN09:** confirmar os contatos dos 25 municípios que faltam, ou deixar explícito na tela Contatos e no README que só os verificados aparecem (hoje: 2) | G (depende das prefeituras) |

### Importante

| # | Item | Esforço |
|---|---|---|
| I1 | **RN11:** voltar com o horário da última atualização no Monitoramento, ou reescrever a regra (o horário saiu do cabeçalho em `057b80b`) | P |
| I2 | **RF07:** listar as fontes de cada análise (Open-Meteo e os modelos GFS, ECMWF IFS e ICON) em Dados; decidir oficialmente que a camada CPRM fica fora (a setorização do SGB cobre o papel) e registrar | P |
| I3 | **Roteiro, passo 8:** comparação com o GeoRisk em pelo menos alguns municípios e datas, ou declarar no README que não foi feita | M/G |
| I4 | **Pipeline atrasado e com execuções perdidas:** acompanhar; se o aviso de 12 h começar a aparecer, avaliar um disparo externo (`workflow_dispatch` por cron fora do GitHub) ou aumentar o limite | P (decisão) / M |
| I5 | **`INMET_TOKEN`:** pedir o token ou tirar do README a promessa de "comparação e validação" | P |
| I6 | **RNF02 e RNF03:** medir 320 px e o tempo de carga (Fase 3 e Lighthouse) | P |
| I7 | **RN03:** dar ícones diferentes às classes 1 e 2 (Fase 3) | P |
| I8 | **PAT `TOKEN_DADOS`:** renovar antes de 03/01/2027 | P |

### Polimento

| # | Item | Esforço |
|---|---|---|
| L1 | `npm audit fix` no frontend (vite, undici, zod, vitest, fast-uri) e migrar `@cloudflare/vitest-pool-workers` para `@cloudflare/vitest-plugin` | P |
| L2 | Limpar as ~106 chaves sem uso do `es.json` e do `en.json` | P |
| L3 | Traduzir o valor de "Fonte do limiar" (ou guardar uma chave em vez do texto) | P |
| L4 | Comentários do código citam uma "RN12" que não existe no README (`Cabecalho.tsx:26`, `lib/dados.ts:76`) | P |
| L5 | Atualizar os comentários "seis municípios" nos testes e o "outros quatro municípios" em `docs/pendencias.md:33` | P |
| L6 | Apagar as branches remotas já mescladas (17) e decidir o destino de `feat/telegram-formato`, `docs/planos` e `feat/backend-pipeline` | P |

## 4. README precisa corrigir

| Linha | Hoje | Correção |
|---|---|---|
| `:86`, `:153` | Limiar provisório de 150 mm e a justificativa dos "cerca de 230 mm" | 100 mm, com a base nos critérios da Defesa Civil de Blumenau (texto do PR #20) |
| `:151` | Modelos "a definir na integração" | GFS, ECMWF IFS 0,25° e ICON Global via Open-Meteo, com 2 rodadas (0 h e 24 h) |
| `:110` | "Rodadas de até 36 horas" | Acrescentar que, na prática, entram as rodadas de 0 h e de 24 h (`ensemble.md` §4) |
| `:187` | Open-Meteo como "chuva observada" | "Chuva horária estimada (blend de modelo e análise)"; não é medição de pluviômetro |
| `:189` | INMET para "comparação e validação" | Dizer que depende do token, que hoje não está configurado |
| `:190` | "IBGE — Localidades e Malhas" | Malha derivada do IBGE via `tbrugz/geodata-br`, fixada num commit |
| `:196`, `:211`, `:226` | Camada CPRM prevista | Marcar como não implementada, ou substituída pela setorização do SGB |
| `:234` | Citação da RADIAN com "autoria e ano a completar" | Completar (o repositório da UFSC exige VPN, segundo `docs/pendencias.md:36`) |
| `:244` | "7 telas" | 6 telas (depois da Fase 2) |
| `:249` | "Defesa Civil SC (iframe)" | Tirar (Fase 2) |
| `:250` | Ecossistema com Epagri/Ciram e Defesa Civil SC | Tirar o Epagri/Ciram (nada o consome); ajustar a Defesa Civil SC conforme a Fase 2 |
| `:311` | "N de 6 em alerta" | "N de 27 em alerta" (o site diz "de N municípios em alerta") |
| `:314` | Linha da tela Monitoramento SC | Tirar (Fase 2) |
| `:335` (RF08), `:365` (RN10) | Mapa oficial incorporado | Reescrever ou remover (Fase 2) |
| `:362` (RN07) | "(o protótipo ainda usa uma fórmula ilustrativa)" | Tirar e registrar o decaimento do EfR para 48 e 72 h: `(EfR × 0,5^((h−24)/MV) + chuva) ÷ limiar` |
| `:366` (RN11) | Horário sempre visível | Alinhar com o que o site faz (ver I1) |
| `:382` | "Verificação com axe-core antes de cada publicação" | Não é verdade hoje: implementar (B4) ou mudar o texto |
| `:386-412` | Estrutura do repositório | Acrescentar `.github/workflows/`, `backend/scripts/`, `backend/deploy/`, `frontend/src/lib/`, `i18n/`, `styles/`, `conteudo/`, `fixtures/`, `frontend/public/data/`, `pages/[...lang]/` e os arquivos reais de `docs/`; tirar "camadas estáticas" de `src/data/` |
| `:412` | "Estrutura sujeita a ajustes" | Tirar |
| `:416-424` | Roteiro sem status | Marcar o que foi feito; o passo 8 não foi |
| `:430-432` | Licença vazia | Escolher uma licença (ex.: MIT para o código, e uma nota sobre os dados de terceiros) |
| `backend/README.md:29-30` | Lista só 2 dos 7 scripts | Listar todos (`gerar_municipios`, `gerar_ocorrencias`, `gerar_setores_risco`, `gerar_historico_reconstruido`, `rodar_local`) |
| `backend/README.md:87,123`, `docs/contratos-de-dados.md:208` | `VIGIA_SIMULACAO` e `/simular` | Tirar junto com B1 |
