# Página de Ajuda — especificação

**Data:** 29/10/2026 · **Status:** aprovada em 29/10/2026, com o ícone "?" no topo do celular

## Objetivo

Ensinar quem chega ao VIGIA a ler e usar as 6 telas sem depender de ninguém. A página tem um vídeo tutorial curto e dicas por tela. O vídeo é opcional: enquanto não existir, a página funciona só com as dicas.

## Público

Morador, voluntário ou agente de Defesa Civil do Alto Vale, quase sempre no celular. Não conhece a metodologia GeoRisk.

## Lugar no menu

A barra inferior do celular já tem 6 itens e cabe justa em 320 px (medido em PT, ES e EN). Um 7º item quebraria a barra. Por isso:

- **Desktop e tablet (> 900 px):** item "Ajuda" no rail, no grupo de baixo, junto de Acessibilidade, com o ícone `CircleHelp` (lucide).
- **Celular (≤ 900 px):** ícone "?" no topo, ao lado do botão de acessibilidade, com o nome acessível "Ajuda". Mais um link "Como usar o VIGIA" no topo da Cartilha (em todas as larguras).
- **Rota:** `/ajuda`, `/es/ajuda`, `/en/ajuda`, como as outras telas (`frontend/src/pages/[...lang]/ajuda.astro`, entrada nova em `lib/telas.ts` com uma marca para não ir à barra inferior).


## Conteúdo

1. **Título e uma frase:** "Como usar o VIGIA". O VIGIA é um sistema acadêmico de apoio à decisão e não emite alerta oficial (RN04).
2. **Quadro do vídeo tutorial, sempre no topo (revisão de 31/10/2026):**
   - Quadro 16:9 com a capa `frontend/public/ajuda/capa-mapa.jpg`, uma captura do próprio mapa do VIGIA, sem os tiles do mapa base (só os polígonos do projeto, sem crédito de terceiros).
   - **Sem ID ou sem transcrição:** a capa mostra o ▶ e "Vídeo tutorial em produção", sem nada para clicar.
   - **Com ID e transcrição:** a capa vira o botão "Assistir ao tutorial". Nada do YouTube carrega antes do clique. Abaixo do quadro, o link "Legendas e transcrição" leva ao texto.
   - Ao clicar, troca a capa por um `<iframe>` de `https://www.youtube-nocookie.com/embed/<ID>?cc_load_policy=1&hl=<idioma>&cc_lang_pref=<idioma>&rel=0`. Assim, nenhum cookie de terceiro entra antes do consentimento por ação do usuário (RNF05).
   - Legendas em PT, ES e EN no próprio vídeo (`cc_load_policy=1` liga as legendas por padrão).
   - **Transcrição** em texto logo abaixo, num `<details>` aberto por padrão, no idioma da página (WCAG 1.2.1 e 1.2.2).
   - O botão diz que o vídeo abre o YouTube ("abre um vídeo do YouTube, sem cookies até você tocar").
3. **Dicas por tela:** uma seção por tela, na ordem do menu. Cada uma tem 3 a 5 dicas curtas e um link "Abrir a tela".
   - **Monitoramento:** o que é o índice e a classe (com o ícone e o nome da classe, RN03); tocar no município abre o painel; Previsões são estimativas (RN06); busca por nome; legenda e paleta para daltonismo.
   - **Simulação:** escolher município, período e chuva; "regional" aplica a mesma chuva aos 27; a simulação não muda dados reais nem dispara aviso (RN07).
   - **Dados da análise:** períodos de 7 e 30 dias e personalizado; dias reconstruídos antes de 15/10/2026 são estimativa; nota da troca de limiar.
   - **Áreas de risco:** setores do SGB, o que é risco alto e muito alto, e a camada de estações do INMET.
   - **Cartilha:** sinais de perigo e o que fazer; ligue 199.
   - **Contatos:** emergência; Defesa Civil do município; painel oficial de SC.
   - **Telegram:** `/start`, `/status`, `/parar` e o que o bot guarda (RNF05).
4. **Rodapé:** "Ainda com dúvida?", com links para o README do projeto e para os Contatos.

## Configuração do vídeo

- **Onde fica o ID:** a constante `VIDEO_AJUDA_ID` em `frontend/src/lib/config.ts`, vazia (`""`) por padrão. É o trecho depois de `watch?v=` no link do YouTube. A variável `PUBLIC_AJUDA_VIDEO_ID`, se definida no build, vale por cima. Não é segredo (RNF06).
- **Transcrições:** `frontend/src/conteudo/ajuda/transcricao.{pt,es,en}.md`, texto simples, um parágrafo por bloco. O vídeo só fica clicável com o ID **e** a transcrição do idioma (WCAG 1.2.1); sem um dos dois, o quadro mostra "Vídeo tutorial em produção".

## Requisitos

- PT, ES e EN completos; as chaves novas seguem a regra do `i18n/index.test.ts`.
- Acessibilidade:
  - axe sem violações (a rota entra no `scripts/axe.mjs`);
  - o botão da capa é um `<button>` com nome acessível;
  - o `<iframe>` ganha `title` com o nome do vídeo;
  - o foco vai para o `<iframe>` depois do clique.
- 320 px sem rolagem lateral; o vídeo em 16:9 com `aspect-ratio`.
- Sem cookies nem requisição a domínio do Google antes do clique, verificado por um teste Playwright que conta as requisições externas antes do clique.
- Nada de identidade visual de órgão oficial. A página usa os componentes que já existem (cartão `.cc`, `.btn`, `.lbl`).

## Testes previstos

- Unidade (`vitest`):
  - `urlDoVideo(id, lang)` monta a URL de `youtube-nocookie.com` com as legendas no idioma certo;
  - com `videoId` vazio, o componente não renderiza `.video`;
  - com `videoId` preenchido, há um botão e nenhum `<iframe>` antes do clique.
- Playwright (`axe.mjs`): `/ajuda` nas 3 línguas, 0 violações. Nenhuma requisição a `youtube` antes do clique.

## RF novo proposto para o README

> **RF14** — Oferecer uma página de Ajuda com dicas de uso de cada tela e, quando houver, um vídeo tutorial com legendas em PT, ES e EN e transcrição em texto. O vídeo só é carregado (via youtube-nocookie.com) quando o usuário pede.

Mais uma linha na tabela "Telas": `| Ajuda | /ajuda | Vídeo tutorial (opcional, carregado ao clicar), transcrição e dicas por tela |`. E uma linha no RNF05: "Vídeos incorporados só carregam depois de um clique, pelo domínio sem cookies do YouTube."

## Fora do escopo

Gravar o vídeo, hospedar o vídeo fora do YouTube e fazer busca dentro da Ajuda.
