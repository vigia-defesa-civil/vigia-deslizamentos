// Testes de layout e interação que só um navegador de verdade mede (sobreposição, foco, toque).
// Uso: npm run build && node scripts/interacao.mjs (ou SO=simulacao,foco para só alguns casos).
// Sai com 1 se alguma verificação falhar.
import { chromium } from "playwright";
import { BASE, servir, soLocal } from "./servidor.mjs";

const { servidor, origem } = await servir();
const navegador = await chromium.launch();
const falhas = [];
let verificacoes = 0;

/** Abre a página num contexto novo (sem rede externa) e devolve { pagina, fechar }. */
async function abrir(caminho, opcoes = {}) {
  const contexto = await navegador.newContext({ viewport: { width: 1366, height: 900 }, ...opcoes });
  await soLocal(contexto, origem);
  const pagina = await contexto.newPage();
  await pagina.goto(origem + BASE + caminho, { waitUntil: "load" });
  await pagina.waitForSelector(".mapa .mun", { timeout: 30_000 }).catch(() => {});
  await pagina.waitForTimeout(300);
  return { pagina, fechar: () => contexto.close() };
}

function verificar(ok, mensagem) {
  verificacoes++;
  if (!ok) falhas.push(mensagem);
}

// SO=nome1,nome2 roda só esses casos (desenvolvimento); sem SO, todos.
const SO = process.env.SO?.split(",").filter(Boolean) ?? [];
async function caso(nome, corpo) {
  if (SO.length && !SO.includes(nome)) return;
  await corpo();
}

const celular = (width, height, deviceScaleFactor = 1) => ({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor });

// RN06: com um dia de previsão, a faixa "valores estimados" fica inteira à vista, sem o resumo por cima.
await caso("faixa", async () => {
  for (const [nome, opcoes] of [
    ["320", celular(320, 640)],
    ["360", celular(360, 780)],
    ["393", celular(393, 852)],
    ["430", celular(430, 932)],
    ["768", { viewport: { width: 768, height: 1024 } }],
    ["900", { viewport: { width: 900, height: 800 } }],
    ["1366", { viewport: { width: 1366, height: 900 } }],
    ["deitado 800×400", celular(800, 400)],
  ]) {
    const { pagina: p, fechar: fecharP } = await abrir("", opcoes);
    await p.evaluate(() => [...document.querySelectorAll(".prevs input[type=radio]")][1]?.click());
    await p.waitForTimeout(200);
    const r = await p.evaluate(() => {
      const caixa = (s) => document.querySelector(s)?.getBoundingClientRect();
      const f = caixa(".dayflag");
      const outros = [".resumo", ".prevs", ".zoom", ".layers", ".layers-sel", ".busca .go"].map((s) => [s, caixa(s)]).filter(([, c]) => c && c.width);
      const cobre = outros.filter(([, c]) => f && !(c.right <= f.left || c.left >= f.right || c.bottom <= f.top || c.top >= f.bottom)).map(([s]) => s);
      const texto = document.querySelector(".dayflag");
      return { existe: !!f, cobre, cortada: texto ? texto.scrollHeight > texto.clientHeight + 1 : false };
    });
    verificar(r.existe, `faixa de previsão ausente a ${nome}`);
    verificar(r.cobre.length === 0, `faixa de previsão sob ${r.cobre.join(", ")} a ${nome}`);
    verificar(!r.cortada, `faixa de previsão com texto cortado a ${nome}`);
    await fecharP();
  }
});

