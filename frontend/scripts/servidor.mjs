// Servidor estático do dist/ para os testes de navegador (axe.mjs, interacao.mjs), como no GitHub Pages.
import { createServer } from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const DIST = fileURLToPath(new URL("../dist/", import.meta.url));
export const BASE = "/vigia-deslizamentos/";
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
export async function paginas(pasta = DIST) {
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

/** Sobe o servidor numa porta livre e devolve { servidor, origem }. */
export async function servir() {
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
  await new Promise((ok) => servidor.listen(0, "127.0.0.1", ok));
  return { servidor, origem: `http://127.0.0.1:${servidor.address().port}` };
}

// As fontes do site passam: sem elas, a fonte de reserva é mais estreita e o teste de layout erraria a largura.
const FONTES = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;

/**
 * Corta toda requisição fora do servidor local, menos as fontes (tiles do mapa, CDN): o teste não fica lento
 * nem falha quando um servidor de tiles demora. Devolve a lista das URLs externas cortadas.
 */
export async function soLocal(contexto, origem) {
  const externas = [];
  await contexto.route("**/*", (rota) => {
    const url = rota.request().url();
    if (url.startsWith(origem) || url.startsWith("data:") || FONTES.test(url)) return rota.continue();
    externas.push(url);
    return rota.abort("blockedbyclient");
  });
  return externas;
}
