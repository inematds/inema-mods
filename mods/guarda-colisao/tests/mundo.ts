// Mundo em memória por baixo do mod: arquivos, comandos, painéis, toasts, processos,
// perguntas ($.ui.ask), relógio, store e uso da sessão.
// Cópia deste arquivo vai em cada mod (um mod não importa nada de fora da própria pasta).
// Base: mods/recibo-sessao/tests/mundo.ts + mocks de ui.ask, session.usage, session.cwd, store.
import type { On } from 'claude-code'
import { mock } from 'claude-code/testing'
import type { MockClock } from 'claude-code/testing'

export type Mundo = {
  arquivos: Map<string, { texto: string; mtime: number }>
  comandos: string[]
  abertos: string[]
  toasts: string[]
  status: (string | undefined)[]
  preenchidos: string[]
  rodados: string[][]
  /** Perguntas feitas por $.ui.ask, na ordem. */
  perguntas: string[]
  /** Opções oferecidas em cada pergunta. */
  opcoes: string[][]
  /** Respostas que o "usuário" dá, uma por pergunta. Vazio = sem tela (ask rejeita). */
  respostas: string[]
  /** startedAt de $.session.usage(). */
  inicio: number
  relogio: MockClock
  saidaProcesso: (argv: readonly string[]) => { exitCode: number; stdout: string; stderr?: string }
}

export const SESSAO = { surface: 'terminal' as const, isInteractive: true, cwd: '/work' }

export const prompt = (text: string) => ({ text, origin: { kind: 'composer' as const }, wait: false })

export const comando = (nome: string, args = '') => ({
  command: nome,
  args,
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: true, columns: 180 },
})

export function mundoDe(on: On, arquivos: Record<string, string> = {}, agora = 0): Mundo {
  const mundo: Mundo = {
    arquivos: new Map(Object.entries(arquivos).map(([k, v]) => [k, { texto: v, mtime: 1_000 }])),
    comandos: [],
    abertos: [],
    toasts: [],
    status: [],
    preenchidos: [],
    rodados: [],
    perguntas: [],
    opcoes: [],
    respostas: [],
    inicio: 0,
    relogio: mock.clock(on, { now: agora }),
    saidaProcesso: () => ({ exitCode: 0, stdout: '' }),
  }

  mock.store(on)
  // $.ui.ask chega aqui como tool.call de AskUserQuestion. Registrado antes de qualquer
  // mock genérico de tool.call do teste, para não ser engolido por ele.
  on('tool.call', { tool: 'AskUserQuestion' }, ($, e) => {
    const q = e.questions[0]
    const pergunta = q?.question ?? ''
    mundo.perguntas.push(pergunta)
    mundo.opcoes.push((q?.options ?? []).map(o => o.label))
    const resposta = mundo.respostas.shift()
    if (resposta === undefined) return { deny: 'sem tela' }
    return { result: { questions: e.questions, answers: { [pergunta]: resposta } } } as never
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/work' }))
  on('session.usage', () => ({ value: { startedAt: mundo.inicio, context: {}, rateLimits: [] } }) as never)
  on('prompt.submit', ($, e) => ({ text: e.text, ...(e.context !== undefined && { context: e.context }) }))
  on('fs.exists', ($, e) => ({ value: mundo.arquivos.has(e.path) }))
  on('fs.stat', ($, e) => {
    const f = mundo.arquivos.get(e.path)
    return f
      ? {
          value: {
            kind: 'file' as const,
            size: f.texto.length,
            mtimeMs: f.mtime,
            isLink: false,
            ...(e.resolve && { realPath: e.path }),
          },
        }
      : { deny: `ENOENT: ${e.path}` }
  })
  on('fs.read', ($, e) => {
    const f = mundo.arquivos.get(e.path)
    return f ? { value: f.texto } : { deny: `ENOENT: ${e.path}` }
  })
  on('command.register', ($, e) => {
    mundo.comandos.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.open', ($, e) => {
    mundo.abertos.push(e.id)
    return { value: { isPlaced: true } } as never
  })
  on('ui.toast', ($, e) => {
    mundo.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', ($, e) => {
    mundo.status.push(e.text)
    return { value: undefined }
  })
  on('prompt.fill', ($, e) => {
    mundo.preenchidos.push(e.text)
    return { isFilled: true }
  })
  on('process.run', ($, e) => {
    mundo.rodados.push([...e.argv])
    return { value: { stderr: '', isStdoutTruncated: false, isStderrTruncated: false, ...mundo.saidaProcesso(e.argv) } } as never
  })
  return mundo
}
