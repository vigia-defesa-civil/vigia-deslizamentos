// Dados de exemplo do npm run dev (src/pages/exemplos): as datas andam junto com o dia de hoje.
import { hojeEmBrasilia } from "./formato";
import { diasDesde } from "./mapa";
import { somarDias } from "./periodo";

const DATA = /^(\d{4}-\d{2}-\d{2})(T.*)?$/;
const GERADO_ANTES_MS = 60 * 60 * 1000;

/** Soma `dias` a toda data AAAA-MM-DD (e ao dia de toda data-hora ISO) dentro de `valor`. */
export function deslocarDatas<T>(valor: T, dias: number): T {
  if (typeof valor === "string") {
    const m = DATA.exec(valor);
    return (m ? somarDias(m[1], dias) + (m[2] ?? "") : valor) as T;
  }
  if (Array.isArray(valor)) return valor.map((x) => deslocarDatas(x, dias)) as T;
  if (valor && typeof valor === "object") return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, deslocarDatas(v, dias)])) as T;
  return valor;
}

/**
 * Exemplo com o D0 (`d0` do indices.exemplo.json) em hoje, no horário de Brasília. `gerado_em`, quando existe,
 * fica 1 h antes de agora: o aviso de dados desatualizados não aparece no desenvolvimento.
 */
export function exemploParaHoje(json: unknown, d0: string, agora: Date = new Date()): unknown {
  const deslocado = deslocarDatas(json, diasDesde(d0, hojeEmBrasilia(agora)));
  if (deslocado && typeof deslocado === "object" && "gerado_em" in deslocado)
    return { ...deslocado, gerado_em: new Date(agora.getTime() - GERADO_ANTES_MS).toISOString() };
  return deslocado;
}
