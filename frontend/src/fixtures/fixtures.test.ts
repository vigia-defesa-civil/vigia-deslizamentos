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

// RN09: os 27 municípios têm cartão, todos com a fonte oficial (site da prefeitura ou da Defesa Civil municipal)
// e a data da consulta. "verificado" (confirmado pela equipe) fica só em Ibirama e Presidente Getúlio: é o que
// libera o botão de WhatsApp.
const CONTATOS = import.meta.glob<unknown>("../../public/data/contatos.json", { eager: true, import: "default" });
const CONFIG = import.meta.glob<{ ibge: string }[]>("../../../backend/config/municipios.json", { eager: true, import: "default" });

describe("public/data/contatos.json", () => {
  const contatos = Object.values(CONTATOS)[0] as { ibge: string; verificado: boolean; fonte?: string | null; consultado_em?: string | null }[];
  const config = Object.values(CONFIG)[0];

  it("tem um cartão para cada um dos 27 municípios", () => {
    expect(contatos.map((c) => c.ibge).sort()).toEqual(config.map((m) => m.ibge).sort());
  });

  it("verificado só em Ibirama e Presidente Getúlio", () => {
    expect(contatos.filter((c) => c.verificado).map((c) => c.ibge).sort()).toEqual(["4206900", "4214003"]);
  });

  it("todos têm fonte oficial (https, sc.gov.br ou atende.net) e data da consulta", () => {
    const ruins = contatos
      .filter((c) => !/^https:\/\/[\w.-]+\.(sc\.gov\.br|atende\.net)\//.test(c.fonte ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(c.consultado_em ?? ""));
    expect(ruins.map((c) => c.ibge)).toEqual([]);
  });

  it("todos passam pelo leitor do site", () => {
    const r = lerContatos(contatos);
    expect(r.ok && r.dados.length).toBe(27);
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