// Celular: Previsões recolhidas num botão com a data, zoom escondido (pinça) e controles cobrindo no máximo 25% do mapa.
await caso("celular", async () => {
  for (const [w, h] of [
    [360, 780],
    [393, 852],
    [430, 932],
  ]) {
    const { pagina: p, fechar } = await abrir("", celular(w, h));
    const medida = await p.evaluate(() => {
      const m = document.querySelector(".mapa").getBoundingClientRect();
      const area = (s) => {
        const r = document.querySelector(s)?.getBoundingClientRect();
        if (!r || !r.width) return 0;
        const x = Math.max(0, Math.min(r.right, m.right) - Math.max(r.left, m.left));
        const y = Math.max(0, Math.min(r.bottom, m.bottom) - Math.max(r.top, m.top));
        return x * y;
      };
      const total = [".prevs", ".zoom", ".layers-sel", ".leg", ".busca", ".resumo", ".dayflag"].reduce((s, x) => s + area(x), 0);
      const zoom = document.querySelector(".zoom");
      return { pct: Math.round((100 * total) / (m.width * m.height)), zoomVisivel: !!zoom && getComputedStyle(zoom).display !== "none" };
    });
    verificar(medida.pct <= 25, `controles cobrem ${medida.pct}% do mapa a ${w} px (máximo 25%)`);
    verificar(!medida.zoomVisivel, `botões de zoom visíveis no celular a ${w} px`);
    const botao = p.locator(".prevs-btn");
    const lista = p.locator(".prevs-lista");
    if (!(await botao.count())) {
      verificar(false, `sem o botão das Previsões a ${w} px`);
      await fechar();
      continue;
    }
    verificar((await botao.isVisible()) && !(await lista.isVisible()), `Previsões não começam recolhidas a ${w} px`);
    verificar(/\d{2}\/\d{2}/.test((await botao.textContent()) ?? ""), `botão das Previsões sem a data a ${w} px`);
    await botao.tap();
    verificar((await lista.isVisible()) && (await botao.getAttribute("aria-expanded")) === "true", `Previsões não abrem ao tocar a ${w} px`);
    await p.locator(".prevs-lista label").nth(2).tap();
    await p.waitForTimeout(150);
    const dia = await p.evaluate(() => document.querySelectorAll(".prevs-lista input")[2]?.checked);
    verificar(dia && !(await lista.isVisible()), `escolher um dia não fecha as Previsões a ${w} px`);
    verificar(await p.locator(".dayflag").isVisible(), `faixa de previsão ausente depois de escolher +2 dias a ${w} px`);
    await botao.tap();
    await p.keyboard.press("Escape");
    verificar(!(await lista.isVisible()), `Esc não fecha as Previsões a ${w} px`);
    await fechar();
  }
});

// Desktop: a lista das Previsões fica sempre aberta, sem o botão.
await caso("previsoes-desktop", async () => {
  // Desktop (1366 e 1920): Previsões começam recolhidas no botão com a data, como no celular.
  for (const [w, h] of [
    [1366, 768],
    [1920, 1080],
  ]) {
    const { pagina: p, fechar } = await abrir("", { viewport: { width: w, height: h } });
    const botao = p.locator(".prevs-btn");
    const lista = p.locator(".prevs-lista");
    verificar((await botao.isVisible()) && !(await lista.isVisible()), `Previsões não começam recolhidas a ${w} px`);
    verificar(await p.locator(".zoom").isVisible(), `zoom escondido no desktop a ${w} px`);
    await botao.click();
    verificar((await lista.isVisible()) && (await botao.getAttribute("aria-expanded")) === "true", `Previsões não abrem ao clicar a ${w} px`);
    await p.keyboard.press("Escape");
    const foco = await p.evaluate(() => document.activeElement?.classList.contains("prevs-btn"));
    verificar(!(await lista.isVisible()) && foco, `Esc não fecha as Previsões nem devolve o foco ao botão a ${w} px`);
    await fechar();
  }
});

// Rótulos: com os 27 municípios em alerta, nenhum par de rótulos à vista se sobrepõe (de longe e aproximado),
// e o de maior índice aparece.
await caso("rotulos", async () => {
  {
    const { readFile } = await import("node:fs/promises");
    const { DIST } = await import("./servidor.mjs");
    const dados = JSON.parse(await readFile(`${DIST}data/indices.json`, "utf8"));
    dados.municipios.forEach((m, i) => {
      for (const dia of m.dias) Object.assign(dia, { indice: 1.9 + i * 0.03, classe: 5 });
    });
    const maior = dados.municipios.at(-1).nome;
    for (const [nome, opcoes] of [
      ["1366", {}],
      ["393", celular(393, 852)],
    ]) {
      const contexto = await navegador.newContext({ viewport: { width: 1366, height: 900 }, ...opcoes });
      await soLocal(contexto, origem);
      await contexto.route("**/data/indices.json", (rota) => rota.fulfill({ json: dados }));
      const p = await contexto.newPage();
      await p.goto(origem + BASE, { waitUntil: "load" });
      await p.waitForSelector(".mapa .mun");
      await p.waitForTimeout(500);
      const sobrepostos = () =>
        p.evaluate(() => {
          const r = [...document.querySelectorAll(".mapa .leaflet-tooltip.mlabel, .mapa .leaflet-tooltip.ctxl")]
            .filter((el) => getComputedStyle(el).display !== "none" && getComputedStyle(el).visibility !== "hidden")
            .map((el) => [el.textContent.trim(), el.getBoundingClientRect()]);
          const pares = [];
          for (let i = 0; i < r.length; i++)
            for (let j = i + 1; j < r.length; j++) {
              const [a, ca] = r[i];
              const [b, cb] = r[j];
              if (ca.left < cb.right && cb.left < ca.right && ca.top < cb.bottom && cb.top < ca.bottom) pares.push(`${a.slice(0, 14)} × ${b.slice(0, 14)}`);
            }
          return { pares, visiveis: r.map(([t]) => t) };
        });
      const longe = await sobrepostos();
      verificar(longe.pares.length === 0, `rótulos sobrepostos de longe a ${nome}: ${longe.pares.slice(0, 4).join("; ")}`);
      verificar(longe.visiveis.some((t) => t.startsWith(maior)), `rótulo do maior índice (${maior}) escondido a ${nome}`);
      await p.locator(".mapa").focus();
      await p.keyboard.press("Equal");
      await p.waitForTimeout(700);
      const perto = await sobrepostos();
      verificar(perto.pares.length === 0, `rótulos sobrepostos aproximado a ${nome}: ${perto.pares.slice(0, 4).join("; ")}`);
      await contexto.close();
    }
  }
});

