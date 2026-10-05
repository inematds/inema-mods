export type ContagemDoTurno = { erros: number; primeiro: string }

declare module 'claude-code' {
  interface PluginState {
    'registrar-falha': { erros: number; primeiro: string; forcada: boolean; dispensada: boolean }
  }
}
