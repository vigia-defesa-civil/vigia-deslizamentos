import "../styles/contatos.css";
import { Bell, Copy, ExternalLink, Globe, Mail, MapPin, MessageCircle, Phone, Route, User } from "lucide-react";
import { useEffect, useState, type ChangeEvent } from "react";
import { tradutor } from "../i18n";
import { filtrarContatos, hrefSite, hrefTelefone, hrefWhatsApp, porNome, urlComoChegar } from "../lib/contatos";
import { formatarData } from "../lib/formato";
import { carregar, lerContatos, type Resultado } from "../lib/dados";
import type { Idioma } from "../lib/preferencias";
import type { Contato } from "../lib/tipos";
import { anunciar } from "./anunciar";
import BannerTelegram from "./BannerTelegram";
import { copiarTexto } from "./copiar";
import EstadoCarregamento from "./EstadoCarregamento";

interface Props {
  lang: Idioma;
  municipios: readonly { ibge: string; nome: string }[];
}

const EMERGENCIAS = [
  { numero: "199", href: "tel:199", rotulo: "Defesa Civil", Icone: Phone },
  { numero: "193", href: "tel:193", rotulo: "Bombeiros", Icone: Phone },
  { numero: "192", href: "tel:192", rotulo: "SAMU", Icone: Phone },
  { numero: "40199", href: "sms:40199", rotulo: "SMS com seu CEP para receber alertas", Icone: Bell },
] as const;

const URL_PAINEL_SC = "https://monitoramento.defesacivil.sc.gov.br/mapa";

