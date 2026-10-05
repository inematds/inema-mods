export type Tokens = {
  entrada: number
  saida: number
  cacheLido: number
  cacheEscrito: number
}

/** Um turno da conversa principal, como a linha do tempo guarda. */
export type Turno = {
  n: number
  /** Começo do pedido (até 60 caracteres). */
  pedido: string
  modelo: string
  esforco: string
  /** Quantas chamadas ao modelo o turno fez (turn.step). */
  passos: number
  /** Chamadas de ferramenta por tipo: Bash, Edit, MCP, Agent... */
  ferramentas: Record<string, number>
  tokens: Tokens | null
  duracaoMs: number
  interrompido: boolean
}

/** O que já se sabe de um turno que ainda está rodando. */
export type Parcial = Omit<Turno, 'n' | 'tokens' | 'duracaoMs' | 'interrompido'>

declare module 'claude-code' {
  interface PluginState {
    'linha-do-tempo': {
      turnos: Turno[]
      abertos: Record<string, Parcial>
      contador: number
    }
  }
}