// Simulação (UC03): abre em "Agora", sem resultado; o resultado só vem com "Simular"; mudar um controle depois
// limpa o resultado, volta o mapa para "Agora" e avisa o leitor de tela.
await caso("simulacao", async () => {
  {
    const { pagina: p, fechar } = await abrir("simulacao/?municipio=4211058");
    await p.waitForSelector(".sim .go .btn.pri");
    await p.waitForTimeout(300);
    const estado = () =>
      p.evaluate(() => ({
        avisos: document.querySelectorAll(".sim .aviso").length,
        agora: document.querySelector('.maphd .seg button[aria-pressed="true"]')?.textContent?.trim() ?? "",
        simuladoDesligado: [...document.querySelectorAll(".maphd .seg button")].at(-1)?.disabled ?? false,
        resultado: document.querySelectorAll(".sim .side.form .res, .sim .resultado").length,
        anuncio: document.getElementById("anuncio")?.textContent ?? "",
      }));
    const inicio = await estado();
    verificar(inicio.avisos === 0 && inicio.resultado === 0 && inicio.agora === "Agora" && inicio.simuladoDesligado, `Simulação abre com resultado ou fora de "Agora": ${JSON.stringify(inicio)}`);
    await p.locator(".sim .go .btn.pri").click();
    await p.waitForTimeout(200);
    const depois = await estado();
    verificar(depois.avisos > 0 && depois.agora === "Simulado", `"Simular" não mostrou o resultado: ${JSON.stringify(depois)}`);
    await p.locator(".sim .presets button").first().click();
    await p.waitForTimeout(200);
    const mudou = await estado();
    verificar(mudou.avisos === 0 && mudou.agora === "Agora" && /simul/i.test(mudou.anuncio), `mudar a chuva depois de simular não limpou o resultado: ${JSON.stringify(mudou)}`);
    await fechar();
  }
});

