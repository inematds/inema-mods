// marcador-sessao — "onde eu estava mesmo?"
// /marcar <nome> guarda um marcador: nome, hora, posição na conversa e um resumo
// (o começo da última resposta do Claude; nenhum modelo é chamado). Os marcadores ficam
// guardados por projeto (pasta) e sobrevivem ao fim da sessão.
// /marcar abrir mostra a lista num painel com [colar no prompt]; /marcar apagar <nome> remove.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionMessage } from 'claude-code'

import type { Marcador } from '../types'

const PAINEL = 'marcador-sessao'
const MAX_MARCADORES = 50
const cwdAtom = atom({ plugin: 'marcador-sessao', key: 'cwd' } as const, '')
const marcadoresAtom = atom({ plugin: 'marcador-sessao', key: 'marcadores' } as const, [])

export const chaveDe = (cwd: string) => `marcadores:${cwd}`

/** Tira aspas em volta e espaços extras: /marcar "antes do deploy" vira antes do deploy. */
export const limparNome = (s: string) =>
  s
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60)

/** Resumo sem modelo: as primeiras `n` letras da última resposta do Claude com texto. */
export const resumoDe = (mensagens: readonly SessionMessage[], n: number) => {
  for (let i = mensagens.length - 1; i >= 0; i--) {
    const m = mensagens[i]
    if (m === undefined || m.role !== 'assistant') continue
    const t = m.text.replace(/\s+/g, ' ').trim()
    if (t.length === 0) continue
    return t.length > n ? `${t.slice(0, n).trimEnd()}…` : t
  }
  return '(ainda sem resposta do Claude)'
}

export const textoParaColar = (m: Marcador) => `Retomando o ponto '${m.nome}': ${m.tldr}`

const dois = (n: number) => String(n).padStart(2, '0')
export const horaCurta = (ms: number) => {
  const d = new Date(ms)
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)} ${dois(d.getHours())}:${dois(d.getMinutes())}`
}

const comoLista = (v: unknown): Marcador[] => (Array.isArray(v) ? (v as Marcador[]) : [])

async function lerDoStore($: EngineInterface, cwd: string) {
  return comoLista(await $.store.get(chaveDe(cwd)).catch(() => undefined))
}

async function gravar($: EngineInterface, cwd: string, lista: Marcador[]) {
  await $.store.set(chaveDe(cwd), lista)
  await update($, marcadoresAtom, () => lista)
}

const AJUDA = [
  'Uso:',
  '  /marcar <nome>          guarda este ponto da conversa',
  '  /marcar abrir           mostra os marcadores deste projeto',
  '  /marcar apagar <nome>   remove um marcador',
].join('\n')

export const register: Register = (on, options) => {
  const n = Number(options.tamanhoResumo)
  const tamanho = Number.isFinite(n) && n >= 20 ? Math.floor(n) : 200

  on('session.start', async ($, e, next) => {
    await update($, cwdAtom, () => e.cwd)
    await $.command.register({
      name: 'marcar',
      description: 'Marcador de sessão (args: <nome> | abrir | apagar <nome>)',
    })
    const lista = await lerDoStore($, e.cwd)
    await update($, marcadoresAtom, () => lista)
    return next(e)
  })

  on('command.run', { command: 'marcar' }, async ($, e) => {
    const cwd = (await read($, cwdAtom)) || (await $.session.cwd())
    const args = e.args.trim()
    const [primeira = '', ...resto] = args.split(/\s+/)
    const verbo = primeira.toLowerCase()
    const lista = await lerDoStore($, cwd)

    if (args === '') {
      const nomes = lista.map(m => `- ${m.nome} (${horaCurta(m.hora)})`)
      return { text: [AJUDA, '', lista.length ? 'Marcadores deste projeto:' : 'Nenhum marcador neste projeto ainda.', ...nomes].join('\n') }
    }

    if (verbo === 'abrir' && resto.length === 0) {
      await update($, marcadoresAtom, () => lista)
      await $.ui.open({ id: PAINEL, title: 'Marcadores' })
      return { text: lista.length ? `${lista.length} marcador(es) neste projeto.` : 'Nenhum marcador neste projeto ainda. Use /marcar <nome>.' }
    }

    if (verbo === 'apagar') {
      const nome = limparNome(resto.join(' '))
      if (nome === '') return { text: 'Diga qual: /marcar apagar <nome>' }
      const sobra = lista.filter(m => m.nome.toLowerCase() !== nome.toLowerCase())
      if (sobra.length === lista.length) return { text: `Não achei o marcador '${nome}'.` }
      await gravar($, cwd, sobra)
      return { text: `Marcador '${nome}' apagado.` }
    }

    const nome = limparNome(args)
    if (nome === '') return { text: AJUDA }
    const mensagens = await $.session.messages()
    const novo: Marcador = { nome, hora: await $.clock.now(), indice: mensagens.length, tldr: resumoDe(mensagens, tamanho) }
    const outros = lista.filter(m => m.nome.toLowerCase() !== nome.toLowerCase())
    const trocou = outros.length !== lista.length
    await gravar($, cwd, [...outros, novo].slice(-MAX_MARCADORES))
    return { text: `Marcador '${nome}' ${trocou ? 'atualizado' : 'guardado'} (mensagem ${novo.indice}). Resumo: ${novo.tldr}` }
  })

  on('ui.render', { component: 'Pane', requestId: PAINEL }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const lista = await read($, marcadoresAtom)

    const colar = async (m: Marcador) => {
      const r = await $.prompt.fill({ text: textoParaColar(m) }).catch(() => undefined)
      $.ui.toast(r?.isFilled === true ? `Resumo de '${m.nome}' colado no prompt.` : 'Não consegui colar no prompt.')
    }

    if (lista.length === 0) {
      return (
        <Box flexDirection="column">
          <Text dimColor>Nenhum marcador neste projeto. Use /marcar nome-do-ponto.</Text>
        </Box>
      )
    }

    const cabe = Math.max(1, Math.floor((e.props.scroll.bodyRows - 1) / 3))
    const mostrar = [...lista].reverse().slice(0, cabe)
    return (
      <Box flexDirection="column">
        {mostrar.map((m, i) => (
          <Box key={`m${i}`} flexDirection="column">
            <Box key={`cab${i}`}>
              <Text bold>{m.nome}</Text>
              <Text dimColor>{`  ${horaCurta(m.hora)} · mensagem ${m.indice}  `}</Text>
              <Button key={`colar${i}`} label="colar no prompt" {...(i < 9 ? { hotkey: String(i + 1) } : {})} plain onPress={() => colar(m)} />
            </Box>
            <Text dimColor wrap="truncate-end">{m.tldr}</Text>
          </Box>
        ))}
        {lista.length > cabe && <Text dimColor>{`… e mais ${lista.length - cabe} (os mais antigos)`}</Text>}
      </Box>
    )
  })
}
