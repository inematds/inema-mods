export type ItemPlano = { texto: string; feito: boolean | null }

export type Checklist = {
  /** De onde vieram os itens: caixas do plan.md, caixas do goal.md, ou passos numerados do plan.md (sem %). */
  fonte: 'plan' | 'goal' | 'passos' | 'nenhuma'
  itens: ItemPlano[]
}

export type ResumoLongrun = {
  pasta: string
  nome: string
  objetivo: string
  /** Início em ms (goal.md "Início:" ou data no nome da pasta); null se não deu para saber. */
  inicio: number | null
  checklist: Checklist
  progresso: string[]
  canal: string[]
  /** Quando foi lido (ms). */
  lidoEm: number
}

export type RegistroSessao = {
  sessionId: string
  cwd: string
  pasta: string
  objetivo: string
  feitos: number
  total: number
  visto: number
}

declare module 'claude-code' {
  interface PluginState {
    'painel-longrun': { cwd: string; resumo: ResumoLongrun | null; procurouEm: string }
  }
}
