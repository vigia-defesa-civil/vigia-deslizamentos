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

await navegador.close();
servidor.close();
if (falhas.length) {
  for (const f of falhas) console.log(`✗ ${f}`);
  console.log(`\n${falhas.length} de ${verificacoes} verificações falharam.`);
  process.exit(1);
}
console.log(`interação: ${verificacoes} verificações, nenhuma falha.`);
