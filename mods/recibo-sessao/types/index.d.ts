export type Entrada = {
  caminho: string
  acao: 'criado' | 'editado'
  turno: number
  hora: number
}

declare module 'claude-code' {
  interface PluginState {
    'recibo-sessao': { entradas: Entrada[]; turno: number }
  }
}
