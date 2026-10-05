// registrar-falha — quando comandos do terminal (Bash) falham várias vezes no mesmo
// turno, aparece uma faixa acima do prompt com o botão [registrar falha no FALHAS.md].
// O botão escreve no prompt o pedido da linha-modelo do changelog de falhas, com a data
// de hoje e o primeiro comando que falhou; a pessoa revisa e envia. /falha abre a faixa
// na mão. O mod não envia nada sozinho e não escreve no FALHAS.md: quem escreve é o Claude,
// depois que a pessoa manda o pedido.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const erros = atom({ plugin: 'registrar-falha', key: 'erros' } as const, 0)
const primeiro = atom({ plugin: 'registrar-falha', key: 'primeiro' } as const, '')
const forcada = atom({ plugin: 'registrar-falha', key: 'forcada' } as const, false)
const dispensada = atom({ plugin: 'registrar-falha', key: 'dispensada' } as const, false)

const LIMITE_COMANDO = 80

// Data AAAA-MM-DD no fuso do ambiente em que o mod roda.
export const dataDe = (ms: number) => {
  const d = new Date(ms)
  const dois = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`
}

// Primeira linha do comando, sem espaços sobrando, cortada em ~80 caracteres.
export const comandoCurto = (comando: string, limite = LIMITE_COMANDO) => {
  const linha = (comando.split('\n').find(l => l.trim() !== '') ?? '').trim().replace(/\s+/g, ' ')
  const multi = comando.trim().includes('\n') ? ' (...)' : ''
  if (linha.length <= limite) return linha + multi
  return linha.slice(0, limite - 3) + '...'
}

export const pedidoDeRegistro = (data: string, comando: string) =>
  `Registre no FALHAS.md uma linha: | ${data} | <o que quebrou> | <menor correção> | prompt | infra | — sobre: ${
    comando === '' ? '<descreva a falha>' : comando
  }`

export const deveMostrar = (n: number, minimo: number, aForca: boolean, dispensou: boolean) =>
  aForca || (!dispensou && n >= minimo)

const minimoDe = (valor: unknown) => {
  const n = Math.floor(Number(valor))
  return Number.isFinite(n) && n >= 1 ? n : 2
}

async function preencher($: EngineInterface) {
  const data = dataDe(await $.clock.now())
  const texto = pedidoDeRegistro(data, await read($, primeiro))
  const r = await $.prompt.fill({ text: texto, mode: 'append' }).catch(() => undefined)
  if (r?.isFilled === true) {
    $.ui.toast('Pedido escrito no prompt: complete o que quebrou e a correção, depois envie.')
  } else {
    $.ui.toast('Não consegui escrever no prompt. Use /falha para ver o pedido.')
  }
  await update($, forcada, () => false)
  await update($, dispensada, () => true)
}

async function dispensar($: EngineInterface) {
  await update($, forcada, () => false)
  await update($, dispensada, () => true)
}

export const register: Register = (on, options) => {
  const minimo = minimoDe(options.erros_minimos)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'falha',
      description: 'Abre a faixa para registrar uma falha no FALHAS.md',
    })
    return next(e)
  })

  // Cada prompt novo é um turno novo: zera a contagem.
  on('prompt.submit', async ($, e, next) => {
    await update($, erros, () => 0)
    await update($, primeiro, () => '')
    await update($, forcada, () => false)
    await update($, dispensada, () => false)
    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const ran = await next(e)
    // `deny` aqui é só a recusa de um plugin acima deste; a recusa de permissão do
    // engine chega como isError e conta (limite documentado no README).
    if (ran.deny === undefined && ran.isError === true) {
      await update($, erros, n => n + 1)
      await update($, primeiro, atual => (atual === '' ? comandoCurto(e.command) : atual))
    }
    return ran
  })

  on('command.run', { command: 'falha' }, async ($, e) => {
    await update($, forcada, () => true)
    await update($, dispensada, () => false)
    const n = await read($, erros)
    const data = dataDe(await $.clock.now())
    return {
      text: [
        `Faixa aberta acima do prompt (${n} comando(s) com erro neste turno).`,
        `Pedido que o botão escreve: ${pedidoDeRegistro(data, await read($, primeiro))}`,
      ].join('\n'),
    }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const n = await read($, erros)
    if (!deveMostrar(n, minimo, await read($, forcada), await read($, dispensada))) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const abaixo = await next(e)
    const aviso = n > 0 ? `${n} comando(s) falharam neste turno.` : 'Registrar uma falha?'
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" gap={1}>
          <Text color="red" wrap="truncate-end">
            {`[!] ${aviso}`}
          </Text>
          <Button key="registrar" label="registrar falha no FALHAS.md" hotkey="r" onPress={() => preencher($)} />
          <Button key="dispensar" label="dispensar" plain hotkey="d" onPress={() => dispensar($)} />
        </Box>
        {abaixo}
      </Box>
    )
  })
}
