# Bloqueantes da entrega — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** fechar os bloqueantes de código da auditoria numa branch local: tirar a tela Monitoramento SC, trocar o limiar para 100 mm com a troca visível na tela Dados, remover o `/simular`, voltar com o horário da atualização no Monitoramento, verificar a acessibilidade com axe-core no CI e corrigir o README.

**Architecture:** seis tarefas independentes, cada uma num commit, todas na branch `fix/bloqueantes-entrega` criada a partir da `main` atualizada. A única mudança de contrato de dados é um campo opcional novo no `historico.json` (`limiar_anterior`), gravado pelo backend e lido pela tela Dados.

**Tech Stack:** Python 3.12+ (pytest), Astro 7 + React 19 (vitest, TypeScript), Cloudflare Worker (vitest), GitHub Actions, Playwright + `@axe-core/playwright`.

**Spec:** `docs/auditoria/CHECKLIST.md` (auditoria de 29/10/2026) e as decisões do usuário nesta conversa (limiar de 100 mm, a tela SC sai, contatos/RN09 fora do escopo).

## Global Constraints

- Ambiente Windows + PowerShell; usar `py` no lugar de `python`.
- Branch local `fix/bloqueantes-entrega`, criada da `main` depois de `git pull`. **Proibido:** `git push`, abrir PR, mexer na `main` ou na `estado`, fechar o PR #20.
- Um commit por tarefa. Mensagens em português, **sem nenhuma atribuição ao Claude**. O primeiro commit da branch traz só a auditoria e este plano (`docs: auditoria e plano dos bloqueantes`).
- Nada que publique em produção: sem `wrangler deploy`, sem `workflow_dispatch`, sem mexer em variáveis ou secrets do GitHub. Nenhum workflow publica o Worker (`.github/workflows/` não chama `wrangler`); o deploy fica no roteiro, para o usuário.
- O campo `limiar_anterior` é documentado em `docs/contratos-de-dados.md` e, se o `docs/indices.schema.json` cobrir o `historico.json`, também no schema.
- Não mexer em `frontend/public/data/contatos.json` nem na verificação de contatos (RN09 fica com o usuário).
- Não trocar layout, paleta, tipografia nem arquitetura de componentes: só blocos pequenos reaproveitando as classes que já existem.
- Todo texto novo do site entra em PT e tem tradução em `es.json` e `en.json` (o teste `i18n/index.test.ts` cobra).
- Limiar: **100 mm** nos 27 municípios; fonte: "VIGIA, limiar provisório de 100 mm definido pela equipe com base nos critérios de deslizamento da Defesa Civil de Blumenau (alerta a partir de 100 mm em 24 h)" (texto do commit `e9ff5ad`).
- Comando final de verificação, todo verde: `py -m pytest -W error` (backend), `npm test`, `npm run typecheck` e `npm run build` (frontend e Worker), `npm run test:a11y` (frontend).

## Fase 2 — impacto de remover a tela Monitoramento SC

**Risco geral: baixo.** A tela não mostra dado próprio (em produção só aparece o fallback com o link), nada no backend nem no bot depende dela, e os links antigos continuam funcionando com redirect. O que pode quebrar é previsível e coberto por teste ou pelo build: a lista de telas (`telas.test.ts`), as chaves de tradução (`i18n/index.test.ts`) e o menu, que passa de 7 para 6 itens (inclusive a barra inferior do celular; o CSS não fixa o número de colunas: não há `repeat(7` nem `nth-child(7` em `styles/`).

### O que depende da tela

