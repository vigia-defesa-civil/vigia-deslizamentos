import { describe, expect, it } from "vitest";
import { tradutor } from "../i18n";
import { estadoDoPainel, rotuloSetoresMunicipio, textoMapeamentos } from "./areas";

describe("textoMapeamentos", () => {
  it("um ano só quando os dois são iguais; intervalo nos demais, em PT, ES e EN", () => {
    expect(textoMapeamentos(tradutor("pt"), 2018, 2018)).toBe("Mapeamento de 2018");
    expect(textoMapeamentos(tradutor("pt"), 2011, 2024)).toBe("Mapeamentos de 2011 a 2024");
    expect(textoMapeamentos(tradutor("es"), 2018, 2018)).toBe("Mapeo de 2018");
    expect(textoMapeamentos(tradutor("en"), 2018, 2018)).toBe("Mapped in 2018");
  });
});

describe("estadoDoPainel", () => {
  const ok = { ok: true as const, dados: { setores: [], fonte: "", geradoEm: "" } };
  it("erro de carga nunca vira 'sem setores'", () => {
    expect(estadoDoPainel({ ok: false, erro: "x" }, null, null)).toBe("erro");
    expect(estadoDoPainel({ ok: false, erro: "x" }, "4206900", null)).toBe("erro");
  });
  it("carregando, região, município, setor", () => {
    expect(estadoDoPainel(undefined, null, null)).toBe("carregando");
    expect(estadoDoPainel(ok, null, null)).toBe("regiao");
    expect(estadoDoPainel(ok, "4206900", null)).toBe("municipio");
    expect(estadoDoPainel(ok, "4206900", "S1")).toBe("setor");
  });
});

describe("rotuloSetoresMunicipio", () => {
  const pt = tradutor("pt");
  it("zero, singular e plural", () => {
    expect(rotuloSetoresMunicipio(pt, "Ibirama", 0)).toBe("Ibirama: nenhum setor de deslizamento mapeado pelo SGB");
    expect(rotuloSetoresMunicipio(pt, "Ibirama", 1)).toBe("Ibirama: 1 setor de risco geológico");
    expect(rotuloSetoresMunicipio(pt, "Ibirama", 12)).toBe("Ibirama: 12 setores de risco geológico");
  });
  it("traduz em ES e EN", () => {
    expect(rotuloSetoresMunicipio(tradutor("en"), "Ibirama", 2)).toBe("Ibirama: 2 geological risk sectors");
    expect(rotuloSetoresMunicipio(tradutor("es"), "Ibirama", 1)).toBe("Ibirama: 1 sector de riesgo geológico");
  });
});
