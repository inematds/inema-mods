export type Quadro = '(o.o)' | '(O.O)' | '(^.^)'

declare module 'claude-code' {
  interface PluginState {
    bichinho: { comidos: number; ultimo: string; ligado: boolean }
  }
}
