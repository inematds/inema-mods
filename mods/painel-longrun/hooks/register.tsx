// painel-longrun — "como vai a execução longa?"
// /longrun abre um painel com a execução mais recente em longrun/<data>-<nome>/ do projeto:
// objetivo, tempo desde o início, checklist com % e barra, últimas linhas do progresso e
// do canal. Relê os arquivos sozinho a cada 30 s (só lê; nunca escreve na pasta longrun).
// Cada sessão com execução ativa se registra no store do mod: /longrun todas lista as outras.
import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Checklist, ItemPlano, RegistroSessao, ResumoLongrun } from '../types'

const PAINEL = 'painel-longrun'
const PREFIXO = 'sessao:'
const UM_DIA = 24 * 60 * 60 * 1000
const cwdAtom = atom({ plugin: 'painel-longrun', key: 'cwd' } as const, '')
const resumoAtom = atom({ plugin: 'painel-longrun', key: 'resumo' } as const, null)
const procurouAtom = atom({ plugin: 'painel-longrun', key: 'procurouEm' } as const, '')

// ---------- leitura dos .md (funções puras, testadas) ----------

const linhasDe = (t: string) => t.replace(/\r\n?/g, '\n').split('\n')

/** Objetivo: 1ª linha útil de "## Resultado"; senão a 1ª linha que não é título nem metadado. */
export const objetivoDe = (goal: string) => {
  const linhas = linhasDe(goal).map(l => l.trim())
  const util = (l: string) => l !== '' && !l.startsWith('#') && !l.startsWith('<') && !l.startsWith('- **') && !l.startsWith('<!--')
  const i = linhas.findIndex(l => /^##\s+(resultado|objetivo)/i.test(l))
  if (i >= 0) {
    for (const l of linhas.slice(i + 1)) {
      if (l.startsWith('#')) break
      if (util(l)) return l
    }
  }
  const outra = linhas.find(util)
  if (outra !== undefined) return outra
  const titulo = linhas.find(l => l.startsWith('#'))
  return titulo ? titulo.replace(/^#+\s*/, '') : '(goal.md sem objetivo escrito)'
}

/** Início: "**Início:** AAAA-MM-DD HH:MM" no goal.md; senão a data do nome da pasta. Hora local. */
export const inicioDe = (goal: string, nomePasta: string): number | null => {
  const m = /In[ií]cio:?\**:?\s*(\d{4})-(\d{2})-(\d{2})(?:[ T]+(\d{1,2}):(\d{2}))?/i.exec(goal)
  const d = m ?? /^(\d{4})-(\d{2})-(\d{2})/.exec(nomePasta)
  if (!d) return null
  const [, a, me, di, h, mi] = d
  const t = new Date(Number(a), Number(me) - 1, Number(di), Number(h ?? 0), Number(mi ?? 0)).getTime()
  return Number.isFinite(t) ? t : null
}

const CAIXA = /^\s*[-*]\s+\[([ xX])\]\s+(.*)$/
const NUMERADO = /^\s*\d+[.)]\s+(.*\S.*)$/

export const caixasDe = (texto: string): ItemPlano[] =>
  linhasDe(texto).flatMap(l => {
    const m = CAIXA.exec(l)
    return m ? [{ texto: (m[2] ?? '').trim(), feito: (m[1] ?? ' ') !== ' ' }] : []
  })

/** Checklist: caixas do plan.md; senão caixas do goal.md; senão passos numerados do plan.md (sem %). */
export const checklistDe = (plan: string, goal: string): Checklist => {
  const p = caixasDe(plan)
  if (p.length > 0) return { fonte: 'plan', itens: p }
  const g = caixasDe(goal)
  if (g.length > 0) return { fonte: 'goal', itens: g }
  const passos = linhasDe(plan).flatMap(l => {
    const m = NUMERADO.exec(l)
    return m ? [{ texto: (m[1] ?? '').trim(), feito: null }] : []
  })
  return passos.length > 0 ? { fonte: 'passos', itens: passos } : { fonte: 'nenhuma', itens: [] }
}

export const contagem = (c: Checklist) => {
  const comCaixa = c.itens.filter(i => i.feito !== null)
  const feitos = comCaixa.filter(i => i.feito === true).length
  return { feitos, total: comCaixa.length, pct: comCaixa.length ? Math.round((feitos / comCaixa.length) * 100) : null }
}

/** Últimas `n` linhas de conteúdo do progress.md (linhas da tabela, sem cabeçalho/separador). */
export const ultimasDoProgresso = (texto: string, n = 3) => {
  const tabela = linhasDe(texto).filter(l => l.trim().startsWith('|'))
  const corpo = tabela.filter((l, i) => i > 0 && !/^\|[\s|:-]+\|?$/.test(l.trim()))
  const linhas = corpo.length > 0 ? corpo : linhasDe(texto).filter(l => /^\s*[-*]\s+\S/.test(l))
  return linhas.slice(-n).map(l => {
    if (!l.trim().startsWith('|')) return l.trim().replace(/^[-*]\s+/, '')
    const celulas = l.split('|').map(c => c.trim()).filter(c => c !== '')
    return celulas.slice(0, 2).join(' · ')
  })
}

/** Últimas `n` entradas do canal.md (linhas que começam com "- "). */
export const ultimasDoCanal = (texto: string, n = 3) =>
  linhasDe(texto)
    .filter(l => /^\s*-\s+\S/.test(l))
    .slice(-n)
    .map(l => l.trim().replace(/^-\s+/, ''))

export const duracao = (ms: number) => {
  const min = Math.max(0, Math.floor(ms / 60_000))
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 48) return `${h} h ${min % 60} min`
  return `${Math.floor(h / 24)} d ${h % 24} h`
}

