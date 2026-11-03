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
 * ID do vídeo tutorial da página de Ajuda (o trecho depois de "watch?v=" no YouTube). Preencha aqui quando o vídeo
 * for publicado, junto com a transcrição em src/conteudo/ajuda/transcricao.{pt,es,en}.md. Vazio, a Ajuda mostra
 * a capa com "Vídeo tutorial em produção". PUBLIC_AJUDA_VIDEO_ID, se definida no build, vale por cima.
 */
export const VIDEO_AJUDA_ID = "";

export const videoAjuda = (id: string | undefined = import.meta.env.PUBLIC_AJUDA_VIDEO_ID): string => (id || VIDEO_AJUDA_ID).trim();
