export type NomeDeCor = 'ambar' | 'amarelo' | 'ciano' | 'magenta' | 'verde' | 'azul'

declare module 'claude-code' {
  interface PluginState {
    'tema-inema': { ligado: boolean; projeto: string; hora: string }
  }
}
