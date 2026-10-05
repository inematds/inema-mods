// guarda-colisao — antes de Edit/Write/NotebookEdit, confere se o arquivo foi mudado
// fora desta sessão (outra sessão do Claude, você no editor, outro programa).
// Se foi, pergunta: Prosseguir / Pular e avisar o modelo / Cancelar.
// /colisao mostra quantas vezes perguntou (para medir falso positivo).
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Contagem } from '../types'
import { haQuanto, ignorado, instrucaoAoModelo, mudouFora } from './regras'

const toques = atom({ plugin: 'guarda-colisao', key: 'toques' } as const, {})
const contagem = atom({ plugin: 'guarda-colisao', key: 'contagem' } as const, {
  perguntas: 0,
  prosseguir: 0,
  pular: 0,
  cancelar: 0,
  semTela: 0,
})
const arquivos = atom({ plugin: 'guarda-colisao', key: 'arquivos' } as const, [])

const PROSSEGUIR = 'Prosseguir'
const PULAR = 'Pular e avisar o modelo'
const CANCELAR = 'Cancelar'

type Config = { semTela: 'avisar' | 'permitir'; ignorar: readonly string[] }

const nomeDe = (caminho: string) => caminho.slice(caminho.lastIndexOf('/') + 1)

async function estatistica($: EngineInterface, caminho: string) {
  return $.fs.stat(caminho, { resolve: true }).catch(() => undefined)
}

/** Grava o mtime atual como "meu toque" (depois de editar ou ler com sucesso). */
async function marcar($: EngineInterface, caminho: string, cfg: Config) {
  if (ignorado(caminho, cfg.ignorar)) return
  const st = await estatistica($, caminho)
  if (!st || st.kind !== 'file') return
  const chave = st.realPath ?? caminho
  await update($, toques, t => ({ ...t, [chave]: st.mtimeMs }))
}

async function contar($: EngineInterface, campo: 'prosseguir' | 'pular' | 'cancelar' | 'semTela', caminho: string) {
  await update($, contagem, c => ({ ...c, perguntas: c.perguntas + 1, [campo]: c[campo] + 1 }))
  await update($, arquivos, a => [...a.filter(x => x !== caminho), caminho].slice(-20))
}

/** Devolve `{ deny }` para barrar a edição, ou undefined para deixar seguir. */
async function decidir($: EngineInterface, caminho: string, cfg: Config): Promise<{ deny: string } | undefined> {
  if (ignorado(caminho, cfg.ignorar)) return undefined
  const st = await estatistica($, caminho)
  if (!st || st.kind !== 'file') return undefined // arquivo novo: nada a colidir
  const chave = st.realPath ?? caminho
  const meu = (await read($, toques))[chave]
  const base = meu ?? (await $.session.usage()).startedAt
  if (!mudouFora(st.mtimeMs, base)) return undefined

  const quando = haQuanto(await $.clock.now(), st.mtimeMs)
  const resposta = await $.ui
    .ask(`${nomeDe(caminho)} foi mudado fora desta sessão ${quando}. O que fazer?`, {
      header: 'Colisão',
      options: [PULAR, PROSSEGUIR, CANCELAR],
    })
    .catch(() => undefined)

  if (resposta === undefined) {
    await contar($, 'semTela', caminho)
    return cfg.semTela === 'permitir' ? undefined : { deny: instrucaoAoModelo(caminho, quando) }
  }
  if (resposta === PROSSEGUIR) {
    await contar($, 'prosseguir', caminho)
    return undefined
  }
  if (resposta === CANCELAR) {
    await contar($, 'cancelar', caminho)
    return { deny: 'guarda-colisao: cancelado pelo usuário.' }
  }
  // "Pular" ou texto livre digitado em "Outro": o modelo relê e decide.
  await contar($, 'pular', caminho)
  return { deny: instrucaoAoModelo(caminho, quando) }
}

export const textoColisao = (c: Contagem, lista: readonly string[]) => {
  if (c.perguntas === 0) return 'Guarda de colisão: nenhuma pergunta nesta sessão.'
  const linhas = [
    `Guarda de colisão: perguntei ${c.perguntas} vez(es) nesta sessão.`,
    `  Prosseguir ${c.prosseguir} · Pular ${c.pular} · Cancelar ${c.cancelar} · sem tela ${c.semTela}`,
    '  (muitos "Prosseguir" = falso positivo: ponha o caminho em "ignorar" no /config)',
    ...lista.slice(-10).map(a => `  - ${a}`),
  ]
  return linhas.join('\n')
}

export const register: Register = (on, options) => {
  const cfg: Config = {
    semTela: options.sem_tela === 'permitir' ? 'permitir' : 'avisar',
    ignorar: Array.isArray(options.ignorar) ? options.ignorar : [],
  }

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'colisao',
      description: 'Guarda de colisão: quantas vezes perguntou nesta sessão',
    })
    return next(e)
  })

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const barrar = await decidir($, e.file_path, cfg)
    if (barrar) return barrar
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) await marcar($, e.file_path, cfg)
    return ran
  })

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const barrar = await decidir($, e.file_path, cfg)
    if (barrar) return barrar
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) await marcar($, e.file_path, cfg)
    return ran
  })

  on('tool.call', { tool: 'NotebookEdit' }, async ($, e, next) => {
    const barrar = await decidir($, e.notebook_path, cfg)
    if (barrar) return barrar
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) await marcar($, e.notebook_path, cfg)
    return ran
  })

  // Ler o arquivo conta como toque: depois de reler, o modelo pode editar sem nova pergunta.
  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) await marcar($, e.file_path, cfg)
    return ran
  })

  on('command.run', { command: 'colisao' }, async $ => ({
    text: textoColisao(await read($, contagem), await read($, arquivos)),
  }))
}
