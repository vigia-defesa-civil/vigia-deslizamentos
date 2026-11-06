import { describe, expect, it } from "vitest";
import EN from "../i18n/en.json";
import ES from "../i18n/es.json";
import { mostrarVideo, paragrafos, SECOES_AJUDA, urlDoVideo } from "./ajuda";
import { VIDEOS_AJUDA, videoAjuda } from "./config";
import { TELAS } from "./telas";

describe("página de Ajuda", () => {
  it("urlDoVideo usa o domínio sem cookies do YouTube, com legendas no idioma da página", () => {
    const url = new URL(urlDoVideo("abc_123-X", "es"));
    expect(url.origin).toBe("https://www.youtube-nocookie.com");
    expect(url.pathname).toBe("/embed/abc_123-X");
    expect(url.searchParams.get("cc_load_policy")).toBe("1");
    expect(url.searchParams.get("cc_lang_pref")).toBe("es");
    expect(url.searchParams.get("hl")).toBe("es");
    expect(url.searchParams.get("rel")).toBe("0");
    expect(url.searchParams.get("autoplay")).toBe("1"); // só depois do clique na capa
    expect(new URL(urlDoVideo("id", "pt")).searchParams.get("cc_lang_pref")).toBe("pt");
    // O ID vem da configuração: nada de caminho ou parâmetro injetado.
    expect(new URL(urlDoVideo("a/b?c", "en")).pathname).toBe("/embed/a%2Fb%3Fc");
  });

  it("mostrarVideo: só com ID; sem ID, o quadro fica em produção", () => {
    expect(mostrarVideo("")).toBe(false);
    expect(mostrarVideo("  ")).toBe(false);
    expect(mostrarVideo("mNW0wHPR7Dk")).toBe(true);
  });

  it("paragrafos ignora comentários e linhas vazias", () => {
    expect(paragrafos("<!-- nota -->\n\nPrimeiro\nainda o primeiro.\n\n\nSegundo.\n")).toEqual(["Primeiro ainda o primeiro.", "Segundo."]);
  });

  it("os IDs do vídeo ficam num lugar só (VIDEOS_AJUDA), um por idioma; os três idiomas têm vídeo", () => {
    expect(Object.keys(VIDEOS_AJUDA).sort()).toEqual(["en", "es", "pt"]);
    expect(VIDEOS_AJUDA.pt).toBe("mNW0wHPR7Dk");
    expect(videoAjuda("pt")).toBe("mNW0wHPR7Dk");
    expect(videoAjuda("es")).toBe("ZG9tgfJpNuA");
    expect(videoAjuda("en")).toBe("0gXHWRcEpro");
    expect(videoAjuda("es", { pt: "", es: " xyz ", en: "" })).toBe("xyz");
    expect(videoAjuda("en", { pt: "a", es: "b", en: "" })).toBe("");
  });

  it("há dicas para cada tela do menu, na ordem do menu, e para o Telegram", () => {
    expect(SECOES_AJUDA.filter((s) => s.rota !== null).map((s) => s.rota)).toEqual(TELAS.map((t) => t.rota));
    expect(SECOES_AJUDA.at(-1)?.rota).toBeNull();
    for (const s of SECOES_AJUDA) expect(s.dicas.length).toBeGreaterThanOrEqual(2);
  });

  it("títulos e dicas existem em es.json e en.json", () => {
    const frases = SECOES_AJUDA.flatMap((s) => [s.titulo, ...s.dicas]);
    expect(frases.filter((f) => !(f in ES))).toEqual([]);
    expect(frases.filter((f) => !(f in EN))).toEqual([]);
  });
});
