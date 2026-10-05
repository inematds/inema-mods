export type Marcador = {
  nome: string
  /** Quando foi marcado (ms desde 1970). */
  hora: number
  /** Quantas mensagens a conversa tinha ao marcar. */
  indice: number
  /** Começo da última resposta do Claude, sem chamar modelo. */
  tldr: string
}

declare module 'claude-code' {
  interface PluginState {
    'marcador-sessao': { cwd: string; marcadores: Marcador[] }
  }
}