export const barra = (pct: number, largura: number) => {
  const w = Math.max(4, largura)
  const cheias = Math.round((Math.min(100, Math.max(0, pct)) / 100) * w)
  return `${'█'.repeat(cheias)}${'░'.repeat(w - cheias)}`
}

// ---------- arquivos ----------

const juntar = (a: string, b: string) => (a.endsWith('/') ? `${a}${b}` : `${a}/${b}`)
const nomeDe = (p: string) => p.replace(/\/+$/, '').slice(p.replace(/\/+$/, '').lastIndexOf('/') + 1)

async function lerTexto($: EngineInterface, caminho: string) {
  return $.fs.read(caminho).catch(() => '')
}

/** A pasta da execução: a fixada nas opções, ou a mais recente (pelo nome) em <cwd>/longrun/. */
async function acharPasta($: EngineInterface, cwd: string, fixa: string): Promise<string | null> {
  const base = fixa !== '' ? fixa : cwd
  if (fixa !== '' && (await $.fs.exists(juntar(fixa, 'goal.md')).catch(() => false))) return fixa
  const dir = juntar(base, 'longrun')
  const itens = await $.fs.list(dir).catch(() => [])
  const pastas = itens
    .filter(i => i.kind === 'dir')
    .map(i => i.name)
    .sort()
    .reverse()
  for (const nome of pastas) {
    if (await $.fs.exists(juntar(juntar(dir, nome), 'goal.md')).catch(() => false)) return juntar(dir, nome)
  }
  return null
}

async function lerResumo($: EngineInterface, pasta: string): Promise<ResumoLongrun> {
  const [goal, plan, progress, canal] = await Promise.all(
    ['goal.md', 'plan.md', 'progress.md', 'canal.md'].map(f => lerTexto($, juntar(pasta, f))),
  )
  const nome = nomeDe(pasta)
  return {
    pasta,
    nome,
    objetivo: objetivoDe(goal ?? ''),
    inicio: inicioDe(goal ?? '', nome),
    checklist: checklistDe(plan ?? '', goal ?? ''),
    progresso: ultimasDoProgresso(progress ?? ''),
    canal: ultimasDoCanal(canal ?? ''),
    lidoEm: await $.clock.now(),
  }
}

