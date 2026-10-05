export type Parada = {
  hora: number
  comando: string
  /** o que o usuário escolheu (ou "sem tela") */
  decisao: string
  /** resumo do estrago medido */
  resumo: string
}

declare module 'claude-code' {
  interface PluginState {
    'freio-de-mao': { paradas: Parada[] }
  }
}