// Painel do município a 1366 e 1920 px: "Sem alerta"/"Em alerta" e a classe nunca partem no meio, e os botões
// "Compartilhar"/"Simular chuva" ficam numa linha. Os 27 municípios passam pelas 7 classes, em PT, ES e EN.
await caso("painel", async () => {
  const { readFile } = await import("node:fs/promises");
  const { DIST } = await import("./servidor.mjs");
  const dados = JSON.parse(await readFile(`${DIST}data/indices.json`, "utf8"));
  const INDICE = [0.2, 0.5, 0.8, 1.2, 2.0, 3.0, 3.6];
  dados.municipios.forEach((m, i) => {
    for (const d of m.dias) Object.assign(d, { indice: INDICE[i % 7], classe: (i % 7) + 1 });
  });
  for (const lang of ["", "es/", "en/"]) {
    for (const [w, h] of [
      [1366, 768],
      [1920, 1080],
    ]) {
      const contexto = await navegador.newContext({ viewport: { width: w, height: h } });
      await soLocal(contexto, origem);
      await contexto.route("**/data/indices.json", (rota) => rota.fulfill({ json: dados }));
      const p = await contexto.newPage();
      const ruins = [];
      for (const m of dados.municipios) {
        await p.goto(`${origem}${BASE}${lang}?municipio=${m.ibge}`, { waitUntil: "load" });
        await p.waitForSelector(".side.r .acts .btn", { timeout: 30_000 });
        const r = await p.evaluate(() => {
          // Linhas de texto do elemento (só os nós de texto: o ícone ao lado não conta), com 4 px de tolerância.
          const linhas = (el) => {
            const topos = [];
            const nos = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
            for (let n = nos.nextNode(); n; n = nos.nextNode()) {
              if (!n.textContent.trim()) continue;
              const intervalo = document.createRange();
              intervalo.selectNodeContents(n);
              for (const c of intervalo.getClientRects()) if (c.width > 1) topos.push(c.top);
            }
            return new Set(topos.map((t) => Math.round(t / 6))).size;
          };
          const pedacos = [...document.querySelectorAll(".side.r .pill > span")];
          const botoes = [...document.querySelectorAll(".side.r .acts .btn")];
          return {
            pill: pedacos.length >= 2 && pedacos.every((s) => linhas(s) === 1),
            botoes: botoes.every((b) => linhas(b) === 1),
          };
        });
        if (!r.pill || !r.botoes) ruins.push(`${m.nome}${r.pill ? "" : " (alerta/classe)"}${r.botoes ? "" : " (botões)"}`);
      }
      verificar(ruins.length === 0, `painel a ${w} px (${lang || "pt/"}) com texto partido: ${ruins.slice(0, 6).join(", ")}`);
      await contexto.close();
    }
  }
});

// Topo: no desktop sem o botão de acessibilidade (está no rail); idioma num seletor único "PT ▾" que abre por
// teclado; região como subtítulo do logo; "Situação de dd/mm/aaaa" em fonte de texto, sempre à vista (RN11).
await caso("topo", async () => {
  const SITUACAO = { "": /^Situação de \d{2}\/\d{2}\/\d{4}$/, "es/": /^Situación del \d{2}\/\d{2}\/\d{4}$/, "en/": /^Status on \d{2}\/\d{2}\/\d{4}$/ };
  for (const lang of ["", "es/", "en/"]) {
    for (const [w, h, mob] of [
      [1366, 768, false],
      [1920, 1080, false],
      [393, 852, true],
    ]) {
      const { pagina: p, fechar } = await abrir(lang, mob ? celular(w, h, 2) : { viewport: { width: w, height: h } });
      await p.waitForSelector(".hdr .status .dot", { timeout: 30_000 });
      const r = await p.evaluate(() => {
        const vis = (s) => {
          const el = document.querySelector(s);
          if (!el) return false;
          const c = el.getBoundingClientRect();
          return c.width > 0 && c.height > 0 && getComputedStyle(el).visibility !== "hidden" && c.right <= innerWidth && c.bottom <= innerHeight;
        };
        const status = document.querySelector(".hdr .status");
        return {
          a11y: vis(".hdr .a11yb"),
          regiao: !!document.querySelector(".hdr .region"),
          subtitulo: document.querySelector(".brand small")?.textContent ?? "",
          subtituloVisivel: vis(".brand small"),
          seletor: document.querySelector(".hdr .lang .langb span[lang]")?.textContent?.trim() ?? "",
          situacao: status?.textContent?.trim() ?? "",
          situacaoVisivel: vis(".hdr .status"),
          mono: /mono/i.test(getComputedStyle(status).fontFamily),
        };
      });
      const onde = `${w} px (${lang || "pt/"})`;
      verificar(r.a11y === mob, `botão de acessibilidade do topo ${mob ? "ausente no celular" : "ainda no desktop"} a ${onde}`);
      verificar(!r.regiao && (mob || (r.subtituloVisivel && /Alto Vale do Itajaí, SC/.test(r.subtitulo))), `região fora do subtítulo do logo a ${onde}: ${JSON.stringify(r.subtitulo)}`);
      verificar(/^(PT|ES|EN)$/.test(r.seletor.replace(/\s+/g, "")), `seletor de idioma não é "PT ▾" a ${onde}: ${JSON.stringify(r.seletor)}`);
      verificar(SITUACAO[lang].test(r.situacao) && r.situacaoVisivel && !r.mono, `data da situação a ${onde}: ${JSON.stringify(r)}`);
      if (!mob && (await p.locator(".hdr .lang .langb").count())) {
        // Seletor de idioma por teclado: Enter abre, Esc fecha e devolve o foco.
        const botao = p.locator(".hdr .lang .langb");
        await botao.focus();
        await p.keyboard.press("Enter");
        const aberto = await p.evaluate(() => ({
          expandido: document.querySelector(".hdr .lang .langb")?.getAttribute("aria-expanded"),
          links: [...document.querySelectorAll(".hdr .lang-menu a[hreflang]")].filter((a) => a.getBoundingClientRect().width > 0).length,
          atual: document.querySelector('.hdr .lang-menu a[aria-current="true"]')?.getAttribute("hreflang"),
        }));
        verificar(aberto.expandido === "true" && aberto.links === 3 && !!aberto.atual, `seletor de idioma não abre com Enter a ${onde}: ${JSON.stringify(aberto)}`);
        await p.keyboard.press("Escape");
        const fechou = await p.evaluate(() => ({
          foco: document.activeElement?.classList.contains("langb"),
          links: [...document.querySelectorAll(".hdr .lang-menu a")].filter((a) => a.getBoundingClientRect().width > 0).length,
        }));
        verificar(fechou.foco && fechou.links === 0, `Esc não fecha o seletor de idioma a ${onde}: ${JSON.stringify(fechou)}`);
      }
      await fechar();
    }
  }
});

