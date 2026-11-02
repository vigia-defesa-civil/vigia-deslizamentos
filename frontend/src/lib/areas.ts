// Tela Áreas de risco: qual painel mostrar. Erro de carga nunca vira "sem setores" (segurança).
import type { T } from "../i18n";
import type { Resultado } from "./dados";
import type { ColecaoSetores } from "./setores";

export function estadoDoPainel(
  carga: Resultado<ColecaoSetores> | undefined,
  municipio: string | null,
  setor: string | null,
): "carregando" | "erro" | "regiao" | "municipio" | "setor" {
  if (!carga) return "carregando";
  if (!carga.ok) return "erro";
  if (setor) return "setor";
  return municipio ? "municipio" : "regiao";
}

/** Nome acessível do município no mapa desta tela: nome e número de setores, sem índice. */
export function rotuloSetoresMunicipio(t: T, M: string, n: number): string {
  if (n === 0) return t("{M}: nenhum setor de deslizamento mapeado pelo SGB", { M });
  if (n === 1) return t("{M}: 1 setor de risco geológico", { M });
  return t("{M}: {N} setores de risco geológico", { M, N: String(n) });
}

/** "Mapeamentos de 2011 a 2024", ou só "Mapeamento de 2018" quando os anos são iguais. */
export const textoMapeamentos = (t: T, anoMin: number, anoMax: number): string =>
  anoMin === anoMax ? t("Mapeamento de {N}", { N: String(anoMin) }) : t("Mapeamentos de {N} a {N}", { N: [String(anoMin), String(anoMax)] });
