// Mundo em memória por baixo do mod: arquivos, comandos, painéis, toasts, processos.
// Cópia de mods/recibo-sessao/tests/mundo.ts com acréscimos: store real em memória
// (mundo.store, que o teste lê direto: o `$` do teste não tem `store`), relógio devolvido, fs.list/fs.stat de pastas, session.messages e ui.copy.
// Um mod não importa nada de fora da própria pasta, por isso cada mod tem a sua cópia.
import type { On, SessionMessage } from 'claude-code'
import { mock } from 'claude-code/testing'

export type Mundo = {
  arquivos: Map<string, { texto: string; mtime: number; tamanho?: number }>
  comandos: string[]
  abertos: string[]
  toasts: string[]
  status: (string | undefined)[]
  preenchidos: string[]
  copiados: string[]
  rodados: string[][]
  listados: string[]
  store: Map<string, unknown>
  mensagens: SessionMessage[]
  saidaProcesso: (argv: readonly string[]) => { exitCode: number; stdout: string; stderr?: string }
  relogio: ReturnType<typeof mock.clock>
}

export const SESSAO = { surface: 'terminal' as const, isInteractive: true, cwd: '/work' }

export const prompt = (text: string) => ({ text, origin: { kind: 'composer' as const }, wait: false })

export const comando = (nome: string, args = '') => ({
  command: nome,
  args,
  origin: { kind: 'composer' as const },
  presentation: { isFullscreen: true, columns: 180 },
})

/** Props de um Pane docado, para `$.ui.mount`. */
export const PANE_PROPS = {
  title: 'teste',
  isFocused: true,
  bodyColumns: 72,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
}
export const VIEWPORT = { columns: 180, rows: 48, isFullscreen: true }

export type Opcoes = { agora?: number; store?: Record<string, unknown>; sessao?: string }

export function mundoDe(on: On, arquivos: Record<string, string> = {}, opcoes: Opcoes = {}): Mundo {
  const mundo: Mundo = {
    arquivos: new Map(Object.entries(arquivos).map(([k, v]) => [k, { texto: v, mtime: 1_000 }])),
    comandos: [],
    abertos: [],
    toasts: [],
    status: [],
    preenchidos: [],
    copiados: [],
    rodados: [],
    listados: [],
    store: new Map(Object.entries(opcoes.store ?? {})),
    mensagens: [],
    saidaProcesso: () => ({ exitCode: 0, stdout: '' }),
    relogio: mock.clock(on, { now: opcoes.agora ?? 0 }),
  }

  // Store em memória (JSON de ida e volta, como o engine faz).
  on('store.get', ($, e) => ({ value: mundo.store.has(e.key) ? JSON.parse(JSON.stringify(mundo.store.get(e.key))) : undefined }))
  on('store.set', ($, e) => {
    mundo.store.set(e.key, JSON.parse(JSON.stringify(e.value)))
    return { value: undefined }
  })
  on('store.delete', ($, e) => {
    mundo.store.delete(e.key)
    return { value: undefined }
  })
  on('store.keys', () => ({ value: [...mundo.store.keys()] }))
  const ehPasta = (p: string) => {
    const pref = p.endsWith('/') ? p : `${p}/`
    for (const k of mundo.arquivos.keys()) if (k.startsWith(pref)) return true
    return false
  }
  const tamanhoDe = (f: { texto: string; tamanho?: number }) => f.tamanho ?? f.texto.length

  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('prompt.submit', ($, e) => ({ text: e.text, ...(e.context !== undefined && { context: e.context }) }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  on('session.id', () => ({ value: opcoes.sessao ?? 's1' }))
  on('session.cwd', () => ({ value: SESSAO.cwd }))
  on('session.messages', () => ({ value: mundo.mensagens }) as never)
  on('fs.exists', ($, e) => ({ value: mundo.arquivos.has(e.path) || ehPasta(e.path) }))
  on('fs.stat', ($, e) => {
    const f = mundo.arquivos.get(e.path)
    if (f) return { value: { kind: 'file' as const, size: tamanhoDe(f), mtimeMs: f.mtime, isLink: false, realPath: e.path } }
    if (ehPasta(e.path)) return { value: { kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false, realPath: e.path } }
    return { deny: `ENOENT: ${e.path}` }
  })
  on('fs.read', ($, e) => {
    const f = mundo.arquivos.get(e.path)
    return f ? { value: f.texto } : { deny: `ENOENT: ${e.path}` }
  })
  on('fs.list', ($, e) => {
    mundo.listados.push(e.path)
    const dir = e.path.endsWith('/') ? e.path.slice(0, -1) : e.path
    if (!ehPasta(dir)) return { deny: `ENOENT: ${e.path}` }
    const nomes = new Map<string, 'file' | 'dir'>()
    for (const k of mundo.arquivos.keys()) {
      if (!k.startsWith(`${dir}/`)) continue
      const resto = k.slice(dir.length + 1)
      nomes.set(resto.split('/')[0] ?? '', resto.includes('/') ? 'dir' : 'file')
    }
    return {
      value: [...nomes.entries()].sort().map(([name, kind]) => {
        const f = mundo.arquivos.get(`${dir}/${name}`)
        return {
          name,
          kind,
          size: kind === 'file' && f ? tamanhoDe(f) : 0,
          mtimeMs: kind === 'file' && f ? f.mtime : 0,
          isLink: false,
        }
      }),
    }
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
  on('ui.copy', ($, e) => {
    mundo.copiados.push(e.text)
    return { value: { isCopied: true as const } }
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
