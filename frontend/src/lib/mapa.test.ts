import { describe, expect, it } from "vitest";
import { tradutor } from "../i18n";
import exemplo from "../fixtures/indices.exemplo.json";
import geojsonBruto from "../data/municipios.geojson?raw";
import { FEICOES } from "./municipios";
import { resumo } from "./monitoramento";
import type { Indices } from "./tipos";
import { classesDoRotulo, destacar, ordemRotulo, rotulosVisiveis, limites, pontoInterno, municipiosMonitorados, valoresDoDia, mensagemSelecao, passoDia, posicoes, rotuloAria, rotuloDia, rotulosDeLonge, type FeicaoMunicipio } from "./mapa";

const pt = tradutor("pt");
const es = tradutor("es");

const feicao = (monitorado: boolean, coordinates: number[][][]): FeicaoMunicipio => ({
  type: "Feature",
  properties: { ibge: "1", nome: "X", monitorado },
  geometry: { type: "Polygon", coordinates },
});

describe("rotuloAria", () => {
  it("índice, classe e alerta a partir de 1,00", () => {
    expect(rotuloAria(pt, "Ibirama", { indice: 1.3448, classe: 4 })).toBe("Ibirama: índice 1,34, classe moderado, em alerta");
    expect(rotuloAria(pt, "Witmarsum", { indice: 0.9999, classe: 3 })).toBe("Witmarsum: índice 1,00, classe baixo");
    expect(rotuloAria(pt, "Ibirama", { indice: 1, classe: 4 })).toBe("Ibirama: índice 1,00, classe moderado, em alerta");
  });

  it("usa a classe publicada, sem recalcular pelo índice", () => {
    expect(rotuloAria(pt, "Ibirama", { indice: 1.3448, classe: 5 })).toBe("Ibirama: índice 1,34, classe alto, em alerta");
  });

  it("sem dados (null) e sem valor (estações: só o nome)", () => {
    expect(rotuloAria(pt, "Dona Emma", null)).toBe("Dona Emma: sem dados");
    expect(rotuloAria(pt, "Dona Emma", undefined)).toBe("Dona Emma");
  });

  it("em espanhol", () => {
    expect(rotuloAria(es, "Ibirama", { indice: 2.7, classe: 6 })).toBe("Ibirama: índice 2,70, clase muy alto, en alerta");
    expect(rotuloAria(es, "Dona Emma", null)).toBe("Dona Emma: sin datos");
  });
});

describe("mensagemSelecao", () => {
  it("anuncia índice, classe e alerta", () => {
    expect(mensagemSelecao(pt, "Ibirama", { indice: 1.34, classe: 4 })).toBe("Ibirama selecionado. Índice 1,34, classe moderado, em alerta.");
    expect(mensagemSelecao(es, "Witmarsum", { indice: 0.3, classe: 1 })).toBe("Witmarsum seleccionado. Índice 0,30, clase extremadamente bajo, sin alerta.");
    expect(mensagemSelecao(pt, "Dona Emma", null)).toBe("Dona Emma: sem dados");
  });
});

describe("posicoes e limites", () => {
  it("GeoJSON [lon, lat] vira [lat, lon] do Leaflet", () => {
    expect(posicoes(feicao(true, [[[-49.5, -27.1], [-49.4, -27.2]]]))).toEqual([[[-27.1, -49.5], [-27.2, -49.4]]]);
  });

  it("limites cobrem só os monitorados", () => {
    const fs = [feicao(true, [[[-49.5, -27.1], [-49.4, -27.3]]]), feicao(false, [[[-50, -26], [-48, -28]]])];
    expect(limites(fs)).toEqual([[-27.3, -49.5], [-27.1, -49.4]]);
  });

  it("limites incluem pontos extras (estações fora dos municípios)", () => {
    const fs = [feicao(true, [[[-49.5, -27.1], [-49.4, -27.3]]])];
    expect(limites(fs, [[-26.4, -50.4], [-27.0, -48.8]])).toEqual([[-27.3, -50.4], [-26.4, -48.8]]);
  });

  it("os 28 municípios monitorados do GeoJSON enquadram o Alto Vale", () => {
    const fs = FEICOES;
    expect(fs.filter((f) => f.properties.monitorado)).toHaveLength(28);
    const [[s, o], [n, l]] = limites(fs);
    expect(s).toBeCloseTo(-27.66, 1);
    expect(o).toBeCloseTo(-50.35, 1);
    expect(l).toBeCloseTo(-49.19, 1);
    expect(n).toBeLessThan(-26.4);
  });

  it("o GeoJSON não passa de 150 KB e só tem Polygon", () => {
    expect(geojsonBruto.length).toBeLessThan(150_000);
    expect(FEICOES.every((f) => (f as { geometry: { type: string } }).geometry.type === "Polygon")).toBe(true);
  });
});

