export type Passo = {
  ferramenta: string
  caminho: string
  /** Diff unificado já cortado para caber no painel. */
  diff: string
  /** Diff inteiro (até um teto), o que o botão copiar leva. */
  completo: string
  /** Linhas que ficaram fora do painel. */
  ocultas: number
  /** Índice da mensagem na conversa. */
  mensagem: number
}

declare module 'claude-code' {
  interface PluginState {
    'replay-edicoes': { passos: Passo[]; indice: number }
  }
}
