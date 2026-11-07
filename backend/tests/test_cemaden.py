"""Testes da chuva observada do Cemaden, sem rede."""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import pytest

from app.coleta import cemaden
from app.config import Municipio, Ponto
from app.modelos.tipos import DadosMunicipio

UTC = timezone.utc
AGORA = datetime(2026, 11, 7, 14, 50, tzinfo=UTC)


def estacao(ibge: str, acumulados=(1, 3, 6, 12, 24, 48, 72, 96), lida="07/11/26 14:30") -> dict:
    item = {"codibge": int(ibge), "datahoraUltimovalor": lida}
    item.update({campo: valor for campo, valor in zip(cemaden.CAMPOS, acumulados)})
    return item


def municipio(ibge: str, lat: float, lon: float = -49.6) -> Municipio:
    return Municipio(ibge=ibge, nome=f"M{ibge}", limiar_mm=100.0, fonte_limiar="t", mv_h=24.0,
                     pontos=(Ponto(lat=lat, lon=lon),))


def test_acumulados_viram_chuva_por_hora_com_o_total_de_cada_faixa_exato():
    horas = cemaden.horas_da_estacao(estacao("1", (2, 8, 8, 20, 44, 92, 92, 100)), AGORA)
    assert len(horas) == 96
    assert horas[0] == 2  # 0–1 h
    assert horas[1:3] == [3, 3]  # 1–3 h: 6 mm
    assert horas[3:6] == [0, 0, 0]
    assert sum(horas[:24]) == pytest.approx(44)
    assert sum(horas) == pytest.approx(100)


@pytest.mark.parametrize(
    "item",
    [
        estacao("1", (1, 3, 6, 12, "-", 48, 72, 96)),  # acumulado faltando
        estacao("1", (1, 3, 6, 12, 24, 20, 72, 96)),  # acumulado que diminui
        estacao("1", lida="07/11/26 12:00"),  # leitura velha
        estacao("1", lida="07/11/26 15:40"),  # relógio da estação adiantado
        estacao("1", lida=None),
    ],
)
def test_estacao_com_dado_ruim_e_descartada(item):
    assert cemaden.horas_da_estacao(item, AGORA) is None


def test_municipio_usa_a_estacao_mais_chuvosa_e_sem_estacao_o_vizinho_ate_o_raio():
    municipios = [municipio("1", -27.0), municipio("2", -27.1), municipio("3", -28.0)]
    estacoes = [
        estacao("1", (0, 0, 0, 0, 10, 10, 10, 10)),
        estacao("1", (0, 0, 0, 0, 50, 50, 50, 50)),
        estacao("9999999"),  # fora da configuração
    ]
    resultado = cemaden.horas_por_municipio(estacoes, municipios, AGORA)
    assert sum(resultado["1"][0][:24]) == pytest.approx(50)
    assert resultado["1"][1] == "própria"
    assert sum(resultado["2"][0][:24]) == pytest.approx(50)  # vizinho a ~11 km
    assert "3" not in resultado  # ~111 km: fica com o Open-Meteo


def test_sobrepor_troca_so_as_ultimas_96_horas_da_serie():
    hora_cheia = datetime(2026, 11, 7, 14, 0, tzinfo=UTC)
    serie = {hora_cheia - timedelta(hours=h): 0.5 for h in range(169)}
    nova = cemaden.sobrepor(serie, [float(h) for h in range(96)], AGORA)
    assert nova[hora_cheia] == 0.0
    assert nova[hora_cheia - timedelta(hours=95)] == 95.0
    assert nova[hora_cheia - timedelta(hours=96)] == 0.5
    assert len(nova) == len(serie)
    assert serie[hora_cheia] == 0.5  # não altera a original


class _Http:
    def __init__(self, corpo=None, erro=None):
        self.corpo, self.erro = corpo, erro

    def get(self, url, params=None, timeout=None):
        if self.erro:
            raise self.erro
        corpo = self.corpo

        class R:
            def raise_for_status(self):
                pass

            def json(self):
                return corpo

        return R()


def _dados(ibge: str) -> DadosMunicipio:
    hora_cheia = datetime(2026, 11, 7, 14, 0, tzinfo=UTC)
    return DadosMunicipio(ibge=ibge, antecedente=[{hora_cheia - timedelta(hours=h): 0.0 for h in range(169)}],
                          membros=[])


def test_aplicar_poe_a_chuva_do_cemaden_na_antecedente():
    m = municipio("1", -27.0)
    novos = cemaden.aplicar({"1": _dados("1")}, [m], AGORA, _Http([estacao("1")]))
    assert sum(novos["1"].antecedente[0].values()) == pytest.approx(96)


def test_aplicar_com_cemaden_fora_do_ar_mantem_o_open_meteo_e_registra(caplog):
    coletados = {"1": _dados("1")}
    with caplog.at_level(logging.ERROR):
        novos = cemaden.aplicar(coletados, [municipio("1", -27.0)], AGORA, _Http(erro=OSError("rede")))
    assert novos is coletados
    assert "Cemaden indisponível" in caplog.text
