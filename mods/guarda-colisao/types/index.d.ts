export type Contagem = {
  perguntas: number
  prosseguir: number
  pular: number
  cancelar: number
  semTela: number
}

declare module 'claude-code' {
  interface PluginState {
    'guarda-colisao': {
      /** caminho real -> mtime do arquivo logo depois do último toque desta sessão */
      toques: Record<string, number>
      contagem: Contagem
      /** últimos arquivos em que perguntei (mais recente no fim) */
      arquivos: string[]
    }
  }
}
