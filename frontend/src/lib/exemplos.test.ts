import { describe, expect, it } from "vitest";
import { deslocarDatas, exemploParaHoje } from "./exemplos";

describe("dados de exemplo com datas de hoje (npm run dev)", () => {
  it("deslocarDatas move datas e o dia de data-hora, em qualquer profundidade, e mantém o resto", () => {
    const json = { d: "2026-09-29", g: "2026-09-29T06:12:00-03:00", l: [{ ate: "2026-09-30" }], n: 3, t: "Taió 2026", f: null };
    expect(deslocarDatas(json, 31)).toEqual({ d: "2026-10-30", g: "2026-10-30T06:12:00-03:00", l: [{ ate: "2026-10-31" }], n: 3, t: "Taió 2026", f: null });
    expect(deslocarDatas("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("exemploParaHoje põe o D0 em hoje (Brasília) e a geração 1 h antes de agora", () => {
    const agora = new Date("2026-10-30T15:00:00Z"); // 12:00 em Brasília
    const indices = { gerado_em: "2026-09-29T06:12:00-03:00", dia_alvo_d0: "2026-09-29", municipios: [{ dias: [{ dia_alvo: "2026-09-30" }] }] };
    const r = exemploParaHoje(indices, "2026-09-29", agora) as typeof indices;
    expect(r.dia_alvo_d0).toBe("2026-10-30");
    expect(r.municipios[0].dias[0].dia_alvo).toBe("2026-10-31");
    expect(r.gerado_em).toBe("2026-10-30T14:00:00.000Z");
    // Arquivos sem gerado_em (histórico, ocorrências) só deslocam.
    expect(exemploParaHoje({ inicio: "2026-09-01" }, "2026-09-29", agora)).toEqual({ inicio: "2026-10-02" });
  });
});
