import { describe, expect, test } from 'claude-code/testing'

import { acharPush, permitido, urlCurta } from '../hooks/regras'
import { mundoDe, SESSAO } from './mundo'

const bash = (command: string) => ({ tool: 'Bash' as const, command })

const gitFalso = (argv: readonly string[]) => {
  const a = argv.join(' ')
  if (a === 'git rev-parse --abbrev-ref --symbolic-full-name @{u}') return { exitCode: 0, stdout: 'origin/main\n' }
  if (a === 'git remote get-url origin') return { exitCode: 0, stdout: 'git@github.com:inematds/portal.git\n' }
  if (a === 'git remote get-url outro') return { exitCode: 0, stdout: 'https://github.com/fulano/x.git\n' }
  if (a === 'git rev-parse --abbrev-ref HEAD') return { exitCode: 0, stdout: 'dev\n' }
  return { exitCode: 1, stdout: '' }
}

describe('faixa-publicacao', () => {
  test('push simples: toast com remoto, branch e URL', async ($, on) => {
    const mundo = mundoDe(on)
    mundo.saidaProcesso = gitFalso
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call(bash('git push'))
    expect(mundo.toasts).toEqual([
      'Push feito em origin/main (github.com/inematds/portal). O deploy é automático (Vercel/Pages) — não precisa fazer mais nada.',
    ])
  })

  test('push com remoto e branch escritos, depois de cd', async ($, on) => {
    const mundo = mundoDe(on)
    mundo.saidaProcesso = gitFalso
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call(bash('cd sub && git add . && git commit -m "x; y" && git push outro HEAD:feature'))
    expect(mundo.toasts[0]).toContain('Push feito em outro/feature (github.com/fulano/x)')
    expect(mundo.rodados).toEqual([['git', 'remote', 'get-url', 'outro']])
  })

  test('push que falhou não mostra nada', async ($, on) => {
    const mundo = mundoDe(on)
    mundo.saidaProcesso = gitFalso
    on('tool.call', () => ({ isError: true as const, result: 'x', text: 'rejected' }))
    await $.session.start(SESSAO)
    await $.tool.call(bash('git push'))
    expect(mundo.toasts).toEqual([])
  })

  test('outros comandos não disparam (git status, echo com "git push")', async ($, on) => {
    const mundo = mundoDe(on)
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call(bash('git status'))
    await $.tool.call(bash('echo "git push"'))
    await $.tool.call(bash('git push --dry-run'))
    expect(mundo.toasts).toEqual([])
    expect(mundo.rodados).toEqual([])
  })

  test('remoto fora da lista: alerta', { options: { remotos_permitidos: ['NeiMaldaner/'] } }, async ($, on) => {
    const mundo = mundoDe(on)
    mundo.saidaProcesso = gitFalso
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call(bash('git push origin main'))
    expect(mundo.toasts.length).toBe(2)
    expect(mundo.toasts[1]).toContain('ATENÇÃO: github.com/inematds/portal não está em "remotos permitidos"')
  })

  test('remoto na lista: sem alerta', { options: { remotos_permitidos: ['inematds/'] } }, async ($, on) => {
    const mundo = mundoDe(on)
    mundo.saidaProcesso = gitFalso
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call(bash('git push origin main'))
    expect(mundo.toasts.length).toBe(1)
  })

  test('regras puras', () => {
    expect(acharPush('git -C /x push -u origin +dev', '/w')).toEqual({ cwd: '/x', remoto: 'origin', branch: 'dev' })
    expect(acharPush('git push', '/w')).toEqual({ cwd: '/w' })
    expect(acharPush('git pull', '/w')).toBeUndefined()
    expect(acharPush("git commit -m 'git push'", '/w')).toBeUndefined()
    expect(urlCurta('https://github.com/a/b.git')).toBe('github.com/a/b')
    expect(urlCurta('git@github.com:a/b.git')).toBe('github.com/a/b')
    expect(permitido([], 'x', 'y')).toBe(true)
    expect(permitido(['origin'], 'origin', 'git@github.com:a/b.git')).toBe(true)
    expect(permitido(['NeiMaldaner/portal'], 'origin', 'git@github.com:inematds/b.git')).toBe(false)
  })
})