/** Relê tudo, grava no $.state e registra esta sessão no store. Chamado pelo relógio e pelos comandos. */
async function atualizar($: EngineInterface, fixa: string) {
  const cwd = (await read($, cwdAtom)) || (await $.session.cwd())
  const pasta = await acharPasta($, cwd, fixa)
  await update($, procurouAtom, () => (fixa !== '' ? fixa : juntar(cwd, 'longrun')))
  const resumo = pasta === null ? null : await lerResumo($, pasta)
  await update($, resumoAtom, () => resumo)
  const id = await $.session.id().catch(() => '')
  if (id !== '' && resumo !== null) {
    const c = contagem(resumo.checklist)
    const reg: RegistroSessao = { sessionId: id, cwd, pasta: resumo.pasta, objetivo: resumo.objetivo, feitos: c.feitos, total: c.total, visto: resumo.lidoEm }
    await $.store.set(`${PREFIXO}${id}`, reg).catch(() => undefined)
  } else if (id !== '') {
    await $.store.delete(`${PREFIXO}${id}`).catch(() => undefined)
  }
  return resumo
}

/** Lê os registros de todas as sessões; apaga os parados há mais de um dia. */
async function registros($: EngineInterface): Promise<RegistroSessao[]> {
  const agora = await $.clock.now()
  const chaves = (await $.store.keys().catch(() => [] as string[])).filter(k => k.startsWith(PREFIXO))
  const lista: RegistroSessao[] = []
  for (const k of chaves) {
    const r = (await $.store.get(k).catch(() => undefined)) as RegistroSessao | undefined
    if (!r || typeof r.visto !== 'number') continue
    if (agora - r.visto > UM_DIA) {
      await $.store.delete(k).catch(() => undefined)
      continue
    }
    lista.push(r)
  }
  return lista.sort((a, b) => b.visto - a.visto)
}

export const textoDoResumo = (r: ResumoLongrun | null, comoCriar: string, procurouEm: string) => {
  if (r === null) return `Nenhuma execução longa em ${procurouEm || 'longrun/'}.\nPara começar: ${comoCriar}`
  const c = contagem(r.checklist)
  const tempo = r.inicio === null ? 'início desconhecido' : `há ${duracao(r.lidoEm - r.inicio)}`
  const plano = c.pct === null ? `${r.checklist.itens.length} passo(s) no plano` : `${c.feitos}/${c.total} (${c.pct}%)`
  return `${r.nome} · ${tempo} · ${plano}\nObjetivo: ${r.objetivo}`
}

