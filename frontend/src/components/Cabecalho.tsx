import { ChevronDown, CircleHelp, Globe, PersonStanding, TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { atributoLang, tradutor } from "../i18n";
import { carregar, desatualizado, lerIndices, type Resultado } from "../lib/dados";
import { formatarData, formatarDataHora } from "../lib/formato";
import { lerPreferencias, salvarPreferencias, type Idioma } from "../lib/preferencias";
import { AJUDA, mostraIndice, rota, rotaComEstado } from "../lib/telas";
import type { Indices } from "../lib/tipos";
import JanelaTelegram, { DiscoTelegram } from "./JanelaTelegram";
import PainelAcessibilidade from "./PainelAcessibilidade";

interface Props {
  lang: Idioma;
  /** Rota da tela atual, para o seletor PT | ES. */
  tela: string;
}

const IDIOMAS: [Idioma, string, string][] = [
  ["pt", "PT", "Português"],
  ["es", "ES", "Español"],
  ["en", "EN", "English"],
];

const REAVALIAR_MS = 60_000;

/**
 * Idioma num botão compacto ("PT ▾") que abre a lista PT/ES/EN (RF13). Links, não <select>: trocar de idioma
 * navega, e num <select> só de passar pelas opções com a seta a página já mudaria. Esc, clique fora ou sair com
 * Tab fecham; Esc devolve o foco ao botão.
 */
function SeletorIdioma({ lang, tela }: Props) {
  const t = tradutor(lang);
  const [aberto, setAberto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const lista = useId();
  const sigla = IDIOMAS.find(([valor]) => valor === lang)?.[1] ?? "PT";

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setAberto(false);
      botao.current?.focus();
    };
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  return (
    <div
      ref={raiz}
      className={`lang${aberto ? " aberto" : ""}`}
      onBlur={(e) => {
        if (!raiz.current?.contains(e.relatedTarget as Node | null)) setAberto(false);
      }}
    >
      <button
        ref={botao}
        type="button"
        className="langb"
        aria-expanded={aberto}
        aria-controls={lista}
        onClick={() => setAberto(!aberto)}
      >
        <Globe aria-hidden="true" />
        <span className="sr-only">{t("Idioma")}: </span>
        <span lang={atributoLang(lang)}>{sigla}</span>
        <ChevronDown className="seta" aria-hidden="true" />
      </button>
      <ul id={lista} className="lang-menu" hidden={!aberto}>
        {IDIOMAS.map(([valor, sigla, nome]) => (
          <li key={valor}>
            <a
              href={rota(tela, valor)}
              hrefLang={atributoLang(valor)}
              lang={atributoLang(valor)}
              aria-current={valor === lang ? "true" : undefined}
              onClick={(e) => {
                e.currentTarget.href = rotaComEstado(tela, valor, location);
                salvarPreferencias({ ...lerPreferencias(), lang: valor });
              }}
            >
              <b>{sigla}</b> {nome}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Marca, região, Telegram, idioma, acessibilidade, o carimbo dia-alvo (RN11) e o aviso de dados desatualizados (RNF04). */
export default function Cabecalho({ lang, tela }: Props) {
  const t = tradutor(lang);
  const [telegram, setTelegram] = useState(false);
  const [acessibilidade, setAcessibilidade] = useState(false);
  const [indices, setIndices] = useState<Resultado<Indices>>();
  const [agora, setAgora] = useState(() => new Date());

  useEffect(() => {
    carregar("indices.json", lerIndices).then(setIndices);
    // RNF04 com a aba aberta: reavalia o atraso a cada minuto.
    const timer = setInterval(() => setAgora(new Date()), REAVALIAR_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      <header className="hdr">
        <div className="brand">
          <div className="mark" aria-hidden="true">
            <i />
          </div>
          <div>
            <b>VIGIA</b>
            <small>{t("Deslizamentos")}</small>
          </div>
        </div>
        <div className="region">
          <span className="lbl">{t("Região")}</span>
          <strong>{t("Alto Vale do Itajaí, SC")}</strong>
        </div>
        <button
          type="button"
          className="hbtn tghdr"
          aria-label={t("Alertas no Telegram")}
          onClick={() => setTelegram(true)}
        >
          <DiscoTelegram />
          <span>{t("Alertas no Telegram")}</span>
        </button>
        <SeletorIdioma lang={lang} tela={tela} />
        <button
          type="button"
          className="hbtn a11yb"
          aria-label={t("Acessibilidade: tema e cores")}
          onClick={() => setAcessibilidade(true)}
        >
          <PersonStanding aria-hidden="true" />
        </button>
        {/* Só no celular (estrutura.css): no desktop a Ajuda está no rail. */}
        <a
          className="hbtn ajudab"
          href={rota(AJUDA.rota, lang)}
          aria-label={t(AJUDA.nome)}
          aria-current={tela === AJUDA.rota ? "page" : undefined}
        >
          <CircleHelp aria-hidden="true" />
        </a>
        <p className="status">
          {!indices && t("Carregando os dados…")}
          {indices?.ok && (
            <>
              <span className="dot" aria-hidden="true" />
              {t("dia-alvo {N}", { N: formatarData(indices.dados.dia_alvo_d0) })}
            </>
          )}
          {indices && !indices.ok && (
            <>
              <span className="dot erro" aria-hidden="true" />
              {t("Não foi possível carregar os dados.")}
            </>
          )}
        </p>
      </header>
      {indices?.ok && mostraIndice(tela) && desatualizado(indices.dados.gerado_em, agora) && (
        <div className="faixa-aviso" role="status">
          <TriangleAlert aria-hidden="true" />
          {t("Dados desatualizados: a última atualização foi em {N}. Os valores podem não refletir a situação atual.", {
            N: formatarDataHora(indices.dados.gerado_em),
          })}
        </div>
      )}
      {indices && !indices.ok && (
        <div className="faixa-aviso" role="alert">
          <TriangleAlert aria-hidden="true" />
          {t("Não foi possível carregar os dados.")}
        </div>
      )}
      <JanelaTelegram lang={lang} aberto={telegram} aoFechar={() => setTelegram(false)} />
      <PainelAcessibilidade lang={lang} tela={tela} aberto={acessibilidade} aoFechar={() => setAcessibilidade(false)} />
    </>
  );
}
