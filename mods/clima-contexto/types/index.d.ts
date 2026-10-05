export type Limite = { kind: string; percentUsed: number }

/** O que a faixa desenha do uso da sessão (copiado de $.session.usage / session.measure). */
export type Retrato = {
  percent: number
  tokens: number
  janela: number
  limites: Limite[]
  usd?: number
}

declare module 'claude-code' {
  interface PluginState {
    'clima-contexto': {
      retrato: Retrato | null
      /** % do contexto ao fim de cada turno (últimos 12). */
      historico: number[]
      /** Quanto o contexto cresceu no último turno (tokens); null antes do 2º turno. */
      somaUltimo: number | null
      /** Tokens do contexto no fim do último turno (para calcular a soma do próximo). */
      tokensUltimo: number | null
      /** Hora ($.clock.now) do fim do último turno: base da estimativa do cache. */
      horaUltimo: number | null
      /** Limiares já avisados (toast) e ainda acima do uso atual. */
      avisados: number[]
      escondido: boolean
      ligado: boolean
      handoffFeito: boolean
    }
  }
}
