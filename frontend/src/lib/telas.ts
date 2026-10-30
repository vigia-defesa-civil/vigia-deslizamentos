import type { Idioma } from "./preferencias";

export interface Tela {
  /** Caminho depois da base do site ("" = Monitoramento). */
  rota: string;
  nome: string;
  /** Rótulo da barra inferior no celular. */
  curto: string;
}

export const TELAS: readonly Tela[] = [
  { rota: "", nome: "Monitoramento", curto: "Mapa" },
  { rota: "simulacao", nome: "Simulação", curto: "Simular" },
  { rota: "dados", nome: "Dados da análise", curto: "Dados" },
  { rota: "areas-de-risco", nome: "Áreas de risco", curto: "Áreas" },
  { rota: "cartilha", nome: "Cartilha", curto: "Cartilha" },
  { rota: "contatos", nome: "Contatos", curto: "Contatos" },
];

/** Ajuda: fora da barra inferior do celular (6 itens já enchem 320 px); fica no rail e no "?" do topo. */
export const AJUDA: Tela = { rota: "ajuda", nome: "Ajuda", curto: "Ajuda" };

/** Tela pela rota, incluindo a Ajuda (título da página e seletor de idioma). */
export const telaPorRota = (r: string): Tela | undefined => [...TELAS, AJUDA].find((x) => x.rota === r);

/** Telas que exibem índice de risco: só nelas o aviso de dados desatualizados (RNF04) faz sentido. */
const COM_INDICE = new Set(["", "simulacao", "dados"]);
export const mostraIndice = (tela: string): boolean => COM_INDICE.has(tela);

/** URL da tela no idioma: o espanhol fica em /es/ e o inglês em /en/. */
export function rota(tela: string, lang: Idioma, base: string = import.meta.env.BASE_URL): string {
  const partes = [base, lang === "pt" ? "" : lang, tela].map((p) => p.replace(/^\/+|\/+$/g, "")).filter(Boolean);
  return `/${partes.map((p) => `${p}/`).join("")}`;
}

/** Troca de idioma sem perder o estado da URL (?municipio=, #âncora). */
export const rotaComEstado = (
  tela: string,
  lang: Idioma,
  local: Pick<Location, "search" | "hash">,
  base: string = import.meta.env.BASE_URL,
): string => rota(tela, lang, base) + local.search + local.hash;
