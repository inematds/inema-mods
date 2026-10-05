// recibo-sessao — "o que o Claude criou ou mudou nesta sessão?"
// /recibo abre um painel com a lista; /recibo ultimo mostra só o último turno;
// /recibo limpar zera. Botão [abrir pasta] abre a pasta do arquivo no gerenciador.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Entrada } from '../types'

const PAINEL = 'recibo-sessao'
const entradas = atom({ plugin: 'recibo-sessao', key: 'entradas' } as const, [])
const turno = atom({ plugin: 'recibo-sessao', key: 'turno' } as const, 0)

const pastaDe = (caminho: string) => {
  const i = caminho.lastIndexOf('/')
  return i > 0 ? caminho.slice(0, i) : caminho
}

const nomeDe = (caminho: string) => caminho.slice(caminho.lastIndexOf('/') + 1)

export const resumo = (lista: readonly Entrada[]) => {
  const unicos = new Map<string, Entrada>()
  for (const item of lista) {
    const antes = unicos.get(item.caminho)
    // Um arquivo criado e depois editado continua "criado".
    unicos.set(item.caminho, antes?.acao === 'criado' ? { ...item, acao: 'criado' } : item)
  }
  return [...unicos.values()]
}

export const textoDoRecibo = (lista: readonly Entrada[], titulo: string) => {
  const itens = resumo(lista)
  if (itens.length === 0) return `${titulo}: nenhum arquivo criado ou alterado.`
  const criados = itens.filter(i => i.acao === 'criado').length
  const linhas = itens.map(i => `- ${i.acao === 'criado' ? 'criado ' : 'editado'}  ${i.caminho}`)
  return [`${titulo}: ${criados} criado(s), ${itens.length - criados} editado(s)`, ...linhas].join('\n')
}

async function registrar($: EngineInterface, caminho: string, acao: Entrada['acao']) {
  const n = await read($, turno)
  const hora = await $.clock.now()
  await update($, entradas, lista => [...lista, { caminho, acao, turno: n, hora }].slice(-500))
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'recibo',
      description: 'Recibo da sessão: arquivos criados/alterados (args: ultimo | limpar)',
    })
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await update($, turno, n => n + 1)
    return next(e)
  })

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const existia = await $.fs.exists(e.file_path).catch(() => false)
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) {
      await registrar($, e.file_path, existia ? 'editado' : 'criado')
    }
    return ran
  })

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) await registrar($, e.file_path, 'editado')
    return ran
  })

  on('tool.call', { tool: 'NotebookEdit' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) await registrar($, e.notebook_path, 'editado')
    return ran
  })

  on('command.run', { command: 'recibo' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'limpar') {
      await update($, entradas, () => [])
      return { text: 'Recibo zerado.' }
    }
    if (arg === 'ultimo' || arg === 'último') {
      const n = await read($, turno)
      const lista = (await read($, entradas)).filter(i => i.turno === n || i.turno === n - 1)
      return { text: textoDoRecibo(lista, 'Último turno') }
    }
    await $.ui.open({ id: PAINEL, title: 'Recibo da sessão' })
    return { text: textoDoRecibo(await read($, entradas), 'Nesta sessão') }
  })

  on('ui.render', { component: 'Pane', requestId: PAINEL }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const itens = resumo(await read($, entradas))
    const cabe = Math.max(1, (e.viewport?.rows ?? 24) - 6)
    const abridor = String(options.abridor ?? 'xdg-open')

    const abrir = async (pasta: string) => {
      const r = await $.process.run([abridor, pasta]).catch(() => undefined)
      $.ui.toast(r && r.exitCode === 0 ? `Abrindo ${pasta}` : `Não consegui abrir ${pasta} com ${abridor}`)
    }

    return (
      <Box flexDirection="column">
        {itens.length === 0 && <Text dimColor>Nada criado ou alterado ainda.</Text>}
        {itens.slice(-cabe).map((item, i) => (
          <Box key={`l${i}`}>
            <Text color={item.acao === 'criado' ? 'green' : 'yellow'}>
              {item.acao === 'criado' ? '+ ' : '~ '}
            </Text>
            <Text>{nomeDe(item.caminho)} </Text>
            <Text dimColor>{pastaDe(item.caminho)} </Text>
            <Button key={`abrir${i}`} label="abrir pasta" plain onPress={() => abrir(pastaDe(item.caminho))} />
          </Box>
        ))}
        {itens.length > cabe && <Text dimColor>… e mais {itens.length - cabe} (use /recibo para a lista completa)</Text>}
      </Box>
    )
  })
}
