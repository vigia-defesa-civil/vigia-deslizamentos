/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Pasta (relativa à base do site) de onde o site lê os JSON publicados. Padrão: `data/`. */
  readonly PUBLIC_DADOS_URL?: string;
  /** Nome do bot do Telegram, sem @. Padrão: `VigiaDeslizamentosBot`. */
  readonly PUBLIC_TELEGRAM_BOT?: string;
  /** ID do vídeo tutorial da página de Ajuda (YouTube). Vazio: a Ajuda mostra só as dicas. */
}
