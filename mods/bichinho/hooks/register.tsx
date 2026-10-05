// bichinho — um bichinho ASCII acima do prompt que "come" os arquivos que o Claude
// lê, edita ou cria. A cada Read/Edit/Write que deu certo ele mastiga (troca de quadro)
// e soma "arquivos comidos: N". /bichinho off esconde, /bichinho on mostra de novo.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const comidos = atom({ plugin: 'bichinho', key: 'comidos' } as const, 0)
const ultimo = atom({ plugin: 'bichinho', key: 'ultimo' } as const, '')
const ligado = atom({ plugin: 'bichinho', key: 'ligado' } as const, true)

const CHAVE_LIGADO = 'ligado'

export const QUADROS = ['(o.o)', '(O.O)', '(^.^)'] as const

// Quadro que aparece depois de N arquivos comidos: parado em (o.o) antes do primeiro,
// depois gira entre os três a cada mordida.
export const quadroDe = (n: number): string => QUADROS[n % QUADROS.length] ?? QUADROS[0]

export const nomeDe = (caminho: string) => caminho.slice(caminho.lastIndexOf('/') + 1)

export const linhaDoBichinho = (n: number, ultimoArquivo: string) => {
  const boca = n === 0 ? 'com fome...' : 'nhac!'
  const fim = ultimoArquivo ? `  (último: ${ultimoArquivo})` : ''
  return `${quadroDe(n)} ${boca} arquivos comidos: ${n}${fim}`
}

async function comer($: EngineInterface, caminho: string) {
  await update($, comidos, n => n + 1)
  await update($, ultimo, () => nomeDe(caminho))
}

async function carregarLigado($: EngineInterface) {
  const salvo = await $.store.get(CHAVE_LIGADO).catch(() => undefined)
  await update($, ligado, () => salvo !== false)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await carregarLigado($)
    await $.command.register({
      name: 'bichinho',
      description: 'Bichinho que come arquivos acima do prompt (args: on | off)',
    })
    return next(e)
  })

  on('tool.call', { tool: 'Read' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) await comer($, e.file_path)
    return ran
  })

  on('tool.call', { tool: 'Edit' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) await comer($, e.file_path)
    return ran
  })

  on('tool.call', { tool: 'Write' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && ran.isError !== true) await comer($, e.file_path)
    return ran
  })

  on('command.run', { command: 'bichinho' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'off' || arg === 'on') {
      const valor = arg === 'on'
      await update($, ligado, () => valor)
      await $.store.set(CHAVE_LIGADO, valor)
      return { text: valor ? 'Bichinho acordado.' : 'Bichinho foi dormir (use /bichinho on para acordar).' }
    }
    const n = await read($, comidos)
    return { text: `${linhaDoBichinho(n, await read($, ultimo))}\nUse /bichinho off para esconder, /bichinho on para mostrar.` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !(await read($, ligado))) return next(e)
    const n = await read($, comidos)
    const fim = await read($, ultimo)
    const { Box, Text } = $.ui.resolve(e)
    const abaixo = await next(e)
    return (
      <Box flexDirection="column">
        <Box key="bichinho">
          <Text color="green" wrap="truncate-end">
            {linhaDoBichinho(n, fim)}
          </Text>
        </Box>
        {abaixo}
      </Box>
    )
  })
}
