// Mundo em memória por baixo do mod: arquivos, comandos, painéis, toasts, processos.
// Cópia deste arquivo vai em cada mod (um mod não importa nada de fora da própria pasta).
// Base: mods/recibo-sessao/tests/mundo.ts, com mais mocks (uso da sessão, mensagens,
// compactar, lista/execução de comandos do engine, relógio e store em memória).
import type { On, RenderInput, SessionUsage } from 'claude-code'
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
  /** Comandos que o mod mandou o engine rodar ($.command.run), com args. */
  executados: string[]
  /** Comandos que existem no engine ($.command.list). */
  disponiveis: string[]
  compactacoes: number
  uso: SessionUsage
  mensagens: { role: 'user' | 'assistant'; text: string }[]
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

export const FAIXA: RenderInput<'AbovePrompt'> = {
  component: 'AbovePrompt',
  surface: 'terminal',
  requestId: 'band',
  viewport: { columns: 180, rows: 48, isFullscreen: true },
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 20,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 19 },
    view: {},
  },
}

export const PAINEL = (id: string): RenderInput<'Pane'> => ({
  component: 'Pane',
  surface: 'terminal',
  requestId: id,
  viewport: { columns: 180, rows: 48, isFullscreen: true },
  props: {
    title: id,
    isFocused: false,
    bodyColumns: 72,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 44 },
    view: {},
  },
})

/** Uso da sessão com o contexto em `percent`% de uma janela de 200 mil tokens. */
export const usoCom = (percent: number, extra: Partial<SessionUsage> = {}): SessionUsage => ({
  startedAt: 0,
  context: { window: 200_000, tokens: percent * 2_000, percent },
  rateLimits: [],
  ...extra,
})

export function mundoDe(on: On, arquivos: Record<string, string> = {}, loja: Record<string, unknown> = {}): Mundo {
  const mundo: Mundo = {
    arquivos: new Map(Object.entries(arquivos).map(([k, v]) => [k, { texto: v, mtime: 1_000 }])),
    comandos: [],
    abertos: [],
    toasts: [],
    status: [],
    preenchidos: [],
    rodados: [],
    executados: [],
    disponiveis: [],
    compactacoes: 0,
    uso: usoCom(10),
    mensagens: [],
    relogio: mock.clock(on),
    saidaProcesso: () => ({ exitCode: 0, stdout: '' }),
  }

  mock.store(on, loja)
  // O que fica por baixo da faixa/painel quando nenhum outro plugin desenha.
  on('ui.render', () => ({ type: 'Text', props: {}, children: [''] }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('prompt.submit', ($, e) => ({ text: e.text, ...(e.context !== undefined && { context: e.context }) }))
  on('fs.exists', ($, e) => ({ value: mundo.arquivos.has(e.path) }))
  on('fs.read', ($, e) => {
    const f = mundo.arquivos.get(e.path)
    return f ? { value: f.texto } : { deny: `ENOENT: ${e.path}` }
  })
  on('session.usage', () => ({ value: mundo.uso }) as never)
  on('session.messages', () => ({ value: mundo.mensagens.map(m => ({ ...m, toolUses: [] })) }) as never)
  on('session.compact', () => {
    mundo.compactacoes += 1
    return {} as never
  })
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('command.register', ($, e) => {
    mundo.comandos.push(e.name)
    return { value: { command: e.name } }
  })
  on('command.list', () => ({ value: mundo.disponiveis.map(name => ({ name, description: '', source: 'user' as const })) }))
  on('command.run', ($, e) => {
    mundo.executados.push(e.args ? `${e.command} ${e.args}` : e.command)
    return { text: '' }
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