| Onde | O que é | Ação |
|---|---|---|
| `frontend/src/pages/[...lang]/monitoramento-sc.astro` | gera `/monitoramento-sc`, `/es/…` e `/en/…` | apagar |
| `frontend/src/components/MonitoramentoSC.tsx` | a tela (iframe + fallback + "Abrir mapa oficial") | apagar |
| `frontend/src/styles/sc.css` | estilos usados só por ela (`.sc`, `.frame`, `.fallback`) | apagar (nenhum outro arquivo usa essas classes) |
| `frontend/src/lib/telas.ts:15` | item do menu | tirar |
| `frontend/src/lib/telas.test.ts:28-38` | espera 7 telas | 6 telas |
| `frontend/src/components/Menu.tsx:10,23` | ícone `RadioTower` da tela | tirar |
| `frontend/src/lib/config.ts:19-20`, `config.test.ts:2,28-36`, `src/env.d.ts:8-9` | `iframeSC` / `PUBLIC_SC_IFRAME` | tirar |
| `frontend/src/i18n/es.json`, `en.json` | "Monitoramento SC", "VIGIA · Monitoramento SC", "Tela Monitoramento SC" e o bloco da tela (frases da `MonitoramentoSC.tsx`, além das sobras do protótipo sobre iframe, `X-Frame-Options`, `frame-ancestors`, "Antes de integrar…", "Pré-visualizar estado", "Iframe carregado", "Bloqueado") | tirar das duas, mantendo as frases que outro arquivo ainda usa (`git grep` de cada uma antes) |
| Testes de acessibilidade/links, sitemap | não existem (sem sitemap; nenhum teste lista rotas além de `telas.test.ts`) | — |
| `docs/diagramas/casos-de-uso.puml/.svg` | não citam a tela nem a Defesa Civil SC | nada a fazer |
| `README.md:244` ("7 telas"), `:249` ("Defesa Civil SC (iframe)"), `:250` (Ecossistema), `:314` (linha da tela), `:335` (RF08), `:365` (RN10) | texto | ver Tarefa 1 |
| `docs/pendencias.md:15,47,56` | pendências do iframe, da altura do iframe e da conferência de chuva pela Defesa Civil | marcar como resolvidas/fora do escopo |

### Destino do "Abrir mapa oficial"

**Tela Contatos**, logo depois dos números de emergência: é a tela dos canais oficiais, e quem procura a Defesa Civil procura ali. Um bloco curto com `id="painel-sc"`, sem iframe:

- Título: "Painel oficial da Defesa Civil de SC"
- Frase: "Estações, chuva acumulada e níveis de rios em tempo real, publicados pela Secretaria de Estado da Proteção e Defesa Civil de Santa Catarina. É um site do governo estadual, sem vínculo com o VIGIA."
- Link (botão `btn`, `target="_blank" rel="noopener"`): "Abrir o painel oficial", com `aria-label` "Abrir o painel oficial da Defesa Civil de SC (abre em nova aba)", para `https://monitoramento.defesacivil.sc.gov.br/mapa`.

O bloco só mexe no componente `Contatos.tsx` e no CSS dele; o `contatos.json` e a regra de contatos verificados ficam intactos.

### Links antigos

O GitHub Pages não faz redirect, mas o Astro já resolve isso no projeto: o `astro.config.mjs:9-13` gera, para `/estacoes`, uma página estática com `<meta http-equiv="refresh">`, `<link rel="canonical">`, `noindex` e um link para o destino (conferido em `dist/es/estacoes/index.html`). Proposta: o mesmo para `/monitoramento-sc`, `/es/monitoramento-sc` e `/en/monitoramento-sc`, cada um para a tela Contatos **no mesmo idioma**, com a âncora `#painel-sc`. O texto do link dessa página é o padrão do Astro, em inglês ("Redirecting from … to …"), mas ela fica na tela por um instante. Vale manter: o endereço já circulou (README, menu publicado desde outubro) e o custo é de 3 linhas de config. Se o Astro recusar o destino com `#`, o redirect vai para `/contatos/` sem âncora.

## Review Focus

- **Link antigo salvo** (`/en/monitoramento-sc/`): deve cair em `/en/contatos/#painel-sc`, no inglês, e não no português nem num 404. Coberto pela verificação do `dist/` na Tarefa 1.
- **`historico.json` de produção sem `limiar_anterior`** (o arquivo que está no ar hoje e qualquer execução antes do merge): a tela Dados funciona igual, sem nota e sem marca. Coberto em `historico.test.ts` (Tarefa 2).
- **`limiar_anterior` malformado** (data inválida, limiar ≤ 0 ou não numérico): o arquivo inteiro falha, como o contrato já define para o `historico.json`, em vez de desenhar a marca errada. Coberto em `historico.test.ts` (Tarefa 2).
- **Período que não chega à troca** (7 dias escolhidos um mês depois da troca): a nota some, porque ela só fala dos dias que estão no gráfico. Coberto por `trocaVisivel` (Tarefa 2).
- **Worker antigo lendo o `bot.json` novo sem `simulacao`**: o Worker publicado hoje trata `bot.simulacao !== null` como ligado; com o campo ausente, um `/simular` quebraria o webhook. Por isso a ordem de implantação é: apagar a variável `VIGIA_SIMULACAO` (o usuário já vai fazer), fazer o deploy do Worker novo e só depois mesclar o backend. A Tarefa 3 registra essa ordem no `backend/README.md`, e o teste do Worker confere que `/simular` cai em `opcao_desconhecida` (Tarefa 3).

