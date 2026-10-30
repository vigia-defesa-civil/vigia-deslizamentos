// Testes de layout e interação que só um navegador de verdade mede (sobreposição, foco, toque).
// Uso: npm run build && node scripts/interacao.mjs. Sai com 1 se alguma verificação falhar.
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

const celular = (width, height) => ({ viewport: { width, height }, isMobile: true, hasTouch: true });

// RN06: com um dia de previsão, a faixa "valores estimados" fica inteira à vista, sem o resumo por cima.
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

// Celular: Previsões recolhidas num botão com a data, zoom escondido (pinça) e controles cobrindo no máximo 25% do mapa.
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

// Desktop: a lista das Previsões fica sempre aberta, sem o botão.
{
  const { pagina: p, fechar } = await abrir("");
  verificar((await p.locator(".prevs-lista").isVisible()) && !(await p.locator(".prevs-btn").isVisible()), "Previsões recolhidas no desktop");
  verificar(await p.locator(".zoom").isVisible(), "zoom escondido no desktop");
  await fechar();
}

// Rótulos: com os 27 municípios em alerta, nenhum par de rótulos à vista se sobrepõe (de longe e aproximado),
// e o de maior índice aparece.
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

// Coerência entre telas: mesmos nomes para a mesma coisa.
{
  const { pagina: p, fechar } = await abrir("?municipio=4217808");
  await p.waitForSelector(".side.r .vars");
  const painel = await p.locator(".side.r").innerText();
  verificar(painel.includes("Chuva efetiva / limiar") && !painel.includes("Razão chuva"), "Monitoramento não usa \"Chuva efetiva / limiar\", como a tela Dados");
  await fechar();
}

// Barra inferior do celular: o texto do primeiro e do último item a pelo menos 12 px das bordas, sem cortar em 320 px.
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

// Aviso de dados desatualizados só nas telas que exibem índice (Monitoramento, Simulação e Dados).
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

// Datas sempre com o ano em 4 dígitos (Previsões, faixa de previsão e painel do município).
for (const [nome, opcoes] of [
  ["1366", {}],
  ["320", celular(320, 640)],
]) {
  const { pagina: p, fechar } = await abrir("?municipio=4217808", opcoes);
  await p.evaluate(() => [...document.querySelectorAll(".prevs input[type=radio]")][1]?.click());
  await p.waitForTimeout(200);
  if (await p.locator(".prevs-btn").isVisible()) await p.locator(".prevs-btn").tap();
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

// Contatos: sem nome do coordenador, a linha some (nada de "a confirmar" no ar).
{
  const { pagina: p, fechar } = await abrir("contatos/");
  await p.waitForSelector(".cc h2", { timeout: 30_000 });
  const texto = await p.locator(".cgrid").innerText();
  verificar(!/coordenador\(a\) a confirmar/i.test(texto), "Contatos mostra \"Nome do coordenador(a) a confirmar\"");
  await fechar();
}

// Foco do município: com clique de mouse (inclusive vindo de ?municipio=), nenhum contorno nem realce de toque;
// com teclado, o tracejado segue o contorno do polígono.
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

await navegador.close();
servidor.close();
if (falhas.length) {
  for (const f of falhas) console.log(`✗ ${f}`);
  console.log(`\n${falhas.length} de ${verificacoes} verificações falharam.`);
  process.exit(1);
}
console.log(`interação: ${verificacoes} verificações, nenhuma falha.`);
