// proximos-passos — botões com as opções que o Claude acabou de sugerir.
// Depois de cada resposta, procura no texto uma lista curta de próximos passos
// (sob um título com "próximo", "next", "opções", "sugest..." ou a última lista
// do texto). Achando 2 a 4 itens curtos, mostra até 3 botões acima do prompt;
// cada botão só ESCREVE o pedido no prompt (você revisa e aperta Enter).
// Não chama o modelo: é só leitura do texto. /proximos reabre a faixa.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

const sugestoes = atom({ plugin: 'proximos-passos', key: 'sugestoes' } as const, [])
const visivel = atom({ plugin: 'proximos-passos', key: 'visivel' } as const, false)

const ITEM = /^(\s*)(?:\d{1,2}[.)]|[-*•+]|[a-dA-D][.)])\s+(.+?)\s*$/
const TITULO = /pr[oó]xim|\bnext\b|op[cç](?:[oõ]es|ao|ão)|options|sugest|suggest/i
const MAX_CARACTERES = 160
const MAX_BOTOES = 3

type Item = { recuo: number; texto: string }

const item = (linha: string): Item | undefined => {
  const m = ITEM.exec(linha)
  return m ? { recuo: (m[1] ?? '').length, texto: m[2] ?? '' } : undefined
}

/** Tira marcação Markdown simples e pontuação de fim. */
export const limpar = (s: string) =>
  s
    .replace(/\*\*|__|`/g, '')
    .replace(/^\[[ xX]\]\s*/, '')
    .replace(/\s+/g, ' ')
    .replace(/[;:,]$/, '')
    .trim()

/** Lê a lista a partir da linha `inicio`: itens do mesmo recuo, aceitando linhas em branco entre eles. */
const listaDesde = (linhas: readonly string[], inicio: number): { itens: string[]; fim: number } => {
  const itens: string[] = []
  let recuo: number | undefined
  let i = inicio
  for (; i < linhas.length; i++) {
    const linha = linhas[i] ?? ''
    if (linha.trim() === '') continue
    const it = item(linha)
    if (it === undefined) break
    if (recuo === undefined) recuo = it.recuo
    if (it.recuo > recuo + 1) continue // subitem: ignora
    if (it.recuo < recuo) break
    itens.push(limpar(it.texto))
  }
  return { itens, fim: i }
}

const aceitavel = (itens: readonly string[]) =>
  itens.length >= 2 && itens.length <= 4 && itens.every(t => t.length > 0 && t.length <= MAX_CARACTERES)

/**
 * Acha os próximos passos num texto. Ordem: a ÚLTIMA lista sob um título que
 * fale de próximos passos/opções/sugestões; senão, a última lista do texto
 * (desde que depois dela só venham, no máximo, 2 linhas). Devolve [] se não achar
 * 2 a 4 itens curtos.
 */
export const acharPassos = (texto: string): string[] => {
  const linhas = texto.split(/\r?\n/)
  for (let i = linhas.length - 1; i >= 0; i--) {
    const linha = linhas[i] ?? ''
    if (item(linha) !== undefined || !TITULO.test(linha)) continue
    const { itens } = listaDesde(linhas, i + 1)
    if (itens.length > 0) return aceitavel(itens) ? itens : []
  }
  // Sem título: a última lista do texto.
  let fimDaLista = -1
  for (let i = linhas.length - 1; i >= 0; i--) {
    if (item(linhas[i] ?? '') !== undefined) {
      fimDaLista = i
      break
    }
  }
  if (fimDaLista < 0) return []
  const depois = linhas.slice(fimDaLista + 1).filter(l => l.trim() !== '').length
  if (depois > 2) return []
  let inicio = fimDaLista
  while (inicio > 0) {
    const anterior = linhas[inicio - 1] ?? ''
    if (item(anterior) !== undefined || (anterior.trim() === '' && item(linhas[inicio - 2] ?? '') !== undefined)) inicio--
    else break
  }
  const { itens } = listaDesde(linhas, inicio)
  return aceitavel(itens) ? itens : []
}

/** Texto da última mensagem do assistente (com texto); cai no `answer` do turno. */
async function ultimaResposta($: EngineInterface, reserva: string) {
  const msgs = await $.session.messages().catch(() => [])
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if (m?.role === 'assistant' && m.text.trim() !== '') return m.text
  }
  return reserva
}

async function guardar($: EngineInterface, itens: readonly string[]) {
  await update($, sugestoes, () => itens.slice(0, MAX_BOTOES))
  await update($, visivel, () => itens.length > 0)
}

async function escolher($: EngineInterface, texto: string) {
  await $.prompt.fill({ text: texto })
  await update($, visivel, () => false)
}

const rotulo = (s: string, max: number) => (s.length > max ? `${s.slice(0, Math.max(4, max - 1))}…` : s)

export const register: Register = (on, options) => {
  const automatico = options.ligado !== false

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'proximos', description: 'Mostra de novo os próximos passos da última resposta como botões' })
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    await update($, visivel, () => false)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    if (!automatico || e.agentId !== undefined || e.reason !== 'answer') return r
    await guardar($, acharPassos(await ultimaResposta($, e.answer)))
    return r
  })

  on('command.run', { command: 'proximos' }, async $ => {
    const itens = acharPassos(await ultimaResposta($, ''))
    await guardar($, itens)
    if (itens.length === 0) return { text: 'Não achei uma lista curta de próximos passos (2 a 4 itens) na última resposta.' }
    return { text: `Próximos passos na faixa acima do prompt:\n${itens.slice(0, MAX_BOTOES).map((t, i) => `${i + 1}. ${t}`).join('\n')}` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.props.isWorking || !(await read($, visivel))) return next(e)
    const itens = await read($, sugestoes)
    if (itens.length === 0) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    // Os botões quebram linha (flexWrap): cada rótulo pode usar até metade da largura.
    const max = Math.max(20, Math.floor(e.props.bodyColumns / 2))
    const abaixo = await next(e)
    return (
      <Box flexDirection="column">
        <Box key="proximos" flexWrap="wrap">
          <Text dimColor>próximos passos: </Text>
          {itens.map((t, i) => (
            <Button key={`passo${i + 1}`} label={rotulo(t, max)} hotkey={String(i + 1)} onPress={() => escolher($, t)} />
          ))}
          <Button key="dispensar" label="dispensar" plain onPress={() => update($, visivel, () => false)} />
        </Box>
        {abaixo}
      </Box>
    )
  })
}
