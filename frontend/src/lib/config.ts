import type { Idioma } from "./preferencias";

/** URL de um arquivo publicado (indices.json, contatos.json…): base do Astro + PUBLIC_DADOS_URL (padrão `data/`). */
export function urlDados(
  arquivo: string,
  base: string = import.meta.env.BASE_URL,
  dados: string | undefined = import.meta.env.PUBLIC_DADOS_URL,
): string {
  const partes = [base, dados ?? "data/", arquivo].map((p) => p.replace(/^\/+|\/+$/g, "")).filter(Boolean);
  return "/" + partes.join("/");
}

/** Nome do bot do Telegram (PUBLIC_TELEGRAM_BOT); provisório: VigiaDeslizamentosBot. */
export const botTelegram = (nome: string | undefined = import.meta.env.PUBLIC_TELEGRAM_BOT): string =>
  nome || "VigiaDeslizamentosBot";

/** Link do bot; com `ibge`, o bot já sugere aquele município. */
export const linkTelegram = (bot: string, ibge?: string): string =>
  `https://t.me/${bot}${ibge ? `?start=${ibge}` : ""}`;

/**
 * IDs do vídeo tutorial da página de Ajuda, um por idioma (o trecho depois de "watch?v=" no YouTube). Para publicar
 * o vídeo de um idioma, preencha o ID dele aqui, e a capa public/ajuda/thumb_<idioma>.png.
 * Vazio, a Ajuda daquele idioma mostra "Vídeo tutorial em produção".
 */
export const VIDEOS_AJUDA: Record<Idioma, string> = {
  pt: "mNW0wHPR7Dk",
  es: "ZG9tgfJpNuA",
  en: "0gXHWRcEpro",
};

export const videoAjuda = (lang: Idioma, ids: Record<Idioma, string> = VIDEOS_AJUDA): string => (ids[lang] ?? "").trim();