---

### Task 0: Preparar a branch

- [ ] **Step 1:** `git switch main; git pull; git switch -c fix/bloqueantes-entrega`. Esperado: `Switched to a new branch 'fix/bloqueantes-entrega'`.
- [ ] **Step 2:** `git add docs/auditoria/CHECKLIST.md docs/superpowers/plans/2026-10-29-bloqueantes-entrega.md; git commit -m "docs: auditoria e plano dos bloqueantes"`.

### Task 1: Tirar a tela Monitoramento SC

**Files:**
- Delete: `frontend/src/pages/[...lang]/monitoramento-sc.astro`, `frontend/src/components/MonitoramentoSC.tsx`, `frontend/src/styles/sc.css`
- Modify: `frontend/src/lib/telas.ts:15`, `frontend/src/lib/telas.test.ts:27-38`, `frontend/src/components/Menu.tsx:10,23`, `frontend/src/lib/config.ts:19-20`, `frontend/src/lib/config.test.ts:2,28-36`, `frontend/src/env.d.ts:8-9`, `frontend/astro.config.mjs:9-13`, `frontend/src/components/Contatos.tsx:87-89`, `frontend/src/styles/contatos.css`, `frontend/src/i18n/es.json`, `frontend/src/i18n/en.json`, `README.md:244,249,250,314,335,365`, `docs/pendencias.md:15,47,56`

**Interfaces:**
- Produces: `TELAS` com 6 rotas, na ordem `["", "simulacao", "dados", "areas-de-risco", "cartilha", "contatos"]`; âncora `#painel-sc` na tela Contatos.

- [ ] **Step 1: teste que falha.** Em `telas.test.ts`, o teste vira `"6 telas na ordem do menu, Contatos por último"` e espera `["", "simulacao", "dados", "areas-de-risco", "cartilha", "contatos"]`. Apagar o `describe("iframeSC")` de `config.test.ts` e o import.
- [ ] **Step 2:** `npm test -- telas` em `frontend/`. Esperado: FAIL (ainda são 7).
- [ ] **Step 3: remover.** Apagar os 3 arquivos; tirar o item de `TELAS`, o `RadioTower` e a chave `"monitoramento-sc"` de `Menu.tsx`, o `iframeSC` de `config.ts` e o `PUBLIC_SC_IFRAME` de `env.d.ts`.
- [ ] **Step 4: redirects.** Em `astro.config.mjs`, acrescentar ao objeto `redirects`: `"/monitoramento-sc": "/vigia-deslizamentos/contatos/#painel-sc"`, e o mesmo com `/es/` e `/en/`. Ajustar o comentário da linha 8 para valer para as duas telas antigas.
- [ ] **Step 5: bloco em Contatos.** Entre o `</ul>` dos números de emergência e o `<BannerTelegram>`, uma `<section id="painel-sc" className="painel-sc" aria-labelledby="painel-sc-t">` com `<h2 id="painel-sc-t">`, a frase e o link descritos na Fase 2 (ícone `ExternalLink`, que já é importado). CSS em `contatos.css` reaproveitando os tokens dos cartões `.cc` (`--surface-000`, `--line`, `--radius-lg`); nenhuma cor nova.
- [ ] **Step 6: traduções.** Tirar as chaves da tela de `es.json` e `en.json` (antes de tirar cada uma, `git grep -F` da frase em `frontend/src` sem os JSON: se aparecer, fica). Acrescentar as 4 frases novas nos dois arquivos (ES: "Panel oficial de la Defensa Civil de SC", …; EN: "Official Santa Catarina Civil Defense dashboard", …).
- [ ] **Step 7: README e pendências.** README: "6 telas" na tabela RADIAN; tirar "Defesa Civil SC (iframe)" da linha de Infraestrutura; no Ecossistema, "Defesa Civil SC (link para o painel oficial)"; tirar a linha da tela na tabela Telas; RF08 vira "Indicar, na tela Contatos, o painel oficial da Defesa Civil de SC, como link externo"; RN10 vira "O VIGIA não incorpora sites oficiais: o painel da Defesa Civil de SC aparece só como link, com o crédito da fonte". Em `pendencias.md`, riscar os itens das linhas 15 e 47 (fora do escopo: a tela saiu em 29/10/2026) e anotar na linha 56 que a conferência pela Defesa Civil ficou fora do escopo.
- [ ] **Step 8: verificar.** `npm test`, `npm run typecheck` e `npm run build` em `frontend/`. Esperado: tudo verde; o build lista 18 páginas de tela e os redirects; `Select-String 'refresh' dist/en/monitoramento-sc/index.html` mostra `url=/vigia-deslizamentos/en/contatos/#painel-sc` (ou sem âncora, se o Astro recusar). `git grep -n -i "monitoramento-sc\|MonitoramentoSC\|iframeSC\|PUBLIC_SC_IFRAME" -- frontend/src` devolve vazio.
- [ ] **Step 9: commit.** `git add -A frontend README.md docs/pendencias.md` e `git commit -m "Remove a tela Monitoramento SC e leva o painel oficial para Contatos"`.

