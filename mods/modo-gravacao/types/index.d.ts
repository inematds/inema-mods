export type EstadoGravacao = 'ligado' | 'desligado'

declare module 'claude-code' {
  interface PluginState {
    'modo-gravacao': { ligado: boolean }
  }
}