// Coerência entre telas: mesmos nomes para a mesma coisa.
await caso("termos", async () => {
  {
    const { pagina: p, fechar } = await abrir("?municipio=4217808");
    await p.waitForSelector(".side.r .vars");
    const painel = await p.locator(".side.r").innerText();
    verificar(painel.includes("Chuva efetiva / limiar") && !painel.includes("Razão chuva"), "Monitoramento não usa \"Chuva efetiva / limiar\", como a tela Dados");
    await fechar();
  }
});

// Ajuda: sem ID de vídeo, só as dicas (nenhuma área de vídeo, nada do YouTube); "?" no topo do celular,
// item no rail do desktop e link no topo da Cartilha.
await caso("ajuda", async () => {
  for (const lang of ["", "es/", "en/"]) {
    const contexto = await navegador.newContext({ viewport: { width: 1366, height: 900 } });
    const externas = await soLocal(contexto, origem);
    const p = await contexto.newPage();
    await p.goto(origem + BASE + lang + "ajuda/", { waitUntil: "load" });
    await p.waitForSelector(".ajuda h1", { timeout: 30_000 });
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => ({
      h1: document.querySelector(".ajuda h1")?.textContent ?? "",
      secoes: document.querySelectorAll(".aj-sec").length,
      // Sem ID: quadro 16:9 com a capa e "em produção", sem botão nem iframe.
      quadro: (() => {
        const q = document.querySelector(".aj-quadro");
        if (!q) return null;
        const c = q.getBoundingClientRect();
        const img = q.querySelector("img");
        return {
          proporcao: Math.round((c.width / c.height) * 100) / 100,
          capa: !!img && img.complete && img.naturalWidth > 0,
          texto: q.textContent.trim(),
          interativo: q.querySelectorAll("button, iframe, a").length,
          noTopo: !!document.querySelector(".ajuda .aj-top + .aj-video"),
        };
      })(),
      rail: !!document.querySelector('.rail .foot a[href$="/ajuda/"][aria-current="page"]'),
      topo: getComputedStyle(document.querySelector(".hbtn.ajudab")).display,
    }));
    verificar(r.h1.length > 0 && r.secoes === 7, `Ajuda (${lang || "pt/"}) sem título ou sem as 7 seções de dicas: ${JSON.stringify(r)}`);
    const EM_PRODUCAO = { "": "Vídeo tutorial em produção", "es/": "Video tutorial en producción", "en/": "Video tutorial in production" }[lang];
    verificar(
      !!r.quadro && Math.abs(r.quadro.proporcao - 1.78) < 0.03 && r.quadro.capa && r.quadro.texto.includes(EM_PRODUCAO) && r.quadro.interativo === 0 && r.quadro.noTopo,
      `Ajuda (${lang || "pt/"}) sem o quadro 16:9 "em produção" no topo: ${JSON.stringify(r.quadro)}`,
    );
    verificar(!externas.some((u) => /youtube|ytimg|googlevideo/.test(u)), `Ajuda (${lang || "pt/"}) pediu algo ao YouTube: ${externas.filter((u) => /youtube/.test(u)).join(", ")}`);
    verificar(r.rail && r.topo === "none", `Ajuda no desktop (${lang || "pt/"}): item no rail ${r.rail}, "?" do topo ${r.topo}`);
    await contexto.close();
  }
  for (const [w, h] of [
    [320, 640],
    [360, 780],
    [393, 852],
    [430, 932],
  ]) {
    for (const [lang, tela] of [
      ["", "cartilha/"],
      ["es/", "cartilha/"],
      ["", "ajuda/"],
      ["en/", "ajuda/"],
    ]) {
      // Densidade 2, como num celular: com 1, o arredondamento escondia 1 px que faltava a 393 px.
      const { pagina: p, fechar } = await abrir(lang + tela, celular(w, h, 2));
      await p.waitForSelector(".hbtn.ajudab");
      const r = await p.evaluate(() => {
        const caixas = [".brand", ".tghdr", ".hdr .lang", ".a11yb", ".ajudab"].map((s) => [s, document.querySelector(s).getBoundingClientRect()]);
        const topo = caixas[0][1].top;
        const fora = caixas.filter(([, c]) => c.right > innerWidth || c.left < 0 || c.width === 0).map(([s]) => s);
        const outraLinha = caixas.filter(([, c]) => c.top > topo + 30).map(([s]) => s);
        const pares = [];
        for (let i = 0; i < caixas.length; i++)
          for (let j = i + 1; j < caixas.length; j++) {
            const [a, ca] = caixas[i];
            const [b, cb] = caixas[j];
            if (ca.left < cb.right - 0.5 && cb.left < ca.right - 0.5 && ca.top < cb.bottom && cb.top < ca.bottom) pares.push(`${a}×${b}`);
          }
        const ajuda = document.querySelector(".ajudab");
        const link = document.querySelector('#conteudo a[href$="/ajuda/"]');
        return { fora, outraLinha, pares, nome: ajuda.getAttribute("aria-label"), href: ajuda.getAttribute("href"), cartilha: !!link && link.getBoundingClientRect().width > 0 };
      });
      verificar(r.fora.length === 0 && r.outraLinha.length === 0 && r.pares.length === 0, `topo a ${w} px (${lang || "pt/"}${tela}) com o "?": fora ${r.fora}, outra linha ${r.outraLinha}, sobrepostos ${r.pares}`);
      verificar(!!r.nome && r.href?.endsWith("/ajuda/"), `"?" do topo sem nome ou sem link para a Ajuda a ${w} px (${lang || "pt/"})`);
      if (tela === "cartilha/") verificar(r.cartilha, `Cartilha sem o link para a Ajuda a ${w} px (${lang || "pt/"})`);
      await fechar();
    }
  }
});

