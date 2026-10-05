export type Frase = string

declare module 'claude-code' {
  interface PluginState {
    'tradutor-acoes': { ligado: boolean }
  }
}
