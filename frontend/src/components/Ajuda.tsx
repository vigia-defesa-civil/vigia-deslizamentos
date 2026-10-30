import "../styles/ajuda.css";
import { CirclePlay } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tradutor, type T } from "../i18n";
import { mostrarVideo, paragrafos, SECOES_AJUDA, urlDoVideo } from "../lib/ajuda";
import { videoAjuda } from "../lib/config";
import type { Idioma } from "../lib/preferencias";
import { rota } from "../lib/telas";

const URL_README = "https://github.com/vigia-defesa-civil/vigia-deslizamentos#readme";

// Transcrição do vídeo por idioma (texto simples, um parágrafo por bloco). Vazia: o vídeo não entra (WCAG 1.2.1).
const TRANSCRICOES = import.meta.glob<string>("../conteudo/ajuda/transcricao.*.md", { query: "?raw", import: "default", eager: true });
const transcricao = (lang: Idioma) => TRANSCRICOES[`../conteudo/ajuda/transcricao.${lang}.md`] ?? "";

/** Página de Ajuda: vídeo tutorial (só com ID e transcrição) e dicas de uso de cada tela. */
export default function Ajuda({ lang, videoId = videoAjuda() }: { lang: Idioma; videoId?: string }) {
  const t = tradutor(lang);
  const texto = transcricao(lang);
  return (
    <div className="ajuda">
      <header className="aj-top">
        <span className="lbl">{t("Ajuda")}</span>
        <h1>{t("Como usar o VIGIA")}</h1>
        <p>{t("O VIGIA é um sistema acadêmico de apoio à decisão. Não emite alerta oficial e não substitui o Cemaden nem a Defesa Civil.")}</p>
      </header>
      {mostrarVideo(videoId, texto) && <Video t={t} lang={lang} id={videoId} transcricao={texto} />}
      <section className="aj-dicas" aria-labelledby="aj-dicas-t">
        <h2 id="aj-dicas-t" className="sr-only">
          {t("Dicas de uso")}
        </h2>
        {SECOES_AJUDA.map((s) => {
          const id = `aj-${s.rota ?? "telegram"}`;
          return (
            <article key={id} className="aj-sec" aria-labelledby={`${id}-t`}>
              <h3 id={`${id}-t`}>{t(s.titulo)}</h3>
              <ul>
                {s.dicas.map((d) => (
                  <li key={d}>{t(d)}</li>
                ))}
              </ul>
              {s.rota !== null && (
                <a className="aj-ir" href={rota(s.rota, lang)}>
                  {t("Ir para {M}", { M: t(s.titulo) })}
                </a>
              )}
            </article>
          );
        })}
      </section>
      <section className="aj-fim" aria-labelledby="aj-fim-t">
        <h2 id="aj-fim-t">{t("Ainda com dúvida?")}</h2>
        <p>{t("A metodologia, as fontes e as limitações do VIGIA estão descritas na documentação do projeto.")}</p>
        <p className="aj-links">
          <a href={URL_README} target="_blank" rel="noopener noreferrer">
            {t("Documentação do projeto no GitHub")}
            <span className="sr-only"> {t("(abre em nova aba)")}</span>
          </a>
          <a href={rota("contatos", lang)}>{t("Ir para {M}", { M: t("Contatos") })}</a>
        </p>
      </section>
    </div>
  );
}

/** Capa local com botão; o player do YouTube (sem cookies) só carrega depois do clique (RNF05). */
function Video({ t, lang, id, transcricao }: { t: T; lang: Idioma; id: string; transcricao: string }) {
  const [tocando, setTocando] = useState(false);
  const quadro = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    if (tocando) quadro.current?.focus();
  }, [tocando]);
  return (
    <section className="aj-video" aria-labelledby="aj-video-t">
      <h2 id="aj-video-t">{t("Tutorial em vídeo")}</h2>
      <div className="aj-quadro">
        {tocando ? (
          <iframe
            ref={quadro}
            src={urlDoVideo(id, lang)}
            title={t("Tutorial do VIGIA")}
            allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button type="button" className="aj-capa" onClick={() => setTocando(true)}>
            <CirclePlay aria-hidden="true" />
            <b>{t("Assistir ao tutorial")}</b>
            <small>{t("Abre um vídeo do YouTube, com legendas. Nada do YouTube carrega antes de você tocar.")}</small>
          </button>
        )}
      </div>
      <details className="aj-transcricao" open>
        <summary>{t("Transcrição do vídeo")}</summary>
        {paragrafos(transcricao).map((p) => (
          <p key={p}>{p}</p>
        ))}
      </details>
    </section>
  );
}