describe("destacar", () => {
  it("acha o trecho sem acento e devolve o original", () => {
    expect(destacar("José Boiteux", "jose")).toEqual(["", "José", " Boiteux"]);
    expect(destacar("Presidente Getúlio", "GETU")).toEqual(["Presidente ", "Getú", "lio"]);
  });

  it("termo vazio ou ausente: sem destaque", () => {
    expect(destacar("Ibirama", "  ")).toBeNull();
    expect(destacar("Ibirama", "xyz")).toBeNull();
  });
});

describe("dias de previsão", () => {
  it("rótulo hoje, +1d…", () => {
    expect(rotuloDia("2026-10-16", "2026-10-16")).toBe("hoje");
    expect(rotuloDia("2026-10-17", "2026-10-16")).toBe("+1d");
    expect(rotuloDia("2026-10-19", "2026-10-16")).toBe("+3d");
    expect(rotuloDia("2026-10-15", "2026-10-16")).toBe("ontem");
    expect(rotuloDia("2026-10-14", "2026-10-16")).toBe("-2d");
    expect(rotuloDia("2026-11-01", "2026-10-31")).toBe("+1d"); // virada de mês
  });

  it("avança e volta em ciclo", () => {
    expect(passoDia(3, 1, 4)).toBe(0);
    expect(passoDia(0, -1, 4)).toBe(3);
    expect(passoDia(1, 1, 4)).toBe(2);
  });
});

describe("valoresDoDia", () => {
  it("índice de cada município no dia d; sem dados → null", () => {
    const indices = { ...(exemplo as Indices), municipios_sem_dados: ["4205100"] };
    const v = valoresDoDia(indices, 1);
    expect(v["4206900"]?.indice).toBeCloseTo(1.4687);
    expect(v["4205100"]).toBeNull();
    const dia = indices.municipios.find((m) => m.ibge === "4206900")?.dias.find((x) => x.d === 0);
    expect(valoresDoDia(indices, 0)["4206900"]).toEqual({ indice: dia?.indice, classe: dia?.classe });
  });

  it("monitorado fora do indices.json (ainda sem execução do pipeline) → null e entra na contagem", () => {
    const monitorados = municipiosMonitorados(FEICOES);
    const sem = monitorados.find((m) => !(exemplo as Indices).municipios.some((x) => x.ibge === m.ibge));
    expect(sem).toBeDefined();
    const v = valoresDoDia(exemplo as Indices, 0, monitorados);
    expect(v[sem!.ibge]).toBeNull();
    expect(Object.keys(v)).toHaveLength(28);
    expect(resumo(v).total).toBe(28);
    expect(valoresDoDia(exemplo as Indices, 0)[sem!.ibge]).toBeUndefined();
  });
});

