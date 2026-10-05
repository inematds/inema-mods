// Casamento de padrões do vigia (sem $), testado direto.

export const UMA_HORA = 60 * 60_000
export const PREFIXO = 'autorizado:'

/** Padrão de ferramenta com * (qualquer trecho) -> regex inteira, sem diferenciar maiúsculas. */
export const casaFerramenta = (padrao: string, ferramenta: string) => {
  const p = padrao.trim()
  if (p === '') return false
  const corpo = p.replace(/[.+^${}()|[\]\\?]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${corpo}$`, 'i').test(ferramenta)
}

/** Padrão de comando: expressão regular sem diferenciar maiúsculas; se for inválida, trecho literal. */
export const casaComando = (padrao: string, comando: string) => {
  if (padrao.trim() === '') return false
  try {
    return new RegExp(padrao, 'i').test(comando)
  } catch {
    return comando.toLowerCase().includes(padrao.toLowerCase())
  }
}

export type Achado = { padrao: string; nome: string }

/** Qual padrão pago esta chamada casa? `nome` é o que aparece na pergunta. */
export function acharPago(
  ferramenta: string,
  comando: string | undefined,
  ferramentas: readonly string[],
  comandos: readonly string[],
): Achado | undefined {
  if (ferramenta === 'Bash' && comando !== undefined) {
    const p = comandos.find(c => casaComando(c, comando))
    return p === undefined ? undefined : { padrao: p, nome: p.trim() }
  }
  if (!ferramenta.startsWith('mcp__')) return undefined
  const p = ferramentas.find(f => casaFerramenta(f, ferramenta))
  return p === undefined ? undefined : { padrao: p, nome: ferramenta }
}

export const restante = (ate: number, agora: number) => {
  const min = Math.ceil((ate - agora) / 60_000)
  return min <= 1 ? 'menos de 1 min' : `${min} min`
}
