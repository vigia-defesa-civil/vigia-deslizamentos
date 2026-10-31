import { ChevronDown, ChevronsLeft, ChevronsRight, Pause, Play } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { tradutor } from "../i18n";
import { formatarData, hojeEmBrasilia } from "../lib/formato";
import { diasDesde, passoDia, rotuloDia } from "../lib/mapa";
import type { Idioma } from "../lib/preferencias";
import { anunciar } from "./anunciar";

const INTERVALO_MS = 1100;

interface Props {
  lang: Idioma;
  /** `dia_alvo` de D0 a D3. */
  dias: readonly string[];
  d: number;
  aoMudar: (d: number) => void;
}

/** Cartão "Previsões": o dia-alvo e os próximos dias, com voltar, reproduzir/pausar e avançar. */
export default function Previsoes({ lang, dias, d, aoMudar }: Props) {
  const t = tradutor(lang);
  const nome = useId();
  const lista = useId();
  const [tocando, setTocando] = useState(false);
  const [aberta, setAberta] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const [hoje] = useState(() => hojeEmBrasilia());

  // Só passos manuais são anunciados: na reprodução, o leitor de tela ouviria um dia a cada 1,1 s.
  function ir(novo: number) {
    aoMudar(novo);
    const data = formatarData(dias[novo]);
    const n = diasDesde(hoje, dias[novo]);
    if (n === 0) anunciar(t("Hoje, {N}", { N: data }));
    else if (n > 0) anunciar(t("Previsão para {N}", { N: data }));
    else anunciar(t("Dia {N}", { N: data }));
  }
  const passo = (p: number) => ir(passoDia(d, p, dias.length));
  const avancarCalado = () => aoMudar(passoDia(d, 1, dias.length));

  // Um passo por vez: o timer some ao pausar, ao mudar de dia e ao sair da tela.
  useEffect(() => {
    if (!tocando) return;
    const timer = setTimeout(avancarCalado, INTERVALO_MS);
    return () => clearTimeout(timer);
  }, [tocando, d]);

  function alternar() {
    if (!tocando) avancarCalado();
    setTocando(!tocando);
    anunciar(t(tocando ? "Previsões pausadas" : "Reproduzindo as previsões"));
  }

  // A lista começa recolhida num botão com a data (mapa.css), no desktop e no celular; escolher um dia fecha.
  function escolher(i: number) {
    ir(i);
    if (!aberta) return;
    setAberta(false);
    if (botao.current?.offsetParent) botao.current.focus();
  }

  useEffect(() => {
    if (!aberta) return;
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberta(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAberta(false);
      botao.current?.focus();
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberta]);

  return (
    <div ref={raiz} className={`float prevs${aberta ? " aberta" : ""}`} role="group" aria-label={t("Previsões")}>
      <button
        ref={botao}
        type="button"
        className="prevs-btn"
        aria-expanded={aberta}
        aria-controls={lista}
        onClick={() => setAberta(!aberta)}
      >
        <span className="sr-only">{t("Previsões")}: </span>
        {formatarData(dias[d], "dia")}
        <small>{t(rotuloDia(dias[d], hoje))}</small>
        <ChevronDown aria-hidden="true" />
      </button>
      <div id={lista} className="prevs-lista">
        <span className="lbl" aria-hidden="true">
          {t("Previsões")}
        </span>
        {dias.map((dia, i) => (
          <label key={dia} className={i === d ? "on" : undefined}>
            <input type="radio" name={nome} checked={i === d} onChange={() => escolher(i)} />
            {formatarData(dia)}
            <small>{t(rotuloDia(dia, hoje))}</small>
          </label>
        ))}
        <div className="ctl">
          <button type="button" aria-label={t("Dia anterior")} onClick={() => passo(-1)}>
            <ChevronsLeft aria-hidden="true" />
          </button>
          <button type="button" aria-label={t(tocando ? "Pausar" : "Reproduzir")} onClick={alternar}>
            {tocando ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </button>
          <button type="button" aria-label={t("Próximo dia")} onClick={() => passo(1)}>
            <ChevronsRight aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Faixa sobre o mapa em D1–D3 (RN06). */
export function FaixaPrevisao({ lang, dia, d }: { lang: Idioma; dia: string; d: number }) {
  if (d === 0) return null;
  return <div className="dayflag">{tradutor(lang)("Previsão · {N} — valores estimados", { N: formatarData(dia) })}</div>;
}