describe("municipiosMonitorados", () => {
  it("só os monitorados, em ordem alfabética", () => {
    const fs = FEICOES;
    const lista = municipiosMonitorados(fs);
    expect(lista).toHaveLength(28);
    expect(lista[0]).toEqual({ ibge: "4200200", nome: "Agrolândia" });
    expect(lista.map((m) => m.nome)).toEqual([...lista.map((m) => m.nome)].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });
});

describe("classesDoRotulo", () => {
  it("selecionado e alerta (índice ≥ 1)", () => {
    expect(classesDoRotulo(true, { indice: 0.2, classe: 1 })).toEqual({ sel: true, alerta: false });
    expect(classesDoRotulo(false, { indice: 1.0, classe: 4 })).toEqual({ sel: false, alerta: true });
    expect(classesDoRotulo(false, null)).toEqual({ sel: false, alerta: false });
    expect(classesDoRotulo(false, undefined)).toEqual({ sel: false, alerta: false });
  });
});

describe("rotulosDeLonge", () => {
  it("longe até 1 passo acima do enquadramento inicial", () => {
    expect(rotulosDeLonge(9.5, 9.5)).toBe(true);
    expect(rotulosDeLonge(10.5, 9.5)).toBe(false);
    expect(rotulosDeLonge(9, 9.5)).toBe(true);
  });
});

describe("pontoInterno", () => {
  it("fica dentro de um polígono côncavo", () => {
    const u = [[[0, 0], [3, 0], [3, 3], [2, 3], [2, 1], [1, 1], [1, 3], [0, 3], [0, 0]]];
    const [lat, lon] = pontoInterno(feicao(true, u));
    // dentro de uma das pernas do "U": x em (0,1) ou (2,3), y em (1,3), ou na base (y em (0,1))
    expect((lon > 0 && lon < 1) || (lon > 2 && lon < 3) || (lat > 0 && lat < 1)).toBe(true);
  });
});

describe("rótulos sem sobreposição", () => {
  const caixa = (id: string, ordem: number, x: number, y: number, w = 80, h = 20) => ({ id, ordem, x, y, w, h });

  it("ordemRotulo: selecionado, depois classe mais alta, depois maior índice; sem dados por último", () => {
    const sel = ordemRotulo(true, { indice: 0.1, classe: 1 });
    const c6 = ordemRotulo(false, { indice: 2.7, classe: 6 });
    const c5alto = ordemRotulo(false, { indice: 2.5, classe: 5 });
    const c5baixo = ordemRotulo(false, { indice: 1.9, classe: 5 });
    const semDados = ordemRotulo(false, null);
    expect(sel).toBeGreaterThan(c6);
    expect(c6).toBeGreaterThan(c5alto);
    expect(c5alto).toBeGreaterThan(c5baixo);
    expect(c5baixo).toBeGreaterThan(semDados);
    expect(ordemRotulo(false, undefined)).toBeLessThan(semDados);
  });

  it("rotulosVisiveis esconde o de menor ordem quando dois se tocam", () => {
    const v = rotulosVisiveis([caixa("a", 1, 0, 0), caixa("b", 5, 40, 10), caixa("c", 3, 300, 0)]);
    expect([...v].sort()).toEqual(["b", "c"]);
  });

  it("rotulosVisiveis mantém a margem entre rótulos e ignora caixas vazias (rótulo escondido pelo CSS)", () => {
    expect(rotulosVisiveis([caixa("a", 2, 0, 0), caixa("b", 1, 82, 0)], 4).has("b")).toBe(false);
    expect(rotulosVisiveis([caixa("a", 2, 0, 0), caixa("b", 1, 90, 0)], 4).has("b")).toBe(true);
    expect(rotulosVisiveis([caixa("a", 2, 0, 0, 0, 0), caixa("b", 1, 0, 0)]).has("b")).toBe(true);
  });

  it("rotulosVisiveis com os 28: nenhum par visível se sobrepõe e o de maior ordem sempre fica", () => {
    const caixas = Array.from({ length: 28 }, (_, i) => caixa(`m${i}`, i, (i % 6) * 50, Math.floor(i / 6) * 15));
    const v = rotulosVisiveis(caixas);
    expect(v.has("m27")).toBe(true);
    const vis = caixas.filter((c) => v.has(c.id));
    for (const a of vis)
      for (const b of vis) if (a !== b) expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true);
  });
});
