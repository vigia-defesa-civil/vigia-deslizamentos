import Ajv2020 from "ajv/dist/2020";
import addFormats from "ajv-formats";
import { describe, expect, it } from "vitest";
import schema from "../../../docs/indices.schema.json";
import { lerHistorico } from "../lib/historico";
import { lerContatos, lerEstacoes, lerIndices, lerOcorrencias, type Resultado } from "../lib/dados";
import indices from "./indices.exemplo.json";

describe("indices.exemplo.json", () => {
  it("segue docs/indices.schema.json", () => {
    const ajv = new Ajv2020({ allErrors: true });
    addFormats(ajv);
    const valido = ajv.validate(schema, indices);
    expect(ajv.errors ?? []).toEqual([]);
    expect(valido).toBe(true);
  });
});

// Arquivos servidos em produção (frontend/public/data): cada um passa pelo leitor do contrato.
// indices.json chega por commit automático do backend: sem leitor aqui, a primeira publicação quebraria o CI do Pages.
const LEITORES: Record<string, (json: unknown) => Resultado<unknown>> = {
  "contatos.json": lerContatos,
  "estacoes.json": lerEstacoes,
  "historico.json": lerHistorico,
  "historico_reconstruido.json": lerHistorico,
  "indices.json": lerIndices,
  "ocorrencias.json": lerOcorrencias,
};
const PUBLICADOS = import.meta.glob<unknown>("../../public/data/*.json", { eager: true, import: "default" });

describe("public/data/*.json", () => {
  const arquivos = Object.entries(PUBLICADOS).map(([caminho, json]) => [caminho.split("/").pop() ?? caminho, json] as const);

  it("há arquivos publicados e todos têm leitor", () => {
    expect(arquivos.length).toBeGreaterThan(0);
    expect(arquivos.map(([nome]) => nome).filter((nome) => !(nome in LEITORES))).toEqual([]);
  });

  it.each(arquivos)("%s segue o contrato", (nome, json) => {
    expect(LEITORES[nome](json)).toEqual({ ok: true, dados: expect.anything() });
  });
});

// O npm run dev lê os exemplos (PUBLIC_DADOS_URL=exemplos/): o histórico de exemplo mostra a troca de limiar na tela Dados.
const EXEMPLOS = import.meta.glob<unknown>("./historico.exemplo.json", { eager: true, import: "default" });

describe("historico.exemplo.json", () => {
  it("segue o contrato e traz a troca de limiar nos municípios do exemplo", () => {
    const json = EXEMPLOS["./historico.exemplo.json"];
    const r = lerHistorico(json);
    expect(r).toEqual({ ok: true, dados: expect.anything() });
    if (!r.ok) return;
    const ibges = indices.municipios.map((m) => m.ibge);
    expect(Object.keys(r.dados.municipios).sort()).toEqual([...ibges].sort());
    for (const ibge of ibges) expect(r.dados.municipios[ibge].limiar_anterior).toEqual({ limiar_mm: 150, ate: "2026-09-24" });
  });
});
