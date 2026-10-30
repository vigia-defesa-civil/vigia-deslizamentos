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
    const outros = [".resumo"].map((s) => [s, caixa(s)]).filter(([, c]) => c && c.width);
    const cobre = outros.filter(([, c]) => f && !(c.right <= f.left || c.left >= f.right || c.bottom <= f.top || c.top >= f.bottom)).map(([s]) => s);
    const texto = document.querySelector(".dayflag");
    return { existe: !!f, cobre, cortada: texto ? texto.scrollHeight > texto.clientHeight + 1 : false };
  });
  verificar(r.existe, `faixa de previsão ausente a ${nome}`);
  verificar(r.cobre.length === 0, `faixa de previsão sob ${r.cobre.join(", ")} a ${nome}`);
  verificar(!r.cortada, `faixa de previsão com texto cortado a ${nome}`);
  await fecharP();
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