// Movimento reduzido: o zoom por teclado (+/−), duplo clique e pinça também fica sem animação (o Leaflet só cria
// o .leaflet-proxy com a animação de zoom ligada).
await caso("movimento", async () => {
  for (const [reducao, animado] of [
    ["reduce", false],
    ["no-preference", true],
  ]) {
    const { pagina: p, fechar } = await abrir("", { reducedMotion: reducao });
    const tem = await p.locator(".mapa .leaflet-proxy").count();
    verificar(Boolean(tem) === animado, `zoom do mapa ${animado ? "sem" : "com"} animação com prefers-reduced-motion: ${reducao}`);
    await fechar();
  }
});

// Barra inferior do celular: o texto do primeiro e do último item a pelo menos 12 px das bordas, sem cortar em 320 px.
await caso("barra", async () => {
  for (const lang of ["", "es/", "en/"]) {
    for (const [w, h] of [
      [320, 640],
      [393, 852],
    ]) {
      const contexto = await navegador.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
      await soLocal(contexto, origem);
      const p = await contexto.newPage();
      await p.goto(origem + BASE + lang + "cartilha/", { waitUntil: "load" });
      await p.waitForSelector(".rail .navlist .item");
      const r = await p.evaluate(() => {
        const itens = [...document.querySelectorAll(".rail .navlist .item")];
        const texto = (el) => {
          const intervalo = document.createRange();
          intervalo.selectNodeContents(el.querySelector(".short") ?? el);
          return intervalo.getBoundingClientRect();
        };
        const primeiro = texto(itens[0]);
        const ultimo = texto(itens.at(-1));
        const cortados = itens.map((el) => el.querySelector(".short")).filter((s) => s && s.scrollWidth > s.clientWidth + 1).map((s) => s.textContent.trim());
        return { esq: Math.round(primeiro.left), dir: Math.round(innerWidth - ultimo.right), cortados };
      });
      if (w === 393) verificar(r.esq >= 12 && r.dir >= 12, `barra inferior a ${w} px (${lang || "pt/"}): texto a ${r.esq} px e ${r.dir} px das bordas (mínimo 12)`);
      verificar(r.cortados.length === 0, `barra inferior a ${w} px (${lang || "pt/"}) com rótulo cortado: ${r.cortados.join(", ")}`);
      await contexto.close();
    }
  }
});

