export type Modo = 'arquivos' | 'bytes'

export type LinhaMapa = {
  pasta: string
  arquivos: number
  bytes: number
}

export type Varredura = {
  raiz: string
  linhas: LinhaMapa[]
  totalArquivos: number
  totalBytes: number
  cortado: boolean
  hora: number
}

declare module 'claude-code' {
  interface PluginState {
    'mapa-calor': { modo: Modo; varredura: Varredura | null; cwd: string }
  }
}
