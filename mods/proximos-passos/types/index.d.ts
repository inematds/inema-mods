/** Um próximo passo achado na resposta (o texto que o botão escreve no prompt). */
export type Sugestao = string

declare module 'claude-code' {
  interface PluginState {
    'proximos-passos': {
      /** Até 3 itens achados na última resposta. */
      sugestoes: Sugestao[]
      visivel: boolean
    }
  }
}
