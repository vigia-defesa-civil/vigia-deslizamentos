import { defineConfig } from "astro/config";
import react from "@astrojs/react";

export default defineConfig({
  site: "https://vigia-defesa-civil.github.io",
  base: "/vigia-deslizamentos",
  integrations: [react()],
  // Telas antigas (Estações e Monitoramento SC): o destino leva o base (sem ele o Astro gera um link que dá 404 no GitHub Pages).
  redirects: {
    "/estacoes": "/vigia-deslizamentos/areas-de-risco/",
    "/es/estacoes": "/vigia-deslizamentos/es/areas-de-risco/",
    "/en/estacoes": "/vigia-deslizamentos/en/areas-de-risco/",
    "/monitoramento-sc": "/vigia-deslizamentos/contatos/#painel-sc",
    "/es/monitoramento-sc": "/vigia-deslizamentos/es/contatos/#painel-sc",
    "/en/monitoramento-sc": "/vigia-deslizamentos/en/contatos/#painel-sc",
  },
});