// Aviso de dados desatualizados só nas telas que exibem índice (Monitoramento, Simulação e Dados).
await caso("desatualizado", async () => {
  {
    const { readFile } = await import("node:fs/promises");
    const { DIST } = await import("./servidor.mjs");
    const antigo = { ...JSON.parse(await readFile(`${DIST}data/indices.json`, "utf8")), gerado_em: "2020-01-01T09:00:00+00:00" };
    const contexto = await navegador.newContext({ viewport: { width: 1366, height: 900 } });
    await soLocal(contexto, origem);
    await contexto.route("**/data/indices.json", (rota) => rota.fulfill({ json: antigo }));
    for (const [tela, deve] of [
      ["", true],
      ["simulacao/", true],
      ["dados/", true],
      ["areas-de-risco/", false],
      ["cartilha/", false],
      ["contatos/", false],
    ]) {
      const p = await contexto.newPage();
      await p.goto(origem + BASE + tela, { waitUntil: "load" });
      await p.waitForSelector(".hdr .stamp .dot, .hdr .dot", { timeout: 30_000 }).catch(() => {});
      await p.waitForTimeout(400);
      const tem = await p.getByText("Dados desatualizados").count();
      verificar(Boolean(tem) === deve, `aviso de dados desatualizados ${deve ? "ausente" : "presente"} em /${tela}`);
      await p.close();
    }
    await contexto.close();
  }
});

// Datas sempre com o ano em 4 dígitos (Previsões, faixa de previsão e painel do município).
await caso("datas", async () => {
  for (const [nome, opcoes] of [
    ["1366", {}],
    ["320", celular(320, 640)],
  ]) {
    const { pagina: p, fechar } = await abrir("?municipio=4217808", opcoes);
    await p.evaluate(() => [...document.querySelectorAll(".prevs input[type=radio]")][1]?.click());
    await p.waitForTimeout(200);
    if (await p.locator(".prevs-btn").isVisible()) await p.locator(".prevs-btn").click();
    const textos = await p.evaluate(() =>
      [".prevs-lista", ".dayflag", ".side.r .bigsub"].map((s) => document.querySelector(s)?.textContent ?? ""),
    );
    const curtas = textos.join(" | ").match(/(?<!\d)\d{2}\/\d{2}\/\d{2}(?!\d)/g) ?? [];
    verificar(curtas.length === 0, `datas com ano de 2 dígitos a ${nome}: ${curtas.join(", ")}`);
    const cortados = await p.evaluate(() =>
      [...document.querySelectorAll(".prevs-lista label")].filter((l) => l.scrollWidth > l.clientWidth + 1).map((l) => l.textContent),
    );
    verificar(cortados.length === 0, `linhas das Previsões cortadas a ${nome}: ${cortados.join(", ")}`);
    await fechar();
  }
});

