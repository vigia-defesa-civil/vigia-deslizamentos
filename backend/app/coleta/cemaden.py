"""Chuva observada dos pluviômetros do Cemaden, sobreposta à antecedente do Open-Meteo.

O Open-Meteo dá a chuva passada por modelo numérico em grade, que subestima a
chuva local: em 07/11/2026 ele estimava ~53 mm na semana em Rio do Sul, e os
pluviômetros do Cemaden mediam ~100 mm só nas 24 h anteriores. Por isso as
últimas 96 h da série antecedente passam a vir do Cemaden. As horas mais
antigas da janela de 168 h do EfR continuam do Open-Meteo, que também cobre
um município quando o Cemaden falha.

Fonte: o JSON público que alimenta o mapa interativo do Cemaden, sem token. Não
é API oficial: pode mudar sem aviso. Por isso toda falha aqui só vai para o log
e a execução segue com o Open-Meteo. Cada estação traz só acumulados que
terminam na última leitura (1, 3, 6, 12, 24, 48, 72 e 96 h). A chuva de cada
faixa entre dois acumulados é distribuída por igual nas horas da faixa: o EfR
fica aproximado dentro da faixa, e o total de cada faixa é exato.

Escolha da estação: entre as válidas do município, a de maior acumulado em
24 h (é a chuva que mais pesa no EfR, e um sistema de alerta prefere errar para
cima). Município sem estação válida usa o vizinho mais próximo que tenha uma,
até `RAIO_VIZINHO_KM`.
"""

from __future__ import annotations

import logging
import math
from dataclasses import replace
from datetime import datetime, timedelta, timezone

from app.config import Municipio
from app.modelos.tipos import DadosMunicipio

URL = "https://resources.cemaden.gov.br/graficos/interativo/getJson2.php"
TIMEOUT_S = 60
CAMPOS = ("acc1hr", "acc3hr", "acc6hr", "acc12hr", "acc24hr", "acc48hr", "acc72hr", "acc96hr")
LIMITES_H = (0, 1, 3, 6, 12, 24, 48, 72, 96)
#: Leitura mais velha que isso não descreve a chuva de agora.
IDADE_MAXIMA = timedelta(hours=2)
#: Relógio de estação adiantado além disso é defeito da estação (visto em 07/11/2026).
ADIANTAMENTO_MAXIMO = timedelta(minutes=10)
RAIO_VIZINHO_KM = 20.0

_log = logging.getLogger(__name__)


def horas_da_estacao(estacao: dict, agora_utc: datetime) -> list[float] | None:
    """Chuva por hora (índice 0 = a hora mais recente) nas 96 h, ou `None` se a estação não serve.

    Não serve: data ilegível, leitura velha ou adiantada, acumulado faltando
    ("-") ou acumulados que diminuem com a janela. A data vem em UTC
    (`dd/mm/aa HH:MM`), conferida contra o relógio em 07/11/2026.
    """
    try:
        lida = datetime.strptime(estacao["datahoraUltimovalor"], "%d/%m/%y %H:%M").replace(tzinfo=timezone.utc)
        acumulados = [float(estacao[campo]) for campo in CAMPOS]
    except (KeyError, TypeError, ValueError):
        return None
    if not -ADIANTAMENTO_MAXIMO <= agora_utc - lida <= IDADE_MAXIMA:
        return None
    if acumulados[0] < 0 or any(a > b for a, b in zip(acumulados, acumulados[1:])):
        return None

    horas: list[float] = []
    anterior = 0.0
    for inicio, fim, acumulado in zip(LIMITES_H, LIMITES_H[1:], acumulados):
        horas.extend([(acumulado - anterior) / (fim - inicio)] * (fim - inicio))
        anterior = acumulado
    return horas


def _distancia_km(a: Municipio, b: Municipio) -> float:
    (pa, pb) = (a.pontos[0], b.pontos[0])
    return 111.2 * math.hypot(pa.lat - pb.lat, (pa.lon - pb.lon) * math.cos(math.radians(pa.lat)))


def horas_por_municipio(
    estacoes: list[dict], municipios: list[Municipio], agora_utc: datetime
) -> dict[str, tuple[list[float], str]]:
    """`ibge -> (chuva por hora nas 96 h, origem)` para cada município que tem estação própria ou vizinha."""
    proprias: dict[str, list[float]] = {}
    ibges = {m.ibge for m in municipios}
    for estacao in estacoes:
        ibge = str(estacao.get("codibge"))
        if ibge not in ibges:
            continue
        horas = horas_da_estacao(estacao, agora_utc)
        if horas is not None and (ibge not in proprias or sum(horas[:24]) > sum(proprias[ibge][:24])):
            proprias[ibge] = horas

    nomes = {m.ibge: m.nome for m in municipios}
    resultado = {ibge: (horas, "própria") for ibge, horas in proprias.items()}
    for municipio in municipios:
        if municipio.ibge in proprias:
            continue
        vizinhos = sorted(
            (_distancia_km(municipio, outro), outro.ibge)
            for outro in municipios
            if outro.ibge in proprias
        )
        if vizinhos and vizinhos[0][0] <= RAIO_VIZINHO_KM:
            distancia, ibge = vizinhos[0]
            resultado[municipio.ibge] = (proprias[ibge], f"vizinho {nomes[ibge]} ({distancia:.0f} km)")
    return resultado


def sobrepor(serie: dict[datetime, float], horas: list[float], agora_utc: datetime) -> dict[datetime, float]:
    """Troca, na série horária, as últimas 96 h pela chuva do Cemaden.

    A hora `h` antes da última hora cheia vai para o rótulo `hora_cheia − h`
    (o rótulo marca o fim da hora, como no Open-Meteo). Rótulo que a série não
    tem não é criado.
    """
    hora_cheia = agora_utc.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0)
    nova = dict(serie)
    for h, valor in enumerate(horas):
        rotulo = hora_cheia - timedelta(hours=h)
        if rotulo in nova:
            nova[rotulo] = valor
    return nova


def aplicar(
    coletados: dict[str, DadosMunicipio],
    municipios: list[Municipio],
    agora_utc: datetime,
    http,
) -> dict[str, DadosMunicipio]:
    """Devolve `coletados` com a antecedente das últimas 96 h vinda do Cemaden. Nunca levanta."""
    try:
        resposta = http.get(URL, params={"uf": "SC"}, timeout=TIMEOUT_S)
        resposta.raise_for_status()
        estacoes = resposta.json()
        if not isinstance(estacoes, list):
            raise ValueError("resposta não é uma lista de estações")
        por_municipio = horas_por_municipio(estacoes, municipios, agora_utc)
    except Exception as erro:  # noqa: BLE001 — fonte não oficial; sem ela fica o Open-Meteo
        _log.error("Cemaden indisponível (%s); chuva antecedente só do Open-Meteo", type(erro).__name__)
        return coletados

    novos = dict(coletados)
    for municipio in municipios:
        dados = coletados.get(municipio.ibge)
        if dados is None:
            continue
        if municipio.ibge not in por_municipio:
            _log.warning("Cemaden: %s sem estação válida até %.0f km; antecedente do Open-Meteo",
                         municipio.nome, RAIO_VIZINHO_KM)
            continue
        horas, origem = por_municipio[municipio.ibge]
        novos[municipio.ibge] = replace(
            dados, antecedente=[sobrepor(serie, horas, agora_utc) for serie in dados.antecedente]
        )
        _log.info("Cemaden: %s, estação %s, %.1f mm em 24 h", municipio.nome, origem, sum(horas[:24]))
    return novos
