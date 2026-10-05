// vigia-api — pergunta antes de ferramentas MCP e comandos Bash que gastam dinheiro
// ou créditos. "Autorizar por 1 hora" fica guardado no $.store (vale para lotes).
// /vigia lista as autorizações ativas; /vigia limpar apaga todas.
import type { EngineInterface, Register } from 'claude-code'

import { acharPago, PREFIXO, restante, UMA_HORA } from './regras'
import type { Achado } from './regras'

const SO_ESTA = 'Autorizar só esta vez'
const POR_HORA = 'Autorizar por 1 hora'
const NEGAR = 'Negar'

type Autorizacao = { ate: number; nome: string }

const lerAutorizacao = (v: unknown): Autorizacao | undefined => {
  if (typeof v !== 'object' || v === null) return undefined
  const { ate, nome } = v as { ate?: unknown; nome?: unknown }
  return typeof ate === 'number' ? { ate, nome: typeof nome === 'string' ? nome : '' } : undefined
}

async function autorizadoAgora($: EngineInterface, padrao: string) {
  const a = lerAutorizacao(await $.store.get(PREFIXO + padrao).catch(() => undefined))
  return a !== undefined && a.ate > (await $.clock.now())
}

/** Devolve `{ deny }` para barrar, ou undefined para deixar seguir. */
async function vigiar($: EngineInterface, achado: Achado): Promise<{ deny: string } | undefined> {
  if (await autorizadoAgora($, achado.padrao)) return undefined
  const resposta = await $.ui
    .ask(`Isso usa serviço pago (${achado.nome}). Autoriza agora?`, {
      header: 'API paga',
      options: [NEGAR, SO_ESTA, POR_HORA],
    })
    .catch(() => undefined)
  if (resposta === undefined) {
    return {
      deny:
        `vigia-api: "${achado.nome}" usa serviço pago e não há ninguém na tela para autorizar. ` +
        'Não tente por outro caminho: peça autorização ao usuário em texto, dizendo qual serviço e para quê. ' +
        `Ele pode liberar com /vigia autorizar ${achado.padrao.trim()}`,
    }
  }
  if (resposta === SO_ESTA) return undefined
  if (resposta === POR_HORA) {
    const ate = (await $.clock.now()) + UMA_HORA
    await $.store.set(PREFIXO + achado.padrao, { ate, nome: achado.nome })
    return undefined
  }
  // "Negar" ou texto livre: não roda.
  return {
    deny: `vigia-api: o usuário NÃO autorizou o uso de "${achado.nome}" (serviço pago). Não tente por outro caminho; pergunte ao usuário como seguir.`,
  }
}

async function listar($: EngineInterface) {
  const agora = await $.clock.now()
  const linhas: string[] = []
  for (const chave of await $.store.keys()) {
    if (!chave.startsWith(PREFIXO)) continue
    const a = lerAutorizacao(await $.store.get(chave))
    if (!a || a.ate <= agora) {
      await $.store.delete(chave)
      continue
    }
    linhas.push(`  - ${chave.slice(PREFIXO.length)} (${a.nome}): falta ${restante(a.ate, agora)}`)
  }
  if (linhas.length === 0) return 'Vigia de API: nenhuma autorização ativa. Cada uso pago vai perguntar.'
  return ['Vigia de API: autorizações ativas (valem para todas as sessões abertas):', ...linhas, '/vigia limpar apaga todas.'].join('\n')
}

async function limpar($: EngineInterface) {
  let n = 0
  for (const chave of await $.store.keys()) {
    if (!chave.startsWith(PREFIXO)) continue
    await $.store.delete(chave)
    n++
  }
  return n === 0 ? 'Vigia de API: nada para limpar.' : `Vigia de API: ${n} autorização(ões) apagada(s). Cada uso pago volta a perguntar.`
}

export const register: Register = (on, options) => {
  const ferramentas = Array.isArray(options.ferramentas_pagas) ? options.ferramentas_pagas : []
  const comandos = Array.isArray(options.comandos_pagos) ? options.comandos_pagos : []

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'vigia',
      description: 'Vigia de API paga: autorizações ativas (args: limpar | autorizar <padrão>)',
    })
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const achado = acharPago(e.tool, e.tool === 'Bash' ? e.command : undefined, ferramentas, comandos)
    if (achado) {
      const barrar = await vigiar($, achado)
      if (barrar) return barrar
    }
    return next(e)
  })

  on('command.run', { command: 'vigia' }, async ($, e) => {
    const [acao = '', ...resto] = e.args.trim().split(/\s+/)
    if (acao.toLowerCase() === 'limpar') return { text: await limpar($) }
    if (acao.toLowerCase() === 'autorizar') {
      const alvo = resto.join(' ')
      const padrao = [...ferramentas, ...comandos].find(p => p.trim() === alvo)
      if (padrao === undefined) {
        return { text: `Vigia de API: "${alvo}" não está nas listas. Use um padrão exatamente como aparece no /config.` }
      }
      await $.store.set(PREFIXO + padrao, { ate: (await $.clock.now()) + UMA_HORA, nome: alvo })
      return { text: `Vigia de API: "${alvo}" autorizado por 1 hora.` }
    }
    return { text: await listar($) }
  })
}