export const register: Register = (on, options) => {
  const fixa = String(options.pasta ?? '').trim()
  const seg = Number(options.intervalo)
  const intervalo = (Number.isFinite(seg) && seg >= 5 ? seg : 30) * 1000
  const comoCriar = String(options.comoCriar ?? '').trim() || 'crie longrun/<AAAA-MM-DD>-<nome>/ com goal.md, plan.md, state.md, progress.md e canal.md'

  on('session.start', async ($, e, next) => {
    await update($, cwdAtom, () => e.cwd)
    await $.command.register({
      name: 'longrun',
      description: 'Painel da execução longa (args: todas | atualizar)',
    })
    await atualizar($, fixa).catch(() => null)
    $.clock.every(intervalo, () => {
      void atualizar($, fixa).catch(() => null)
    })
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    await $.store.delete(`${PREFIXO}${e.sessionId}`).catch(() => undefined)
    return next(e)
  })

  on('command.run', { command: 'longrun' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg === 'todas' || arg === 'todos') {
      await atualizar($, fixa).catch(() => null)
      const agora = await $.clock.now()
      const eu = await $.session.id().catch(() => '')
      const lista = await registros($)
      if (lista.length === 0) return { text: 'Nenhuma sessão com execução longa registrada.' }
      const linhas = lista.map(r => {
        const sinal = agora - r.visto <= Math.max(2 * intervalo, 120_000) ? 'ativa' : `sem sinal há ${duracao(agora - r.visto)}`
        const pct = r.total ? `${r.feitos}/${r.total}` : '-'
        return `- ${r.sessionId === eu ? '(esta) ' : ''}${nomeDe(r.pasta)} · ${pct} · ${sinal}\n  ${r.cwd}`
      })
      return { text: [`${lista.length} sessão(ões) com execução longa:`, ...linhas].join('\n') }
    }
    const r = await atualizar($, fixa)
    await $.ui.open({ id: PAINEL, title: 'Execução longa' })
    return { text: textoDoResumo(r, comoCriar, await read($, procurouAtom)) }
  })

  on('ui.render', { component: 'Pane', requestId: PAINEL }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const r = await read($, resumoAtom)
    const procurou = await read($, procurouAtom)
    const largura = Math.max(10, (e.props.bodyColumns ?? 60) - 2)
    const agoraNao = async () => {
      const novo = await atualizar($, fixa)
      $.ui.toast(novo ? 'Painel relido.' : 'Nenhuma execução longa encontrada.')
    }

    if (r === null) {
      return (
        <Box flexDirection="column">
          <Text>{`Nenhuma execução longa em ${procurou || 'longrun/'}.`}</Text>
          <Text dimColor>{`Para começar: ${comoCriar}`}</Text>
          <Button key="atualizar" hotkey="a" label="procurar de novo" onPress={agoraNao} />
        </Box>
      )
    }

    const c = contagem(r.checklist)
    const tempo = r.inicio === null ? 'início desconhecido' : `rodando há ${duracao(r.lidoEm - r.inicio)}`
    const sobra = Math.max(3, e.props.scroll.bodyRows - 14 - r.progresso.length - r.canal.length)
    const itens = r.checklist.itens
    // mostra primeiro os que faltam; os feitos depois
    const ordem = [...itens.filter(i => i.feito !== true), ...itens.filter(i => i.feito === true)]
    const fonte = r.checklist.fonte === 'goal' ? 'critérios do goal.md' : r.checklist.fonte === 'plan' ? 'plan.md' : 'passos do plan.md'
    const d = new Date(r.lidoEm)
    const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`

    return (
      <Box flexDirection="column">
        <Text bold wrap="truncate-end">{r.objetivo}</Text>
        <Text dimColor wrap="truncate-start">{`${r.nome} · ${tempo}`}</Text>
        <Text> </Text>
        {c.pct !== null && (
          <Box key="barra">
            <Text color={c.pct >= 100 ? 'green' : 'yellow'}>{barra(c.pct, Math.min(30, largura - 16))}</Text>
            <Text>{` ${c.feitos}/${c.total} (${c.pct}%)`}</Text>
          </Box>
        )}
        {r.checklist.fonte === 'nenhuma' ? (
          <Text dimColor>Sem checklist: o plan.md não tem itens "- [ ]" nem passos numerados.</Text>
        ) : (
          <Text dimColor>{`Checklist (${fonte}):`}</Text>
        )}
        {ordem.slice(0, sobra).map((i, k) => (
          <Box key={`item${k}`}>
            <Text {...(i.feito === true ? { color: 'green' } : {})} dimColor={i.feito === true}>
              {i.feito === null ? `${k + 1}. ` : i.feito ? '[x] ' : '[ ] '}
            </Text>
            <Text wrap="truncate-end" dimColor={i.feito === true}>{i.texto}</Text>
          </Box>
        ))}
        {ordem.length > sobra && <Text dimColor>{`… e mais ${ordem.length - sobra} item(ns)`}</Text>}
        <Text> </Text>
        <Text dimColor>Progresso (últimas):</Text>
        {r.progresso.length === 0 && <Text dimColor>  (vazio)</Text>}
        {r.progresso.map((l, k) => (
          <Box key={`prog${k}`}>
            <Text wrap="truncate-end">{`  ${l}`}</Text>
          </Box>
        ))}
        <Text dimColor>Canal (últimas):</Text>
        {r.canal.length === 0 && <Text dimColor>  (vazio)</Text>}
        {r.canal.map((l, k) => (
          <Box key={`canal${k}`}>
            <Text wrap="truncate-end">{`  ${l}`}</Text>
          </Box>
        ))}
        <Text> </Text>
        <Box key="rodape">
          <Text dimColor>{`lido às ${hora} · relê a cada ${Math.round(intervalo / 1000)} s  `}</Text>
          <Button key="atualizar" hotkey="a" label="atualizar agora" plain onPress={agoraNao} />
        </Box>
      </Box>
    )
  })
}
