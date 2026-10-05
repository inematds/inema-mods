// Mundo em memória por baixo do mod: arquivos, comandos, painéis, toasts, processos.
// Cópia deste arquivo vai em cada mod (um mod não importa nada de fora da própria pasta).
// Diferenças em relação ao do recibo-sessao:
//  - `$.store` vem do `mock.store` (guarda de verdade; `guardado` semeia o que já estava lá,
//    que é como se testa "sobrevive a reinício");
//  - há um `ui.render` por baixo que faz o papel do engine: anota as props que chegaram
//    (`desenhados`) e desenha um Text vazio, para os mods que embrulham `next(e)`.
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
  desenhados: { component: string; props: unknown }[]
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

export const SUPERFICIES = ['terminal', 'desktop'] as const

// A faixa acima do prompt, como o engine a pede (props mínimas válidas).
export const faixa = (surface: 'terminal' | 'desktop' = 'terminal', extra: { hasSurvey?: boolean } = {}) => ({
  component: 'AbovePrompt' as const,
  surface,
  requestId: 'band',
  viewport: { columns: 120, rows: 40, isFullscreen: true },
  props: {
    hasSurvey: extra.hasSurvey ?? false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 9 },
    view: {},
  },
})

export function mundoDe(
  on: On,
  arquivos: Record<string, string> = {},
  guardado: Record<string, unknown> = {},
  relogio: { now?: number } = {},
): Mundo {
  const relogioMock = mock.clock(on, relogio.now === undefined ? undefined : { now: relogio.now })
  const mundo: Mundo = {
    arquivos: new Map(Object.entries(arquivos).map(([k, v]) => [k, { texto: v, mtime: 1_000 }])),
    comandos: [],
    abertos: [],
    toasts: [],
    status: [],
    preenchidos: [],
    rodados: [],
    desenhados: [],
    relogio: relogioMock,
    saidaProcesso: () => ({ exitCode: 0, stdout: '' }),
  }

  mock.store(on, guardado)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('prompt.submit', ($, e) => ({ text: e.text, ...(e.context !== undefined && { context: e.context }) }))
  on('fs.exists', ($, e) => ({ value: mundo.arquivos.has(e.path) }))
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
  on('ui.render', ($, e) => {
    mundo.desenhados.push({ component: e.component, props: e.props })
    return { type: 'Text', children: [''] } as never
  })
  return mundo
}
