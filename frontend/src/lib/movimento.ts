// prefers-reduced-motion para o que o CSS não alcança (animações feitas em JavaScript, como o pan do Leaflet).

/** `true` quando o usuário pediu menos movimento. Sem `matchMedia` (build, testes), anima normalmente. */
export const semMovimento = (mm: ((q: string) => MediaQueryList) | undefined = globalThis.matchMedia?.bind(globalThis)): boolean =>
  mm?.("(prefers-reduced-motion: reduce)").matches ?? false;