### Task 2: Limiar de 100 mm, com a troca visível na tela Dados

**Files:**
- Base: `git cherry-pick -n e9ff5ad` (config, `gerar_municipios.py`, testes, `historico_reconstruido.json`, README, contrato, pendências)
- Modify: `backend/app/modelos/banco.py` (função nova), `backend/app/modelos/tipos.py` ou `banco.py` (tipo novo), `backend/app/exportacao/exportar.py:139-158`, `backend/app/pipeline.py:170-190`, `frontend/src/lib/historico.ts`, `frontend/src/components/Dados.tsx:251-259`, `frontend/src/components/Graficos.tsx:47-55,91-92,173-180`, a CSS do gráfico (onde está `.inicio`/`.inicio-l`), `frontend/src/fixtures/indices.exemplo.json`, `frontend/src/i18n/es.json`, `en.json`, `docs/contratos-de-dados.md:66-89`, `docs/pendencias.md:26`, `README.md:157-165`
- Create: `frontend/src/fixtures/historico.exemplo.json`
- Test: `backend/tests/test_banco.py`, `backend/tests/test_exportar.py`, `backend/tests/test_pipeline.py`, `frontend/src/lib/historico.test.ts`, `frontend/src/fixtures/fixtures.test.ts`

**Interfaces:**
- Produces (backend): `@dataclass(frozen=True) class LimiarAnterior: limiar_mm: float; ate: date`; `banco.limiar_anterior(conexao, ibge: str, dia_alvo_d0: date, limiar_mm: float) -> LimiarAnterior | None`; `exportar.montar_historico(historicos, fonte, anteriores: dict[str, LimiarAnterior] | None = None) -> dict`.
- Produces (contrato): item de `historico.json` com o campo opcional `"limiar_anterior": {"limiar_mm": 150, "ate": "AAAA-MM-DD"}`, em que `ate` é o último dia-alvo cujo cálculo publicado usou o limiar anterior. Ausente quando não houve troca.
- Produces (frontend): em `lib/historico.ts`, `interface TrocaLimiar { ate: string; dia: string; anterior_mm: number; atual_mm: number }` (`dia` = `ate` + 1, o primeiro dia no limiar novo); `trocaDeLimiar(arq: ArquivoHistorico | undefined, ibge: string, atual_mm: number): TrocaLimiar | null`; `trocaVisivel(troca: TrocaLimiar | null, eixo: string[]): boolean` (verdadeiro quando o eixo tem dia ≤ `troca.ate`). `Evolucao` ganha a prop `troca: TrocaLimiar | null`.

- [ ] **Step 1: base do PR #20.** `git cherry-pick -n e9ff5ad`. Esperado: aplica sem conflito. No `pendencias.md`, trocar "em 22/10/2026" pela data em que a troca chega à produção, escrita como "na data do merge (ver `limiar_anterior` no `historico.json`)", porque a data real só existe quando o pipeline roda com 100 mm, e a tela tira a data do próprio dado.
- [ ] **Step 2: regerar a reconstrução.** Em `backend/`: `py -m scripts.gerar_historico_reconstruido --fim 2026-10-14`. Esperado: grava `historico_reconstruido.json` com `limiar_mm: 100` nos 27. Comparar com o arquivo do cherry-pick (`git diff --stat`); fica o recém-gerado.
- [ ] **Step 3: testes do backend que falham.**
  - `test_banco.py::test_limiar_anterior_devolve_o_ultimo_dia_calculado_com_outro_limiar`: grava os dias-alvo 2026-10-20 e 2026-10-21 com 150 e o 2026-10-22 com 100; com `dia_alvo_d0=2026-10-23` e `limiar_mm=100`, espera `LimiarAnterior(limiar_mm=150.0, ate=date(2026, 10, 21))`.
  - `test_banco.py::test_limiar_anterior_usa_o_ultimo_calculo_de_cada_dia`: o dia 2026-10-21 com um cálculo de 150 às 06:00 e um de 100 às 12:00 → `ate=date(2026, 10, 20)`.
  - `test_banco.py::test_limiar_anterior_sem_troca_e_none` e `…_ignora_dias_a_partir_do_d0` (um cálculo de 150 só no próprio D0 ou depois → `None`).
  - `test_exportar.py::test_montar_historico_inclui_limiar_anterior`: com `anteriores={"4206900": LimiarAnterior(150.0, date(2026, 10, 21))}`, o item de 4206900 tem `"limiar_anterior": {"limiar_mm": 150.0, "ate": "2026-10-21"}` e os outros municípios não têm a chave.
  - `test_pipeline.py`: no teste que já confere o `historico.json` publicado, com um cálculo antigo de 150 no banco e o config em 100, o JSON publicado traz `limiar_anterior`.
