import { describe, expect, test } from 'claude-code/testing'

import { barra, checklistDe, duracao, inicioDe, objetivoDe, ultimasDoCanal, ultimasDoProgresso } from '../hooks/register'
import { comando, mundoDe, PANE_PROPS, SESSAO, VIEWPORT } from './mundo'

// Formato do kit execucao-longa (templates/ e execuções reais).
const GOAL = `# Goal — atendimento-v1

- **Início:** 2026-10-05 00:27 · **Agente:** codex exec
- **Tetos:** 20 ciclos

## Resultado
Sistema de atendimento sobe com ./atende e passa nos testes.

## Critérios de pronto (verificáveis)
- [ ] pytest → 93 passed
- [x] verificar-limites.sh → LIMITES OK
`

const PLAN_CAIXAS = `# Plano

## Próximos passos
- [x] criar banco
- [ ] rotas
- [ ] testes
`

const PLAN_NUMERADO = `# Plano

## Estratégia atual
Fechar a v1.

## Próximos 3 passos
1. Registrar o checkpoint final.
2. Validação humana.
`

const PROGRESS = `# Progresso (só acrescentar)

| data/hora | checkpoint | commit | critério atingido? |
|---|---|---|---|
| 2026-10-05 00:39 | campanhas | - | parcial |
| 2026-10-05 00:52 | cadastros | - | parcial |
| 2026-10-05 01:00 | evolution | - | parcial |
| 2026-10-05 01:13 | páginas | - | concluído |
`

const CANAL = `# Canal — atendimento-v1 (só acrescentar)

Formato: \`- AAAA-MM-DD HH:MM · fato · texto\`

- 2026-10-05 01:04 · armadilha · Dockerfile sem web/
- 2026-10-05 01:13 · fato · 93 passed
`

const AGORA = new Date(2026, 9, 5, 2, 27).getTime()

const execucao = (base: string, plan = PLAN_CAIXAS) => ({
  [`${base}/goal.md`]: GOAL,
  [`${base}/plan.md`]: plan,
  [`${base}/progress.md`]: PROGRESS,
  [`${base}/canal.md`]: CANAL,
  [`${base}/state.md`]: '# Estado',
})

describe('painel-longrun: leitura dos arquivos', () => {
  test('objetivo é a 1ª linha útil de ## Resultado', () => {
    expect(objetivoDe(GOAL)).toBe('Sistema de atendimento sobe com ./atende e passa nos testes.')
    expect(objetivoDe('# Goal — x\n\n## Resultado\n<o que existe quando terminar>\n\nTexto solto')).toBe('Texto solto')
    expect(objetivoDe('# Só título')).toBe('Só título')
  })

  test('início vem do goal.md, senão do nome da pasta', () => {
    expect(inicioDe(GOAL, 'x')).toBe(new Date(2026, 9, 5, 0, 27).getTime())
    expect(inicioDe('# sem data', '2026-10-01-recall')).toBe(new Date(2026, 9, 1).getTime())
    expect(inicioDe('# sem data', 'sem-data')).toBeNull()
  })

  test('checklist: caixas do plan, senão do goal, senão passos numerados', () => {
    const p = checklistDe(PLAN_CAIXAS, GOAL)
    expect(p.fonte).toBe('plan')
    expect(p.itens.map(i => i.feito)).toEqual([true, false, false])
    const g = checklistDe(PLAN_NUMERADO.replace(/\d\. /g, ''), GOAL)
    expect(g.fonte).toBe('goal')
    expect(g.itens).toHaveLength(2)
    const n = checklistDe(PLAN_NUMERADO, '# sem caixas')
    expect(n.fonte).toBe('passos')
    expect(n.itens.map(i => i.feito)).toEqual([null, null])
  })

  test('últimas 3 do progresso (sem cabeçalho) e do canal', () => {
    expect(ultimasDoProgresso(PROGRESS)).toEqual(['2026-10-05 00:52 · cadastros', '2026-10-05 01:00 · evolution', '2026-10-05 01:13 · páginas'])
    expect(ultimasDoProgresso('# Progresso\n\n| a | b |\n|---|---|\n')).toEqual([])
    expect(ultimasDoCanal(CANAL)).toEqual(['2026-10-05 01:04 · armadilha · Dockerfile sem web/', '2026-10-05 01:13 · fato · 93 passed'])
  })

  test('duração e barra', () => {
    expect(duracao(5 * 60_000)).toBe('5 min')
    expect(duracao(125 * 60_000)).toBe('2 h 5 min')
    expect(duracao(50 * 3_600_000)).toBe('2 d 2 h')
    expect(duracao(-1)).toBe('0 min')
    expect(barra(50, 10)).toBe('█████░░░░░')
  })
})

