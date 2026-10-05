/** off = desligado; on = segue o mapa do /config; sonnet/haiku/opus = força todos. */
export type Modo = 'off' | 'on' | 'sonnet' | 'haiku' | 'opus'

declare module 'claude-code' {
  interface PluginState {
    'roteador-subagente': {
      modo: Modo
      /** Subagentes que o roteador mandou para outro modelo: id -> modelo. */
      roteados: Record<string, string>
      /** Tokens (entrada + saída + cache) dos subagentes roteados, por modelo. */
      tokens: Record<string, number>
      /** Tokens de saída dos subagentes roteados, por modelo. */
      saida: Record<string, number>
    }
  }
}