- [ ] **Step 4:** `py -m pytest tests/test_banco.py tests/test_exportar.py tests/test_pipeline.py -W error`. Esperado: FAIL (`limiar_anterior` não existe).
- [ ] **Step 5: implementar.** `banco.limiar_anterior` usa a mesma janela `ROW_NUMBER() … ORDER BY calculado_em DESC` de `historico()`, restrita a `dia_alvo < dia_alvo_d0` e `limiar_mm != ?`, e pega o maior `dia_alvo` (com o limiar dessa linha). O `montar_historico` acrescenta a chave só para quem está em `anteriores`. O `_publicar_historico` do pipeline monta `anteriores` com uma chamada por município da configuração, usando `municipio.limiar_mm`.
- [ ] **Step 6:** `py -m pytest -W error` em `backend/`. Esperado: PASS (toda a suíte, inclusive o `test_arquivo_versionado` com o reconstruído em 100).
- [ ] **Step 7: testes do frontend que falham** (`historico.test.ts`):
  - `lerHistorico` aceita um município com `limiar_anterior: { limiar_mm: 150, ate: "2026-10-21" }` e continua aceitando sem ele.
  - `lerHistorico` recusa `limiar_anterior` com `ate: "21/10/2026"`, com `limiar_mm: 0` e com `limiar_mm: "150"` → `{ ok: false, erro: expect.stringContaining("limiar_anterior") }`.
  - `trocaDeLimiar(arq, "4206900", 100)` → `{ ate: "2026-10-21", dia: "2026-10-22", anterior_mm: 150, atual_mm: 100 }`; sem o campo ou sem o arquivo → `null`.
  - `trocaVisivel(troca, ["2026-10-20", "2026-10-21", "2026-10-22"])` → `true`; `trocaVisivel(troca, ["2026-10-22", "2026-10-23"])` → `false`; `trocaVisivel(null, …)` → `false`.
  - Em `fixtures.test.ts`, o `historico.exemplo.json` passa no `lerHistorico`.
- [ ] **Step 8:** `npm test -- historico fixtures` em `frontend/`. Esperado: FAIL.
- [ ] **Step 9: implementar o leitor e as funções** em `lib/historico.ts` (a interface `ArquivoHistorico` ganha `limiar_anterior?: { limiar_mm: number; ate: string }` por município; a validação usa `dataValida` e `Number.isFinite(x) && x > 0`).
- [ ] **Step 10: marca e nota na tela Dados.**
  - `Dados.tsx` calcula `troca = trocaDeLimiar(real.dados, destaque.ibge, destaque.limiar_mm)` e passa para `<Evolucao troca={troca} …>`.
  - Quando `trocaVisivel(troca, eixo)`, aparece abaixo do gráfico um `<p className="sub">` com: "Até {N}, o VIGIA calculou com limiar de {N} mm. Os índices desses dias aparecem convertidos para o limiar atual de {N} mm, e não como foram publicados na época." (`N`: `formatarData(troca.ate)`, `formatarNumero(anterior_mm, 0)`, `formatarNumero(atual_mm, 0)`).
  - No `Evolucao`, se `troca.dia` estiver no eixo, desenhar uma linha vertical na borda esquerda desse dia (mesmo cálculo de `xInicio`), com a classe `troca` e o rótulo `troca-l` "limiar {N} → {N} mm" em `topo + 24`, para não encostar em "início do sistema". O CSS repete o traço tracejado de `.inicio`, sem cor nova.
  - As duas frases novas vão para `es.json` e `en.json`.
