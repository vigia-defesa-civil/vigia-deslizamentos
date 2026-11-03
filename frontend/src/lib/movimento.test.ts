import { describe, expect, it } from "vitest";
import { semMovimento } from "./movimento";

const mm = (reduzir: boolean) => (q: string) => ({ matches: reduzir && q === "(prefers-reduced-motion: reduce)" }) as MediaQueryList;

describe("semMovimento", () => {
  it("segue prefers-reduced-motion", () => {
    expect(semMovimento(mm(true))).toBe(true);
    expect(semMovimento(mm(false))).toBe(false);
  });

  it("sem matchMedia (build, testes), anima normalmente", () => {
    expect(semMovimento(undefined)).toBe(false);
  });
});