// Contatos: sem nome do coordenador, a linha some (nada de "a confirmar" no ar).
await caso("contatos", async () => {
  {
    const { pagina: p, fechar } = await abrir("contatos/");
    await p.waitForSelector(".cc h2", { timeout: 30_000 });
    const texto = await p.locator(".cgrid").innerText();
    verificar(!/coordenador\(a\) a confirmar/i.test(texto), "Contatos mostra \"Nome do coordenador(a) a confirmar\"");
    // RN09: 27 cartões; selo só nos 2 verificados; os demais com a fonte oficial e a data; sem telefone da
    // Defesa Civil, o 199 e o 193 no cartão; WhatsApp só nos verificados.
    const r = await p.evaluate(() => {
      const cartoes = [...document.querySelectorAll(".cgrid .cc")];
      const semFonte = cartoes.filter((c) => !c.querySelector(".tag.ok") && !c.querySelector(".cfonte a[href^='https://']")).map((c) => c.querySelector("h2")?.textContent);
      const taio = cartoes.find((c) => c.querySelector("h2")?.textContent?.startsWith("Taió"));
      return {
        total: cartoes.length,
        selos: cartoes.filter((c) => c.querySelector(".tag.ok")).length,
        semFonte,
        datas: cartoes.filter((c) => /\d{2}\/\d{2}\/\d{4}/.test(c.querySelector(".cfonte")?.textContent ?? "")).length,
        taio: taio ? [...taio.querySelectorAll("a[href^='tel:']")].map((a) => a.getAttribute("href")) : null,
        whatsapp: cartoes.filter((c) => c.querySelector("a[href*='wa.me']") && !c.querySelector(".tag.ok")).length,
      };
    });
    verificar(r.total === 27 && r.selos === 2, `Contatos com ${r.total} cartões e ${r.selos} selos (esperado 27 e 2)`);
    verificar(r.semFonte.length === 0 && r.datas === 25, `cartões sem fonte ou sem data: ${r.semFonte.join(", ")} (com data: ${r.datas})`);
    verificar(JSON.stringify(r.taio) === JSON.stringify(["tel:199", "tel:193"]), `cartão de Taió sem 199 e 193: ${JSON.stringify(r.taio)}`);
    verificar(r.whatsapp === 0, `WhatsApp em ${r.whatsapp} cartões não verificados`);
    await fechar();
  }
});

// Foco do município: com clique de mouse (inclusive vindo de ?municipio=), nenhum contorno nem realce de toque;
// com teclado, o tracejado segue o contorno do polígono.
await caso("foco", async () => {
  {
    const estadoFoco = (p) =>
      p.evaluate(() => {
        const a = document.activeElement;
        const s = getComputedStyle(a);
        const caminho = document.querySelector(".mapa .mun");
        return {
          ehMunicipio: a.matches?.(".mun") ?? false,
          visivel: a.matches(":focus-visible"),
          contorno: s.outlineStyle,
          tracejado: s.strokeDasharray,
          realce: getComputedStyle(caminho).webkitTapHighlightColor,
          realceMapa: getComputedStyle(document.querySelector(".mapa")).webkitTapHighlightColor,
        };
      });
    const { pagina: p, fechar } = await abrir("?municipio=4217808");
    await p.locator('path.mun[aria-label*="Ibirama"]').click();
    await p.locator('path.mun[aria-label*="Taió"]').click();
    await p.waitForTimeout(200);
    const mouse = await estadoFoco(p);
    verificar(!mouse.visivel && mouse.contorno === "none", `clique de mouse no município mostra foco (${JSON.stringify(mouse)})`);
    // Nenhum contorno no SVG nem no contêiner do mapa quando o foco não veio do teclado.
    const semContorno = await p.evaluate(() =>
      [document.querySelector(".mapa"), document.querySelector(".mapa .leaflet-overlay-pane svg")].map((el) => {
        el.focus();
        return getComputedStyle(el).outlineStyle;
      }),
    );
    verificar(semContorno.every((s) => s === "none"), `contorno no mapa ou no SVG com foco de script: ${semContorno.join(", ")}`);
    // Teclado: Tab chega ao polígono, Enter seleciona e o foco continua nele, tracejado.
    await p.locator('path.mun[aria-label*="Ibirama"]').focus();
    await p.keyboard.press("Shift+Tab");
    await p.keyboard.press("Tab");
    await p.keyboard.press("Enter");
    await p.waitForTimeout(200);
    const teclado = await estadoFoco(p);
    verificar(teclado.ehMunicipio && teclado.visivel && teclado.tracejado !== "none" && teclado.contorno === "none", `foco por teclado no município sem o tracejado (${JSON.stringify(teclado)})`);
    await fechar();
    // Toque: sem o retângulo escuro do realce de toque sobre a caixa do polígono.
    const { pagina: t, fechar: fecharT } = await abrir("", celular(393, 852));
    const toque = await estadoFoco(t);
    verificar(toque.realce === "rgba(0, 0, 0, 0)" && toque.realceMapa === "rgba(0, 0, 0, 0)", `realce de toque no mapa: ${toque.realce} / ${toque.realceMapa}`);
    await fecharT();
  }
});

await navegador.close();
servidor.close();
if (falhas.length) {
  for (const f of falhas) console.log(`✗ ${f}`);
  console.log(`\n${falhas.length} de ${verificacoes} verificações falharam.`);
  process.exit(1);
}
console.log(`interação: ${verificacoes} verificações, nenhuma falha.`);