- [ ] **Step 11: dados de exemplo do `npm run dev`.**
  - `indices.exemplo.json`: `limiar_mm: 100` e a fonte nova nos 6 municípios; `efr_mm`, `rtotal_mm` e `chuva_acum_mm` multiplicados por 2/3 (1 casa decimal), mantendo `indice`, `classe` e `prob` como estão. Assim o cenário de demonstração continua o mesmo, e os testes que leem índices da fixture (`dados.test.ts:27`, `mapa.test.ts:112`) não mudam.
  - Criar `historico.exemplo.json` (`schema_version` 1, os 6 municípios, `inicio` "2026-09-01", índices até 2026-09-28) com `limiar_anterior: { limiar_mm: 150, ate: "2026-09-24" }`, para a marca aparecer em 25/09 na visão de 7 dias do exemplo (D0 2026-09-29).
  - Conferir o `docs/pendencias.md:37` (a fixture agora usa 100 mm).
- [ ] **Step 12: docs.**
  - `contratos-de-dados.md`: o campo `limiar_anterior` na tabela do `historico.json`, com a regra "último dia-alvo cujo cálculo publicado usou outro limiar; ausente sem troca; inválido → falha do arquivo inteiro".
  - README "Limitações conhecidas": "Os índices calculados de 15/10/2026 até a troca usaram 150 mm e aparecem convertidos para 100 mm na tela Dados, com nota e marca no gráfico."
  - Conferir que o README `:86` e `:153` vieram do cherry-pick em 100 mm e sem os "230 mm".
- [ ] **Step 13: verificar.** `py -m pytest -W error` (backend); `npm test`, `npm run typecheck` e `npm run build` (frontend). Esperado: verde. `git grep -n "limiar_mm\": 150" backend/config frontend/src/fixtures frontend/public/data` devolve vazio.
- [ ] **Step 14: commit** como autor Kaique, com o crédito do commit original: `git commit -m "Limiar provisório de 100 mm nos 27 municípios, com a troca marcada na tela Dados" -m "Baseado no commit e9ff5ad (PR #20)." -m "Co-authored-by: Guilherme <guilherme.rode@hotmail.com>"`.

### Task 3: Remover o `/simular`

**Files** (lista de `docs/pendencias.md:52`):
- Delete: `backend/app/bot/simulacao.py`, `backend/tests/test_simulacao.py`
- Modify: `backend/app/bot/bot.py:41,146-170,212-216`, `backend/app/config.py:40-42,89,224`, `backend/app/pipeline.py:206`, `backend/app/exportacao/bot_json.py:6,34-36,49,61-63,102,147`, `backend/tests/test_bot_json.py`, `backend/tests/test_config.py`, `backend/tests/test_bot.py` (se testar o registro do comando), `backend/.env.exemplo:31-34`, `backend/README.md:87,123`, `.github/workflows/pipeline.yml:64`, `docs/contratos-de-dados.md:208`, `docs/pendencias.md:52`, `bot-worker/src/comandos.ts:15-43,103-105`, `bot-worker/src/tipos.ts:41-…`, `bot-worker/test/telegram.test.ts:94,213-233`, `bot-worker/test/apoio.ts`, `bot-worker/test/bot-json.test.ts`, `bot-worker/test/fixtures/bot.exemplo.json` (regerada)

**Interfaces:**
- Produces: `montar_bot_json(...)` sem o parâmetro `simulacao` e sem a chave `"simulacao"` no resultado; `BotJson` do Worker sem o campo `simulacao`; `faixas_das_classes` fica (as mensagens reais usam).

- [ ] **Step 1: testes primeiro.**
  - `test_bot_json.py`: um teste de que `"simulacao" not in montar_bot_json(...)`; tirar os testes de simulação e o `simulacao=True` de `test_fixture_do_worker_igual_ao_montar_bot_json`.
  - `test_config.py`: tirar os testes de `VIGIA_SIMULACAO`.
  - `telegram.test.ts`: os testes de `/simular` dão lugar a um teste único, "`/simular` cai em `opcao_desconhecida`".
  - Rodar `py -m pytest tests/test_bot_json.py -W error`. Esperado: FAIL.