describe('painel-longrun: comandos', () => {
  test('registra /longrun ao iniciar', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    expect(mundo.comandos).toEqual(['longrun'])
  })

  test('/longrun pega a execução mais recente e resume', async ($, on) => {
    const mundo = mundoDe(on, { ...execucao('/work/longrun/2026-10-01-antiga', PLAN_NUMERADO), ...execucao('/work/longrun/2026-10-05-atendimento-v1') }, { agora: AGORA })
    await $.session.start(SESSAO)
    const r = await $.command.run(comando('longrun'))
    expect(mundo.abertos).toEqual(['painel-longrun'])
    expect(r.text).toBe('2026-10-05-atendimento-v1 · há 2 h 0 min · 1/3 (33%)\nObjetivo: Sistema de atendimento sobe com ./atende e passa nos testes.')
  })

  test('sem pasta longrun: diz como criar (texto configurável)', { options: { comoCriar: 'rode meu-kit novo' } }, async ($, on) => {
    mundoDe(on, { '/work/README.md': 'x' })
    await $.session.start(SESSAO)
    const r = await $.command.run(comando('longrun'))
    expect(r.text).toBe('Nenhuma execução longa em /work/longrun.\nPara começar: rode meu-kit novo')
  })

  test('opção pasta fixa outra execução', { options: { pasta: '/outro/longrun/2026-09-01-x' } }, async ($, on) => {
    mundoDe(on, { ...execucao('/work/longrun/2026-10-05-a'), ...execucao('/outro/longrun/2026-09-01-x', PLAN_NUMERADO) }, { agora: AGORA })
    await $.session.start(SESSAO)
    const r = await $.command.run(comando('longrun'))
    expect(r.text).toContain('2026-09-01-x')
    expect(r.text).toContain('1/2 (50%)') // plan sem caixas: usa os critérios do goal.md
  })

  test('nunca escreve nos arquivos da execução', async ($, on) => {
    const arquivos = execucao('/work/longrun/2026-10-05-a')
    const mundo = mundoDe(on, arquivos, { agora: AGORA })
    on('fs.write', () => ({ deny: 'proibido no teste' }))
    await $.session.start(SESSAO)
    await $.command.run(comando('longrun'))
    await mundo.relogio.advance(60_000)
    for (const [k, v] of Object.entries(arquivos)) expect(mundo.arquivos.get(k)?.texto).toBe(v)
  })

  test('cada sessão se registra no store; /longrun todas lista e limpa as velhas', async ($, on) => {
    const mundo = mundoDe(on, execucao('/work/longrun/2026-10-05-a'), {
      agora: AGORA,
      sessao: 'eu',
      store: {
        'sessao:outra': { sessionId: 'outra', cwd: '/proj2', pasta: '/proj2/longrun/2026-10-04-b', objetivo: 'b', feitos: 2, total: 4, visto: AGORA - 60_000 },
        'sessao:velha': { sessionId: 'velha', cwd: '/proj3', pasta: '/proj3/longrun/2026-09-01-c', objetivo: 'c', feitos: 0, total: 1, visto: AGORA - 3 * 86_400_000 },
      },
    })
    await $.session.start(SESSAO)
    expect(mundo.store.get('sessao:eu')).toMatchObject({ sessionId: 'eu', feitos: 1, total: 3 })
    const r = await $.command.run(comando('longrun', 'todas'))
    expect(r.text).toContain('2 sessão(ões)')
    expect(r.text).toContain('- (esta) 2026-10-05-a · 1/3 · ativa')
    expect(r.text).toContain('- 2026-10-04-b · 2/4 · ativa')
    expect(r.text).not.toContain('2026-09-01-c')
    expect(mundo.store.has('sessao:velha')).toBe(false)
    await $.session.end({ reason: 'other', sessionId: 'eu', resume: { id: 'eu' } } as never)
    expect(mundo.store.has('sessao:eu')).toBe(false)
  })
})

describe('painel-longrun: painel', () => {
  test('desenha no terminal e no desktop e se atualiza sozinho a cada 30 s', async ($, on) => {
    const base = '/work/longrun/2026-10-05-atendimento-v1'
    const mundo = mundoDe(on, execucao(base), { agora: AGORA })
    await $.session.start(SESSAO)
    await $.command.run(comando('longrun'))
    let marcados = 1
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({
        plugin: 'painel-longrun',
        surface,
        component: 'Pane',
        requestId: 'painel-longrun',
        viewport: VIEWPORT,
        props: PANE_PROPS,
      })
      expect(await ui.find({ type: 'Text', text: /^Sistema de atendimento/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: ` ${marcados}/3 (${Math.round((marcados / 3) * 100)}%)` })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /páginas/ })).toBeDefined()

      // o plano muda no disco; o relógio anda 30 s; o painel mostra o novo número
      marcados += 1
      const plan = PLAN_CAIXAS.replace('- [ ]', '- [x]').replace(marcados === 3 ? '- [ ]' : '\0', '- [x]')
      mundo.arquivos.set(`${base}/plan.md`, { texto: plan, mtime: 2 })
      await mundo.relogio.advance(30_000)
      expect(await ui.find({ type: 'Text', text: ` ${marcados}/3 (${Math.round((marcados / 3) * 100)}%)` })).toBeDefined()
      await ui.press({ key: 'atualizar' })
      await ui.unmount()
    }
  })

  test('sem execução, o painel mostra como criar', async ($, on) => {
    mundoDe(on)
    await $.session.start(SESSAO)
    await $.command.run(comando('longrun'))
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ plugin: 'painel-longrun', surface, component: 'Pane', requestId: 'painel-longrun', viewport: VIEWPORT, props: PANE_PROPS })
      expect(await ui.find({ type: 'Text', text: /^Para começar:/ })).toBeDefined()
      await ui.unmount()
    }
  })
})
