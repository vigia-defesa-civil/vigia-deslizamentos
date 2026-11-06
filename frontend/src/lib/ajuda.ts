// Página de Ajuda (docs/superpowers/specs/2026-10-29-pagina-ajuda-design.md): dicas por tela e o vídeo tutorial.
import type { Idioma } from "./preferencias";

export interface SecaoAjuda {
  /** Rota da tela (lib/telas) ou null para o Telegram. */
  rota: string | null;
  /** Frase em português, chave do dicionário. */
  titulo: string;
  dicas: string[];
}

/** Na ordem do menu, mais o bot. Textos condicionais e sem prometer alerta oficial (RN04). */
export const SECOES_AJUDA: readonly SecaoAjuda[] = [
  {
    rota: "",
    titulo: "Monitoramento",
    dicas: [
      "Cada município aparece com a cor, o ícone e o nome da classe de risco. O alerta começa no índice 1,00 (classe moderado).",
      "Toque ou clique num município para ver no painel o índice, a chuva efetiva antecedente e o limiar.",
      "Em Previsões, escolha hoje ou um dos próximos 3 dias. Os dias seguintes são valores estimados.",
      "Use a lupa para buscar um município pelo nome.",
      "Na legenda, a paleta Acessível troca as cores para quem tem daltonismo.",
    ],
  },
  {
    rota: "simulacao",
    titulo: "Simulação",
    dicas: [
      "Escolha o município, o período (24, 48 ou 72 h) e a chuva esperada em milímetros.",
      "Marque a chuva regional para aplicar a mesma chuva aos 28 municípios.",
      "O limite do campo é o maior acumulado de chuva já registrado no mundo naquele período: 1.825 mm em 24 h, 2.493 mm em 48 h e 3.930 mm em 72 h (Organização Meteorológica Mundial, tabela de recordes de 31/07/2025).",
      "Esse limite só evita valores absurdos. O cálculo usa a mesma equação do índice, sem teto.",
      "A simulação não muda os dados reais e não envia aviso.",
    ],
  },
  {
    rota: "dados",
    titulo: "Dados da análise",
    dicas: [
      "Veja a evolução do índice em 7 ou 30 dias, ou escolha um período de até 1 ano.",
      "Os dias antes de 15/10/2026 são uma estimativa reconstruída com chuva de reanálise, não o que o sistema publicou.",
      "A tabela mostra cada município, a variação em 24 h e os últimos 7 dias.",
    ],
  },
  {
    rota: "areas-de-risco",
    titulo: "Áreas de risco",
    dicas: [
      "Os setores de risco geológico alto e muito alto foram mapeados pelo Serviço Geológico do Brasil (SGB).",
      "O mapeamento é parcial: fora dos setores também pode haver risco.",
      "Ligue a camada de estações do INMET para ver onde a chuva é medida.",
    ],
  },
  {
    rota: "cartilha",
    titulo: "Cartilha",
    dicas: ["Aprenda os sinais de perigo e o que fazer antes, durante e depois de um deslizamento.", "Em perigo, saia do local e ligue 199."],
  },
  {
    rota: "contatos",
    titulo: "Contatos",
    dicas: [
      "Os números de emergência funcionam 24 horas, de qualquer lugar.",
      "Escolha o seu município para ver a Defesa Civil local.",
      "O painel oficial da Defesa Civil de SC abre em nova aba.",
    ],
  },
  {
    rota: null,
    titulo: "Alertas no Telegram",
    dicas: [
      "No bot, /start escolhe os municípios, /status mostra a situação e /parar cancela.",
      "O bot guarda só o identificador do chat e os municípios escolhidos, e apaga tudo com /parar.",
    ],
  },
];

/** Player do YouTube no domínio sem cookies, com legendas ligadas no idioma da página (RNF05, WCAG 1.2.2). */
export function urlDoVideo(id: string, lang: Idioma): string {
  const q = new URLSearchParams({ cc_load_policy: "1", cc_lang_pref: lang, hl: lang, rel: "0" });
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?${q}`;
}

/** Parágrafos da transcrição (texto simples, um parágrafo por bloco), sem os comentários HTML. */
export const paragrafos = (texto: string): string[] =>
  texto
    .replace(/<!--[\s\S]*?-->/g, "")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

/** O vídeo entra assim que o idioma tem ID; sem ele, o quadro mostra "Vídeo tutorial em produção". */
export const mostrarVideo = (id: string): boolean => id.trim() !== "";
