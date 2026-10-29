import { TEXTO_INDISPONIVEL, carregarBotJson } from "./bot-json";
import { ibgesDoChat, inscrever, removerChat } from "./inscritos";
import {
  enviarMensagem,
  interpretarComando,
  normalizarNome,
  partesDoStatus,
} from "./telegram";
import { tecladoDoGrupo, tecladoInicial } from "./teclados";
import type { Env } from "./tipos";

type Mensagem = { chat?: { id?: unknown }; text?: unknown };

async function tratarMensagem(
  texto: string,
  chatId: number,
  env: Env,
): Promise<void> {
  const bot = await carregarBotJson(env.BOT_JSON_URL);
  if (bot === null) {
    await enviarMensagem(env, chatId, TEXTO_INDISPONIVEL, "nenhum");
    return;
  }
  const t = bot.textos;
  const comando = interpretarComando(texto);

  if (comando === null) {
    const nome = normalizarNome(texto);
    if (nome === normalizarNome(t.opcao_todos)) {
      await inscrever(env.DB, chatId, bot.municipios.map((m) => m.ibge), new Date());
      await enviarMensagem(env, chatId, t.inscricao_confirmada_todos, "remover");
      return;
    }
    const grupos = bot.grupos ?? [];
    const grupo = grupos.find((g) => normalizarNome(g.nome) === nome);
    if (grupo) {
      await enviarMensagem(env, chatId, grupo.escolha, { linhas: tecladoDoGrupo(bot, grupo) });
      return;
    }
    const todosDoGrupo = grupos.find((g) => normalizarNome(g.opcao_todos) === nome);
    if (todosDoGrupo) {
      await inscrever(env.DB, chatId, todosDoGrupo.municipios, new Date());
      await enviarMensagem(env, chatId, todosDoGrupo.confirmacao, "remover");
      return;
    }
    if (grupos.length && t.opcao_voltar && nome === normalizarNome(t.opcao_voltar)) {
      await enviarMensagem(env, chatId, t.boas_vindas_grupos ?? t.boas_vindas, "municipios", bot);
      return;
    }
    const municipio = bot.municipios.find((m) => normalizarNome(m.nome) === nome);
    if (municipio) {
      await inscrever(env.DB, chatId, [municipio.ibge], new Date());
      await enviarMensagem(env, chatId, t.inscricao_confirmada[municipio.ibge] ?? "", "remover");
      return;
    }
  } else if (comando.comando === "start") {
    const codigo = comando.args[0] ?? "";
    const sugerido = Object.hasOwn(t.boas_vindas_sugerido, codigo) ? t.boas_vindas_sugerido[codigo] : undefined;
    const semSugerido = bot.grupos?.length ? (t.boas_vindas_grupos ?? t.boas_vindas) : t.boas_vindas;
    await enviarMensagem(env, chatId, sugerido ?? semSugerido, { linhas: tecladoInicial(bot, sugerido ? codigo : undefined) });
    return;
  } else if (comando.comando === "status") {
    const ibges = await ibgesDoChat(env.DB, chatId);
    for (const parte of partesDoStatus(bot, ibges)) await enviarMensagem(env, chatId, parte, "nenhum");
    return;
  } else if (comando.comando === "parar") {
    await removerChat(env.DB, chatId);
    await enviarMensagem(env, chatId, t.inscricoes_apagadas, "remover");
    return;
  }
  await enviarMensagem(env, chatId, t.opcao_desconhecida, "municipios", bot);
}

/** Trata uma atualização do Telegram. Ignora o que não for mensagem de texto. */
export async function tratarAtualizacao(
  update: unknown,
  env: Env,
): Promise<void> {
  const mensagem = (update as { message?: Mensagem } | null)?.message;
  const texto = mensagem?.text;
  const chatId = mensagem?.chat?.id;
  if (typeof texto !== "string" || typeof chatId !== "number") return;
  await tratarMensagem(texto, chatId, env);
}