- [ ] **Step 2: remover o código** no backend e no Worker conforme a lista de arquivos. `interpretarComando` continua genérico (o teste `"/Simular  Foo  bar"` da linha 94 testa o parser: troca para outro comando, ex. `"/Status  Foo  bar"`).
- [ ] **Step 3: regerar a fixture do Worker.** Em `backend/`: `$env:VIGIA_REGERAR_FIXTURES=1; py -m pytest tests/test_bot_json.py; Remove-Item Env:VIGIA_REGERAR_FIXTURES`. Esperado: `bot-worker/test/fixtures/bot.exemplo.json` sem `simulacao`.
- [ ] **Step 4: docs e workflow.** Tirar a linha `VIGIA_SIMULACAO` do `pipeline.yml`, do `.env.exemplo` e das duas tabelas do `backend/README.md`; tirar a linha `simulacao` do contrato; riscar o item 🔴 do `pendencias.md`. No `backend/README.md`, seção "Worker do bot", registrar a ordem de implantação: "Antes de mesclar uma mudança no formato do `bot.json`, faça o deploy do Worker. Ex.: a remoção do `/simular` (29/10/2026) exige o Worker novo antes do backend novo."
- [ ] **Step 5: verificar.** `py -m pytest -W error` (backend); `npm test` e `npm run typecheck` (bot-worker). Esperado: verde. `git grep -n -i "simular\|VIGIA_SIMULACAO\|simulacao" -- backend bot-worker .github` só pode mostrar a frase de ordem de implantação no README.
- [ ] **Step 6: commit.** `git commit -m "Remove o comando /simular de demonstração do bot e do Worker"`.

### Task 4: Horário da última atualização no Monitoramento (RN11)

**Files:**
- Modify: `frontend/src/lib/monitoramento.ts`, `frontend/src/lib/monitoramento.test.ts`, `frontend/src/components/Monitoramento.tsx:95-98`, a CSS do resumo flutuante (`.float.resumo`, em `styles/mapa.css` ou `monitoramento.css`), `frontend/src/i18n/es.json`, `en.json`, `frontend/src/components/Cabecalho.tsx:26`, `frontend/src/lib/dados.ts:76`

**Interfaces:**
- Produces: `textoAtualizacao(t: T, gerado_em: string): string` em `lib/monitoramento.ts`.

- [ ] **Step 1: teste que falha.** `monitoramento.test.ts`: `textoAtualizacao(tradutor("pt"), "2026-10-29T09:50:18Z")` → `"Atualizado em 29/10/2026 06:50 (horário de Brasília)"`; com `tradutor("en")` → `"Updated 29/10/2026 06:50 (Brasília time)"`.
- [ ] **Step 2:** `npm test -- monitoramento`. Esperado: FAIL.
- [ ] **Step 3: implementar.** A função usa `t("Atualizado em {N} (horário de Brasília)", { N: formatarDataHora(gerado_em) })`. No `Monitoramento.tsx`, dentro do `<p className="float resumo">`, uma segunda linha `<span className="atualizado">{textoAtualizacao(t, indices.gerado_em)}</span>`; a CSS a põe em `display: block`, num corpo menor, com `color: var(--ink-2)`. Traduções: ES "Actualizado el {N} (hora de Brasilia)", EN "Updated {N} (Brasília time)". Corrigir de passagem os comentários que citam uma "RN12" que não existe (`Cabecalho.tsx:26`, `lib/dados.ts:76`): o aviso de 12 h é RNF04.
- [ ] **Step 4: verificar.** `npm test`, `npm run typecheck` e `npm run build`. Esperado: verde.
- [ ] **Step 5: commit.** `git commit -m "Monitoramento volta a mostrar o horário da última atualização (RN11)"`.

### Task 5: axe-core no CI (RNF01)

**Files:**
- Create: `frontend/scripts/axe.mjs`
- Modify: `frontend/package.json` (devDependencies `playwright` e `@axe-core/playwright`; script `"test:a11y": "node scripts/axe.mjs"`), `frontend/package-lock.json`, `.github/workflows/ci.yml` (job `a11y`), `README.md:382`, `docs/pendencias.md:22,71`

**Interfaces:**
- Produces: `npm run test:a11y` (pede um `npm run build` antes): sai com 0 sem violações e com 1 listando página, tema, regra, impacto e alvo de cada violação.

- [ ] **Step 1: instalar.** `npm install -D playwright @axe-core/playwright` e `npx playwright install chromium` (local; baixa o Chromium para o perfil do usuário, fora do repositório).
- [ ] **Step 2: script.** `scripts/axe.mjs`:
  - sobe `astro preview` na porta 4321 e espera a resposta em `/vigia-deslizamentos/`;
  - lista as páginas pelos `dist/**/index.html`, pulando os redirects (arquivos com `http-equiv="refresh"`);
  - para cada página, em `colorScheme` `light` e `dark`, abre, espera `networkidle` e roda `new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()`;
  - imprime as violações e encerra o preview no fim, mesmo com erro.