const semMovimento = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Contatos (RF12): números de emergência e o contato de cada município, verificado ou do site oficial com a fonte (RN09). */
export default function Contatos({ lang, municipios }: Props) {
  const t = tradutor(lang);
  const [carga, setCarga] = useState<Resultado<Contato[]>>();
  const [escolhido, setEscolhido] = useState("");
  const [copiado, setCopiado] = useState<string>();

  useEffect(() => {
    carregar("contatos.json", lerContatos).then(setCarga);
  }, []);

  // Depois de renderizar: o aviso só existe no DOM depois da escolha.
  useEffect(() => {
    if (!escolhido) return;
    const alvo = document.getElementById("aviso-municipio") ?? document.getElementById(`cc-${escolhido}`);
    alvo?.scrollIntoView({ block: "nearest", behavior: semMovimento() ? "auto" : "smooth" });
  }, [escolhido]);

  // Sem a lista carregada não se sabe se o município tem contato: nada de aviso "sem contato verificado".
  const contatos = carga?.ok ? porNome(carga.dados) : [];
  const filtrar = (ibge: string, nome: string) => (carga?.ok ? filtrarContatos(t, contatos, ibge, nome) : filtrarContatos(t, [], "", ""));
  const filtro = filtrar(escolhido, municipios.find((m) => m.ibge === escolhido)?.nome ?? "");

  const escolher = (e: ChangeEvent<HTMLSelectElement>) => {
    const ibge = e.target.value;
    setEscolhido(ibge);
    if (!ibge) return;
    const nome = municipios.find((m) => m.ibge === ibge)?.nome;
    if (!nome) return;
    const aviso = filtrar(ibge, nome).aviso;
    anunciar(aviso ?? t("Mostrando {M}", { M: nome }));
  };

  const copiar = async (c: Contato) => {
    if (!(await copiarTexto(c.telefone!))) return;
    setCopiado(c.ibge);
    anunciar(t("Telefone copiado"));
  };

  return (
    <div className="cont">
      <div className="ctop">
        <div className="lbl">{t("Contatos")}</div>
        <h1>{t("Defesa Civil e emergência")}</h1>
        <p>{t("Em perigo, ligue {N} de qualquer lugar. Os números funcionam {N} horas.", { N: ["199", "24"] })}</p>
      </div>

      <ul className="emerg" aria-label={t("Números de emergência")}>
        {EMERGENCIAS.map(({ numero, href, rotulo, Icone }) => (
          <li key={numero} className="em">
            <Icone aria-hidden="true" />
            <div>
              <b>{numero}</b>
              <a href={href} aria-label={`${numero} — ${t(rotulo)}`}>
                {t(rotulo)}
              </a>
            </div>
          </li>
        ))}
      </ul>

      {/* Painel da Defesa Civil de SC só como link: o site não permite incorporação e o VIGIA não tem autorização (RN10). */}
      <section id="painel-sc" className="cc painel-sc" aria-labelledby="painel-sc-t">
        <h2 id="painel-sc-t">{t("Painel oficial da Defesa Civil de SC")}</h2>
        <p>
          {t(
            "Estações, chuva acumulada e níveis de rios em tempo real, publicados pela Secretaria de Estado da Proteção e Defesa Civil de Santa Catarina. É um site do governo estadual, sem vínculo com o VIGIA.",
          )}
        </p>
        <a
          className="btn"
          href={URL_PAINEL_SC}
          target="_blank"
          rel="noopener"
          aria-label={t("Abrir o painel oficial da Defesa Civil de SC (abre em nova aba)")}
        >
          <ExternalLink aria-hidden="true" />
          {t("Abrir o painel oficial")}
        </a>
      </section>

      <BannerTelegram lang={lang} />

      <div className="filtro">
        <label className="lbl" htmlFor="filtro-municipio">
          {t("Seu município")}
        </label>
        <select id="filtro-municipio" value={escolhido} onChange={escolher}>
          <option value="">{t("Todos")}</option>
          {municipios.map((m) => (
            <option key={m.ibge} value={m.ibge}>
              {m.nome}
            </option>
          ))}
        </select>
      </div>

      {filtro.aviso && (
        <p id="aviso-municipio" className="aviso-mun">
          <Phone aria-hidden="true" />
          {filtro.aviso}
        </p>
      )}

      {!carga?.ok && <EstadoCarregamento t={t} falhou={!!carga} />}

      <div className="cgrid">
        {contatos.map((c) => {
          // WhatsApp só em número verificado com a prefeitura: nos demais não se sabe se o celular tem WhatsApp.
          const whatsapp = c.verificado && c.telefone ? hrefWhatsApp(c.telefone) : null;
          return (
            <article key={c.ibge} id={`cc-${c.ibge}`} className={filtro.esmaecidos.includes(c.ibge) ? "cc dim" : "cc"} aria-labelledby={`cc-t-${c.ibge}`}>
              <h2 id={`cc-t-${c.ibge}`}>
                {c.nome}
              </h2>
              <dl>
                {/* Sem nome confirmado, a linha inteira sai: nada de "a confirmar" no ar. */}
                {c.responsavel && (
                  <>
                    <dt>
                      <User aria-hidden="true" />
                      <span className="sr-only">{t("Responsável")}</span>
                    </dt>
                    <dd>
                      {c.responsavel}
                      <small>{t(c.cargo === "diretor" ? "Diretor(a) de Defesa Civil" : "Coordenador(a) de Defesa Civil")}</small>
                    </dd>
                  </>
                )}
                {c.telefone && (
                  <>
                    <dt>
                      <Phone aria-hidden="true" />
                      <span className="sr-only">{t("Telefone")}</span>
                    </dt>
                    <dd>
                      <a className="ph" href={hrefTelefone(c.telefone)}>
                        {c.telefone}
                      </a>
                      <small>{t(c.telefone_de === "prefeitura" ? "Telefone geral da prefeitura" : "Defesa Civil municipal")}</small>
                    </dd>
                  </>
                )}
                {c.email && (
                  <>
                    <dt>
                      <Mail aria-hidden="true" />
                      <span className="sr-only">{t("E-mail")}</span>
                    </dt>
                    <dd>
                      <a href={`mailto:${c.email}`}>{c.email}</a>
                    </dd>
                  </>
                )}
                {c.endereco && (
                  <>
                    <dt>
                      <MapPin aria-hidden="true" />
                      <span className="sr-only">{t("Endereço")}</span>
                    </dt>
                    <dd>{c.endereco}</dd>
                  </>
                )}
                {c.site && (
                  <>
                    <dt>
                      <Globe aria-hidden="true" />
                      <span className="sr-only">{t("Site da prefeitura")}</span>
                    </dt>
                    <dd>
                      <a href={hrefSite(c.site)} target="_blank" rel="noopener">
                        {c.site}
                        <span className="sr-only"> {t("(abre em nova aba)")}</span>
                      </a>
                    </dd>
                  </>
                )}
              </dl>
              <div className="acts">
                <a
                  className="btn pri"
                  href={urlComoChegar(c)}
                  target="_blank"
                  rel="noopener"
                  aria-label={
                    c.verificado
                      ? t("Como chegar à Defesa Civil de {M} no Google Maps (abre em nova aba)", { M: c.nome })
                      : t("Como chegar ao endereço de {M} no Google Maps (abre em nova aba)", { M: c.nome })
                  }
                >
                  <Route aria-hidden="true" />
                  {t("Como chegar")}
                </a>
                {whatsapp ? (
                  <a
                    className="btn"
                    href={whatsapp}
                    target="_blank"
                    rel="noopener"
                    aria-label={t("Abrir WhatsApp da Defesa Civil de {M} (abre em nova aba)", { M: c.nome })}
                  >
                    <MessageCircle aria-hidden="true" />
                    {t("Abrir WhatsApp")}
                  </a>
                ) : c.telefone ? (
                  <button
                    type="button"
                    className="btn"
                    aria-label={c.verificado ? t("Copiar telefone da Defesa Civil de {M}", { M: c.nome }) : t("Copiar telefone de {M}", { M: c.nome })}
                    onClick={() => copiar(c)}
                  >
                    <Copy aria-hidden="true" />
                    {copiado === c.ibge ? t("Copiado") : t("Copiar telefone")}
                  </button>
                ) : (
                  c.site && (
                    <a className="btn" href={hrefSite(c.site)} target="_blank" rel="noopener" aria-label={t("Site da prefeitura de {M} (abre em nova aba)", { M: c.nome })}>
                      <ExternalLink aria-hidden="true" />
                      {t("Site da prefeitura")}
                    </a>
                  )
                )}
              </div>
              {c.fonte && c.consultado_em && (
                <p className="cfonte">
                  {t("Fonte:")}{" "}
                  <a href={c.fonte} target="_blank" rel="noopener">
                    {t("site oficial")}
                    <span className="sr-only"> {t("(abre em nova aba)")}</span>
                  </a>{" "}
                  · {t("consultado em {N}", { N: formatarData(c.consultado_em) })}
                </p>
              )}
            </article>
          );
        })}
      </div>

      <p className="cnote">
        {t('"Como chegar" abre o Google Maps.')}{" "}
        {t("Os contatos vêm do site oficial da prefeitura ou da Defesa Civil municipal, na data indicada em cada cartão. Confira antes de ir.")}
      </p>
    </div>
  );
}
