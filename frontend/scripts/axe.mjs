// RNF01: roda o axe-core (WCAG 2.1 A e AA) em todas as páginas do dist/, nos temas claro e escuro.
// Uso: npm run build && npm run test:a11y. Sai com 1 se houver qualquer violação.
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
const BASE = "/vigia-deslizamentos/";
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".geojson": "application/geo+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/** Páginas de tela: todo index.html do dist/, menos os redirects (meta refresh). */
async function paginas(pasta = DIST) {
  const achadas = [];
  for (const item of await readdir(pasta, { withFileTypes: true })) {
    const caminho = join(pasta, item.name);
    if (item.isDirectory()) achadas.push(...(await paginas(caminho)));
    else if (item.name === "index.html" && !(await readFile(caminho, "utf8")).includes('http-equiv="refresh"')) {
      const dir = relative(DIST, pasta).split(sep).filter(Boolean).join("/");
      achadas.push(BASE + (dir ? `${dir}/` : ""));
    }
  }
  return achadas.sort();
}

/** Servidor estático do dist/ sob a base do site, como no GitHub Pages. */
function servir() {
  const servidor = createServer(async (req, res) => {
    const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (!url.startsWith(BASE)) return res.writeHead(404).end();
    let arquivo = join(DIST, url.slice(BASE.length));
    if (url.endsWith("/")) arquivo = join(arquivo, "index.html");
    try {
      const corpo = await readFile(arquivo);
      res.writeHead(200, { "content-type": TIPOS[extname(arquivo)] ?? "application/octet-stream" }).end(corpo);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((ok) => servidor.listen(0, "127.0.0.1", () => ok(servidor)));
}

const servidor = await servir();
const origem = `http://127.0.0.1:${servidor.address().port}`;
const navegador = await chromium.launch();
let total = 0;
try {
  const lista = await paginas();
  for (const tema of ["light", "dark"]) {
    const contexto = await navegador.newContext({ colorScheme: tema, viewport: { width: 1366, height: 900 } });
    for (const caminho of lista) {
      const pagina = await contexto.newPage();
      await pagina.goto(origem + caminho, { waitUntil: "networkidle", timeout: 60_000 });
      const { violations } = await new AxeBuilder({ page: pagina }).withTags(TAGS).analyze();
      for (const v of violations) {
        total += v.nodes.length;
        console.log(`✗ ${caminho} [${tema}] ${v.id} (${v.impact}) — ${v.help}`);
        for (const n of v.nodes.slice(0, 5)) console.log(`    ${n.target.join(" ")}`);
        if (v.nodes.length > 5) console.log(`    … e mais ${v.nodes.length - 5}`);
      }
      await pagina.close();
    }
    await contexto.close();
  }
  console.log(total ? `\n${total} ocorrência(s) de violação.` : `\naxe: nenhuma violação em ${lista.length} páginas × 2 temas.`);
} finally {
  await navegador.close();
  servidor.close();
}
process.exit(total ? 1 : 0);
