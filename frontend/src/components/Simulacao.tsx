import "../styles/simulacao.css";
import { ArrowRight, CloudRain, Info, RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { tradutor, type T } from "../i18n";
import { CLASSE_CRITICA, infoClasse, LIMIAR_ALERTA } from "../lib/classes";
import { carregar, lerIndices, type Resultado } from "../lib/dados";
import { formatarData, formatarHora, formatarIndice, formatarMm } from "../lib/formato";
import { valoresDoDia } from "../lib/mapa";
import { resumo } from "../lib/monitoramento";
import type { Idioma } from "../lib/preferencias";
import {
  avisoRegional,
  avisoSimulacao,
  ATALHOS,
  ESCALA_MAX,
  faixasEscala,
  limiteChuva,
  limitarChuva,
  municipioDaBusca,
  PASSO_CHUVA_MM,
  posicaoEscala,
  simular,
  simularMunicipio,
  type Aviso,
  type Cenario,
  type Horas,
} from "../lib/simulacao";
import type { IndiceClasse, Indices } from "../lib/tipos";
import { anunciar } from "./anunciar";
import EstadoCarregamento from "./EstadoCarregamento";
import Legenda from "./Legenda";
import Mapa, { type MapaApi } from "./Mapa";
import SeloClasse from "./SeloClasse";

const PERIODOS: Horas[] = [24, 48, 72];
const MARCAS = [0, LIMIAR_ALERTA, infoClasse(CLASSE_CRITICA).min, ESCALA_MAX];
const CHUVA_INICIAL = 40;

type Ver = "agora" | "simulado";

export default function Simulacao({ lang }: { lang: Idioma }) {
  const t = tradutor(lang);
  const [carga, setCarga] = useState<Resultado<Indices>>();
  const [ibge, setIbge] = useState("");
  const [horas, setHoras] = useState<Horas>(48);
  const [chuva, setChuva] = useState(CHUVA_INICIAL);
  const [regional, setRegional] = useState(false);
  const [cenario, setCenario] = useState<Cenario | null>(null);
  const [ver, setVer] = useState<Ver>("agora");
  const mapa = useRef<MapaApi>(null);

  useEffect(() => {
    carregar("indices.json", lerIndices).then((r) => {
      setCarga(r);
      if (!r.ok) return;
      // UC03: a tela abre na condição atual; o resultado só aparece depois de "Simular".
      setIbge(municipioDaBusca(r.dados, location.search) ?? "");
    });
  }, []);

  const titulo = t("E se chover…?");
  if (!carga?.ok)
    return (
      <div className="sim-carga">
        <h1 className="simh">{titulo}</h1>
        <EstadoCarregamento t={t} falhou={!!carga} />
      </div>
    );

  const limite = limiteChuva(horas);
  const indices = carga.dados;
  const municipios = indices.municipios
    .filter((m) => !indices.municipios_sem_dados.includes(m.ibge))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const nomes = Object.fromEntries(indices.municipios.map((m) => [m.ibge, m.nome]));
  const atuais = valoresDoDia(indices, 0);
  const simulados = cenario && simular(indices.municipios, cenario);
  const valores = simulados && ver === "simulado" ? { ...atuais, ...simulados } : atuais;
  const { emAlerta, total } = resumo(valores);
  const quando = [formatarData(indices.dia_alvo_d0, "dia"), formatarHora(indices.gerado_em)];

  function resultado(c: Cenario) {
    const m = municipios.find((x) => x.ibge === c.ibge);
    const d0 = m?.dias.find((x) => x.d === 0);
    const s = m && simularMunicipio(m, c.chuva_mm, c.horas);
    if (!m || !d0 || !s) return null;
    const avisos = [avisoSimulacao(t, { nome: m.nome, atual: d0.indice, simulado: s.indice, chuva_mm: c.chuva_mm, horas: c.horas })];
    if (c.regional) avisos.push(avisoRegional(t, simular(indices.municipios, c), nomes));
    return { m, d0, s, avisos };
  }

  const r = cenario && resultado(cenario);

  function rodar() {
    const c = { ibge, chuva_mm: limitarChuva(chuva, horas), horas, regional };
    const novo = resultado(c);
    if (!novo) return;
    setCenario(c);
    setVer("simulado");
    mapa.current?.piscar(ibge);
    const { m, s, avisos } = novo;
    anunciar(
      [
        t("Resultado da simulação: {M}, índice {N}, classe {C}.", { M: m.nome, N: formatarIndice(s.indice), C: infoClasse(s.classe).nome }),
        ...avisos.flatMap((a) => [`${a.titulo}.`, a.texto]),
      ].join(" "),
    );
  }

  function voltar() {
    setCenario(null);
    setVer("agora");
    anunciar(t("Voltar à condição atual"));
  }

  function escolher(x: string) {
    if (municipios.some((m) => m.ibge === x)) mudar(() => setIbge(x));
  }

  // Um controle mudou depois de simular: o resultado não vale mais. Some, o mapa volta para "Agora" e o leitor de
  // tela avisa que é preciso simular de novo.
  function mudar(aplicar: () => void, aviso?: string) {
    aplicar();
    if (cenario) {
      setCenario(null);
      setVer("agora");
    }
    const falas = [aviso, cenario && t("Os valores mudaram. Simule de novo para ver o resultado.")].filter(Boolean);
    if (falas.length) anunciar(falas.join(" "));
  }

  // O limite da chuva é o recorde do período: ao trocar para um período menor, o valor que passar dele vai para o limite.
  function trocarPeriodo(h: Horas) {
    const ajusta = chuva > limiteChuva(h);
    mudar(
      () => {
        setHoras(h);
        if (ajusta) setChuva(limiteChuva(h));
      },
      ajusta ? t("A chuva foi ajustada para {N} mm, o limite de {N} h.", { N: [String(limiteChuva(h)), String(h)] }) : undefined,
    );
  }

  return (
    <div className="sim">
      <aside className="side form" aria-label={t("Simulação de cenário")}>
        <div>
          <span className="lbl">{t("Simulação de cenário")}</span>
          <h1 className="simh">{titulo}</h1>
          <p className="intro">
            {t("Parte das condições de agora ({N}, {N}). Informe a chuva que você espera e veja como o índice do município reagiria.", { N: quando })}
          </p>
        </div>
        <div className="fld">
          <label className="lbl" htmlFor="sim-mun">
            {t("Município")}
          </label>
          <select id="sim-mun" value={ibge} onChange={(e) => mudar(() => setIbge(e.target.value))}>
            {!ibge && (
              <option value="" disabled>
                {t("Escolha um município")}
              </option>
            )}
            {municipios.map((m) => (
              <option key={m.ibge} value={m.ibge}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="fld">
          <span className="lbl" id="sim-per">
            {t("Período")}
          </span>
          <div className="seg" role="group" aria-labelledby="sim-per">
            {PERIODOS.map((h) => (
              <button key={h} type="button" aria-pressed={h === horas} onClick={() => trocarPeriodo(h)}>
                {t("próximas {N}", { N: `${h}h` })}
              </button>
            ))}
          </div>
        </div>
        <div className="fld">
          <label className="lbl" htmlFor="sim-mm">
            {t("Chuva esperada no período")}
          </label>
          <div className="row">
            <input
              type="range"
              min={0}
              max={limite}
              step={PASSO_CHUVA_MM}
              value={chuva}
              aria-label={t("Chuva em mm")}
              onChange={(e) => mudar(() => setChuva(Number(e.target.value)))}
            />
            <input
              id="sim-mm"
              type="number"
              min={0}
              max={limite}
              step={1}
              value={chuva}
              aria-describedby="sim-lim"
              onChange={(e) => mudar(() => setChuva(limitarChuva(Number(e.target.value) || 0, horas)))}
            />
            <span className="unit">mm</span>
          </div>
          <p className="lim" id="sim-lim">
            {t("Até {N} mm, o recorde mundial em {N} h (OMM).", { N: [limite.toLocaleString("pt-BR"), String(horas)] })}
          </p>
          <div className="presets">
            {[...ATALHOS[horas], ["recorde mundial", limite] as const].map(([nome, mm]) => (
              <button key={nome} type="button" onClick={() => mudar(() => setChuva(mm))}>
                {t(nome)} <b>{mm.toLocaleString("pt-BR")} mm</b>
              </button>
            ))}
          </div>
        </div>
        <label className="chk">
          <input type="checkbox" checked={regional} onChange={(e) => mudar(() => setRegional(e.target.checked))} />
          {t("Aplicar a mesma chuva aos {N} municípios (chuva regional)", { N: String(municipios.length) })}
        </label>
        <div className="go">
          <button type="button" className="btn pri" disabled={!ibge} onClick={rodar}>
            <CloudRain aria-hidden="true" />
            {t("Simular")}
          </button>
          <button type="button" className="btn" aria-label={t("Voltar à condição atual")} title={t("Voltar à condição atual")} onClick={voltar}>
            <RotateCcw aria-hidden="true" />
          </button>
        </div>
        {r && <Resultado t={t} atual={r.d0} simulado={r.s} efr={r.d0.efr_mm} efrSimulada={r.s.chuva_efetiva_mm} limiar={r.m.limiar_mm} />}
        {r && <Avisos lista={r.avisos} onde="no-painel" />}
        <p className="disc">
          {t("Simulação com a mesma equação do índice: (chuva efetiva + chuva informada) ÷ limiar. Não altera os dados reais e não dispara alertas.")}{" "}
          {t("Sistema de")} <b>{t("apoio à decisão")}</b>
          {t(", de caráter acadêmico. Não constitui alerta oficial e não substitui o Cemaden nem a Defesa Civil.")}
        </p>
      </aside>
      <Mapa ref={mapa} lang={lang} valores={valores} selecionado={ibge} onSelecionar={escolher}>
        <div className="maphd" ref={medirTopo}>
          {r && <Avisos lista={r.avisos} onde="no-mapa" />}
          <div className="seg" role="group" aria-label={t("Mostrar no mapa")}>
            <button type="button" aria-pressed={ver === "agora"} onClick={() => setVer("agora")}>
              {t("Agora")}
            </button>
            <button type="button" aria-pressed={ver === "simulado"} disabled={!cenario} onClick={() => setVer("simulado")}>
              {t("Simulado")}
            </button>
          </div>
        </div>
        <Legenda lang={lang} />
        <p className="float snap">
          <span className="lbl">{simulados && ver === "simulado" ? t("Cenário simulado") : t("Condição atual · {N} {N}", { N: quando })}</span>
          {t("{N} de {N} municípios em alerta", { N: [String(emAlerta), String(total)] })}
        </p>
      </Mapa>
    </div>
  );
}

/** Altura do topo do mapa (avisos e "Agora | Simulado") em `--maphd-h`, para a legenda aberta parar abaixo dele. */
function medirTopo(el: HTMLDivElement | null) {
  if (!el) return;
  const obs = new ResizeObserver(() => el.parentElement?.style.setProperty("--maphd-h", `${el.offsetHeight}px`));
  obs.observe(el);
  return () => obs.disconnect();
}

/** Os avisos ficam sobre o mapa; abaixo de 900 px, no painel (simulacao.css): no mapa pequeno cobriam quase tudo. */
function Avisos({ lista, onde }: { lista: Aviso[]; onde: "no-mapa" | "no-painel" }) {
  return (
    <div className={`avisos ${onde}`}>
      {lista.map((a) => (
        <CaixaAviso key={a.titulo} {...a} />
      ))}
    </div>
  );
}

function CaixaAviso({ tipo, titulo, texto }: Aviso) {
  return (
    <div className={`aviso ${tipo}`}>
      {tipo === "ok" ? <Info aria-hidden="true" /> : <TriangleAlert aria-hidden="true" />}
      <div>
        <strong>{titulo}</strong>
        {texto}
      </div>
    </div>
  );
}

interface PropsResultado {
  t: T;
  atual: IndiceClasse;
  simulado: IndiceClasse;
  efr: number;
  efrSimulada: number;
  limiar: number;
}

function Resultado({ t, atual, simulado, efr, efrSimulada, limiar }: PropsResultado) {
  return (
    <section className="res" aria-label={t("Resultado")}>
      <div className="cmp">
        <Valor t={t} rotulo={t("Agora")} valor={atual} />
        <ArrowRight className="arr" aria-hidden="true" />
        <Valor t={t} rotulo={t("Simulado")} valor={simulado} />
      </div>
      <div className="scalew" aria-hidden="true">
        <span className="mk s" style={{ left: `${posicaoEscala(simulado.indice)}%` }}>
          {t("simulado")}
        </span>
        <div className="scale">
          {faixasEscala().map((f) => (
            <i key={f.numero} style={{ flexBasis: `${f.largura}%`, background: `var(--c${f.numero})` }} />
          ))}
        </div>
        <span className="mk a" style={{ left: `${posicaoEscala(atual.indice)}%` }}>
          {t("agora")}
        </span>
        <div className="ends">
          {MARCAS.map((v) => (
            <span key={v} style={{ left: `${posicaoEscala(v)}%` }}>
              {v === LIMIAR_ALERTA ? t("{N} alerta", { N: formatarIndice(v) }) : v ? formatarIndice(v) : "0"}
            </span>
          ))}
        </div>
      </div>
      <dl className="detail">
        <div>
          <dt>{t("Chuva efetiva atual")}</dt>
          <dd className="num">{formatarMm(efr)} mm</dd>
        </div>
        <div>
          <dt>{t("Chuva efetiva simulada")}</dt>
          <dd className="num">{formatarMm(efrSimulada)} mm</dd>
        </div>
        <div>
          <dt>{t("Limiar crítico")}</dt>
          <dd className="num">{formatarMm(limiar)} mm</dd>
        </div>
      </dl>
    </section>
  );
}

function Valor({ t, rotulo, valor: { indice, classe } }: { t: T; rotulo: string; valor: IndiceClasse }) {
  return (
    <div className="c">
      <span className="lbl">{rotulo}</span>
      <b className="num">{formatarIndice(indice)}</b>
      <span className="cls">
        <SeloClasse classe={classe} />
        {t(infoClasse(classe).nome)}
      </span>
    </div>
  );
}
