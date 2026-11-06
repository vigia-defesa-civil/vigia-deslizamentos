import "../styles/ajuda.css";
import { CirclePlay } from "lucide-react";
import { tradutor, type T } from "../i18n";
import { mostrarVideo, paragrafos, SECOES_AJUDA, urlDoVideo } from "../lib/ajuda";
import { videoAjuda } from "../lib/config";
import type { Idioma } from "../lib/preferencias";
import { rota } from "../lib/telas";

const URL_README = "https://github.com/vigia-defesa-civil/vigia-deslizamentos#readme";
const CAPA = `${import.meta.env.BASE_URL.replace(/\/?$/, "/")}ajuda/capa-mapa.jpg`;

// Transcrição do vídeo por idioma (texto simples, um parágrafo por bloco). Vazia: o vídeo não entra (WCAG 1.2.1).
const TRANSCRICOES = import.meta.glob<string>("../conteudo/ajuda/transcricao.*.md", { query: "?raw", import: "default", eager: true });
const transcricao = (lang: Idioma) => TRANSCRICOES[`../conteudo/ajuda/transcricao.${lang}.md`] ?? "";

/** Página de Ajuda: o quadro do vídeo tutorial no topo e as dicas de uso de cada tela. */
export default function Ajuda({ lang, videoId = videoAjuda(lang) }: { lang: Idioma; videoId?: string }) {
  const t = tradutor(lang);
  const texto = transcricao(lang);
  return (
    <div className="ajuda">
      <header className="aj-top">
        <span className="lbl">{t("Ajuda")}</span>
        <h1>{t("Como usar o VIGIA")}</h1>
        <p>{t("O VIGIA é um sistema acadêmico de apoio à decisão. Não emite alerta oficial e não substitui o Cemaden nem a Defesa Civil.")}</p>
      </header>
      <Video t={t} lang={lang} id={videoId} transcricao={texto} />
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

/**
 * Quadro 16:9. Com o ID do idioma: o player do YouTube (youtube-nocookie.com), carregado só quando chega perto da
 * tela (loading="lazy"). Sem ID: a capa com "Vídeo tutorial em produção", sem nada para clicar.
 */
function Video({ t, lang, id, transcricao }: { t: T; lang: Idioma; id: string; transcricao: string }) {
  const textos = paragrafos(transcricao);
  return (
    <section className="aj-video" aria-labelledby="aj-video-t">
      <h2 id="aj-video-t">{t("Tutorial em vídeo")}</h2>
      <div className="aj-quadro">
        {mostrarVideo(id) ? (
          <iframe
            src={urlDoVideo(id, lang)}
            title={t("Vídeo tutorial do VIGIA: como usar o mapa de risco de deslizamentos")}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <>
            <img className="aj-capa-img" src={CAPA} alt="" width={1205} height={677} loading="eager" decoding="async" />
            <div className="aj-capa aj-producao">
              <CirclePlay aria-hidden="true" />
              <span className="aj-painel">
                <b>{t("Vídeo tutorial em produção")}</b>
                <small>{t("Enquanto isso, as dicas abaixo mostram como usar cada tela.")}</small>
              </span>
            </div>
          </>
        )}
      </div>
      {mostrarVideo(id) && textos.length > 0 && (
        <>
          <p className="aj-legendas">
            <a href="#aj-transcricao">{t("Legendas e transcrição")}</a>
          </p>
          <details id="aj-transcricao" className="aj-transcricao" open>
            <summary>{t("Transcrição do vídeo")}</summary>
            {textos.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </details>
        </>
      )}
    </section>
  );
}