- [ ] **Step 3: rodar.** `npm run build; npm run test:a11y`. Anotar o resultado.
- [ ] **Step 4: decidir pelo tamanho.** Se as violações forem poucas e baratas (até ~5 correções pontuais: `aria-label`, `alt`, um token de contraste já existente, sem mexer em layout nem paleta), corrigir nesta tarefa e rodar de novo até zerar. **Se for mais que isso**, não adicionar o job: reverter `package.json`/lock e o script, mudar só o README `:382` para "verificação com axe-core prevista; ver `docs/auditoria/DESIGN-REVIEW.md`", levar as violações para o relatório da Fase 3 e avisar o usuário.
- [ ] **Step 5: workflow** (só no caminho verde). Job `a11y` em `ci.yml`, igual ao job `frontend` (runner `ubuntu-24.04`, `checkout` e `setup-node` fixados pelo mesmo SHA, Node 22, `npm ci --ignore-scripts`), mais `npx playwright install --with-deps chromium`, `npm run build` e `npm run test:a11y`. README `:382` vira "verificação com axe-core em todo PR (job `a11y` do CI)"; `pendencias.md:22,71` riscados.
- [ ] **Step 6: verificar.** `npm test`, `npm run build` e `npm run test:a11y`. Esperado: 0 violações.
- [ ] **Step 7: commit.** `git commit -m "CI verifica acessibilidade com axe-core em todas as telas (RNF01)"`, ou `"README: axe-core ainda não roda no CI"` no caminho alternativo.

### Task 6: Correções do README

**Files:**
- Modify: `README.md:250,311,362,386-412`, `frontend/src/i18n/es.json` e `en.json` (chave órfã `"{M} · Epagri/Ciram"`)

- [ ] **Step 1: RN07** (`:362`): "A simulação usa a mesma equação do subíndice, trocando a chuva prevista pela informada: (EfR × 0,5^((h − 24) ÷ MV) + chuva) ÷ limiar, em que h é o período escolhido (24, 48 ou 72 h) e o EfR do D0 decai pela meia-vida até o fim do período. Ela não altera dados reais e não dispara alertas." (fórmula de `lib/simulacao.ts:33-34`).
- [ ] **Step 2: Monitoramento** (`:311`): "resumo \"N de 27 em alerta\"".
- [ ] **Step 3: Epagri/Ciram.** Confirmar que nada o usa: `git grep -n -i "epagri\|ciram" -- backend frontend/src bot-worker ':!*.json'` vazio. Tirar do Ecossistema (`:250`) e tirar a chave órfã `"{M} · Epagri/Ciram"` dos dois JSON.
- [ ] **Step 4: Estrutura do repositório** (`:386-412`): a árvore real até o segundo nível, com uma linha de comentário por pasta: `.github/workflows/` (ci, pages, pipeline); `backend/` (`app/` com os 6 módulos e `main.py`/`pipeline.py`/`config.py`, `config/`, `scripts/`, `deploy/`, `tests/`); `bot-worker/` (`src/`, `test/`, `migrations/`); `frontend/` (`src/components`, `lib`, `pages/[...lang]`, `layouts`, `i18n`, `styles`, `conteudo`, `data`, `fixtures`; `public/data/` com os arquivos publicados; `scripts/`); `docs/` (`contratos-de-dados.md`, `indices.schema.json`, `pendencias.md`, `decisoes/`, `diagramas/`, `auditoria/`, `superpowers/`). Tirar "Estrutura sujeita a ajustes".
- [ ] **Step 5: verificar.** `npm test` (o teste de i18n confirma que nenhuma frase usada perdeu tradução). Esperado: verde.
- [ ] **Step 6: commit.** `git commit -m "README: RN07 com a fórmula real, 27 municípios, fontes e estrutura do repositório"`.

### Task 7: Verificação final

- [ ] **Step 1:** em `backend/`, `py -m pytest -W error` → todos passam.
- [ ] **Step 2:** em `frontend/`, `npm ci --ignore-scripts`, `npm test`, `npm run typecheck`, `npm run build` e `npm run test:a11y` (se a Tarefa 5 seguiu pelo caminho verde) → verdes.
- [ ] **Step 3:** em `bot-worker/`, `npm test` e `npm run typecheck` → verdes.
- [ ] **Step 4:** `git log --oneline main..HEAD` → 7 commits (docs + 6 tarefas); `git status` limpo.
