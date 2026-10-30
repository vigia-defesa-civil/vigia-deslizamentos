// RNF01: roda o axe-core (WCAG 2.1 A e AA) em todas as páginas do dist/, nos temas claro e escuro,
// a 1366 e a 320 px. Requisições externas (tiles do mapa) são cortadas: o resultado não depende da rede.
// Uso: npm run build && npm run test:a11y. Sai com 1 se houver qualquer violação.
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";
import { paginas, servir, soLocal } from "./servidor.mjs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const LARGURAS = [
  { width: 1366, height: 900 },
  { width: 320, height: 640 },
];

const { servidor, origem } = await servir();
const navegador = await chromium.launch();
let total = 0;
let rodadas = 0;
try {
  const lista = await paginas();
  for (const tema of ["light", "dark"]) {
    for (const viewport of LARGURAS) {
      const contexto = await navegador.newContext({ colorScheme: tema, viewport });
      await soLocal(contexto, origem);
      for (const caminho of lista) {
        const pagina = await contexto.newPage();
        await pagina.goto(origem + caminho, { waitUntil: "load", timeout: 60_000 });
        await pagina.waitForSelector("#conteudo", { timeout: 30_000 });
        await pagina.waitForLoadState("networkidle", { timeout: 30_000 });
        const { violations } = await new AxeBuilder({ page: pagina }).withTags(TAGS).analyze();
        rodadas++;
        for (const v of violations) {
          total += v.nodes.length;
          console.log(`✗ ${caminho} [${tema}, ${viewport.width} px] ${v.id} (${v.impact}) — ${v.help}`);
          for (const n of v.nodes.slice(0, 5)) console.log(`    ${n.target.join(" ")}`);
          if (v.nodes.length > 5) console.log(`    … e mais ${v.nodes.length - 5}`);
        }
        await pagina.close();
      }
      await contexto.close();
    }
  }
  console.log(total ? `\n${total} ocorrência(s) de violação.` : `\naxe: nenhuma violação em ${lista.length} páginas × 2 temas × 2 larguras (${rodadas} verificações).`);
} finally {
  await navegador.close();
  servidor.close();
}
process.exit(total ? 1 : 0);
