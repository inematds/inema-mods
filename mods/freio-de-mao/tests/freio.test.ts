import { describe, expect, test } from 'claude-code/testing'

import { analisar, caminhosDoStatus, lerMedidaSh, marcaDeData, reescreverParaLixeira, seguroParaShell, tamanho } from '../hooks/regras'
import { dividirTrechos, palavras } from '../hooks/shell'
import { comando, mundoDe, SESSAO } from './mundo'
import type { Mundo } from './mundo'

const bash = (command: string) => ({ tool: 'Bash' as const, command })

/** Mundo onde "build" tem 120 arquivos, o repo tem 2 mudanças e gio existe (ou não). */
const processos = (mundo: Mundo, opcoes: { gio?: boolean; vazio?: boolean; backupFalha?: boolean } = {}) => {
  mundo.saidaProcesso = argv => {
    const a = argv.join(' ')
    if (a === 'sh -c command -v gio') return { exitCode: opcoes.gio ? 0 : 1, stdout: opcoes.gio ? '/usr/bin/gio\n' : '' }
    if (argv[0] === 'sh' && argv[2]?.includes('cp -a')) {
      return opcoes.backupFalha ? { exitCode: 1, stdout: '', stderr: 'cp: sem espaço' } : { exitCode: 0, stdout: '/home/u/.cache/inema-freio/X\n' }
    }
    if (argv[0] === 'sh' && argv[2]?.startsWith('set --')) {
      if (opcoes.vazio) return { exitCode: 0, stdout: 'N 0\n' }
      const lista = Array.from({ length: 20 }, (_, i) => `L build/f${i}.js`).join('\n')
      return { exitCode: 0, stdout: `N 1\nF 120\nD 8\nB 3565158\n${lista}\n` }
    }
    if (a.startsWith('git status --porcelain')) return { exitCode: 0, stdout: opcoes.vazio ? '' : ' M src/a.ts\n?? novo.txt\nM  src/b.ts\n' }
    if (a.startsWith('git clean -n')) return { exitCode: 0, stdout: 'Would remove lixo.tmp\nWould remove cache/\n' }
    if (a.startsWith('pgrep')) return { exitCode: 0, stdout: '123 node server.js\n456 node worker.js\n' }
    return { exitCode: 1, stdout: '' }
  }
}

describe('freio-de-mao', () => {
  test('registra /freio', async ($, on) => {
    const mundo = mundoDe(on)
    await $.session.start(SESSAO)
    expect(mundo.comandos).toEqual(['freio'])
  })

  test('comandos comuns e texto entre aspas não disparam', async ($, on) => {
    const mundo = mundoDe(on)
    processos(mundo)
    let rodou = 0
    on('tool.call', () => (rodou++, { result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    for (const c of ['ls -la', 'rm arquivo.txt', 'echo "rm -rf /"', 'git commit -m "git reset --hard"', 'git push', 'git checkout main', 'git restore --staged a.ts', 'pkill node']) {
      await $.tool.call(bash(c))
    }
    expect(mundo.perguntas).toEqual([])
    expect(rodou).toBe(8)
  })

  test('rm -rf: mede sem apagar e mostra no máximo 15 linhas', async ($, on) => {
    const mundo = mundoDe(on)
    processos(mundo)
    mundo.respostas.push('Prosseguir')
    const rodados: string[] = []
    on('tool.call', ($$, e) => (e.tool === 'Bash' && rodados.push(e.command), { result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call(bash('rm -rf build'))
    const q = mundo.perguntas[0]!
    expect(q).toContain('> rm -rf build')
    expect(q).toContain('Vai apagar: 120 arquivo(s), 8 pasta(s), 3,4 MB')
    expect(q.split('\n').filter(l => l.startsWith('    build/')).length).toBe(15)
    expect(q).toContain('... e mais 5')
    expect(mundo.opcoes[0]).toEqual(['Cancelar', 'Mandar para a lixeira', 'Fazer backup e prosseguir', 'Prosseguir'])
    expect(rodados).toEqual(['rm -rf build'])
    // a medição não apaga nada: nenhum processo com rm
    expect(mundo.rodados.some(a => a.join(' ').includes('rm '))).toBe(false)
  })

  test('alvo absoluto que não existe: nada a perder, não pergunta', async ($, on) => {
    const mundo = mundoDe(on)
    processos(mundo, { vazio: true })
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call(bash('rm -rf /tmp/nao-existe'))
    expect(mundo.perguntas).toEqual([])
  })

  test('alvo relativo medido como vazio: pergunta mesmo assim (o shell pode estar em outra pasta)', async ($, on) => {
    const mundo = mundoDe(on)
    processos(mundo, { vazio: true })
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call(bash('rm -rf build'))
    await $.tool.call(bash('git reset --hard'))
    expect(mundo.perguntas.length).toBe(2)
    expect(mundo.perguntas[0]).toContain('Não achei os alvos em /work')
    expect(mundo.perguntas[1]).toContain('confira se o shell está mesmo nesse repositório')
  })

  test('cd com variável antes: não mede e pergunta', async ($, on) => {
    const mundo = mundoDe(on)
    processos(mundo, { vazio: true })
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call(bash('cd $HOME/x && rm -rf build'))
    expect(mundo.perguntas.length).toBe(1)
    expect(mundo.perguntas[0]).toContain('Não sei em que pasta isso roda')
    expect(mundo.rodados.filter(a => a[0] === 'sh')).toEqual([])
  })

  test('Cancelar: nega dizendo o que teria sido apagado', async ($, on) => {
    const mundo = mundoDe(on)
    processos(mundo)
    mundo.respostas.push('Cancelar')
    let rodou = 0
    on('tool.call', () => (rodou++, { result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    const r = await $.tool.call(bash('cd /tmp && rm -rf build'))
    expect(rodou).toBe(0)
    expect(r.deny).toContain('o usuário cancelou')
    expect(r.deny).toContain('120 arquivo(s)')
    // mediu na pasta certa (cd /tmp)
    expect(mundo.rodados[0]?.[0]).toBe('sh')
  })

  test('sem tela: padrão nega', async ($, on) => {
    const mundo = mundoDe(on)
    processos(mundo)
    let rodou = 0
    on('tool.call', () => (rodou++, { result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    const r = await $.tool.call(bash('git reset --hard HEAD~1'))
    expect(rodou).toBe(0)
    expect(r.deny).toContain('não há ninguém na tela')
    expect(r.deny).toContain('Mudanças não commitadas que se perdem: 2 arquivo(s)')
  })

  test('sem tela com sem_tela=permitir: roda', { options: { sem_tela: 'permitir' } }, async ($, on) => {
    const mundo = mundoDe(on)
    processos(mundo)
    let rodou = 0
    on('tool.call', () => (rodou++, { result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call(bash('rm -rf build'))
    expect(rodou).toBe(1)
  })

  test('Lixeira com gio: reescreve só o trecho do rm', async ($, on) => {
    const mundo = mundoDe(on, {}, Date.UTC(2026, 9, 5, 14, 30, 0))
    processos(mundo, { gio: true })
    mundo.respostas.push('Mandar para a lixeira')
    const rodados: string[] = []
    on('tool.call', ($$, e) => (e.tool === 'Bash' && rodados.push(e.command), { result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call(bash('npm run build && rm -rf "dist velho" *.log && echo fim'))
    expect(rodados).toEqual(['npm run build && gio trash -f -- "dist velho" *.log && echo fim'])
    expect(mundo.toasts[0]).toContain('gio trash')
  })

  test('Lixeira sem gio: mv para ~/.local/share/Trash com marca de data', async ($, on) => {
    const mundo = mundoDe(on, {}, Date.UTC(2026, 9, 5, 14, 30, 0))
    processos(mundo, { gio: false })
    mundo.respostas.push('Mandar para a lixeira')
    const rodados: string[] = []
    on('tool.call', ($$, e) => (e.tool === 'Bash' && rodados.push(e.command), { result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call(bash('rm -rf build'))
    expect(rodados[0]).not.toContain('rm -rf')
    expect(rodados[0]).toContain('/Trash')
    expect(rodados[0]).toContain('.20261005-143000')
    expect(rodados[0]).toContain('.trashinfo')
  })

  test('Backup e prosseguir: copia antes e avisa onde', async ($, on) => {
    const mundo = mundoDe(on)
    processos(mundo)
    mundo.respostas.push('Fazer backup e prosseguir')
    let rodou = 0
    on('tool.call', () => (rodou++, { result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call(bash('git checkout -- .'))
    expect(mundo.opcoes[0]).toEqual(['Cancelar', 'Fazer backup e prosseguir', 'Prosseguir'])
    const cp = mundo.rodados.find(a => a[0] === 'sh' && a[2]?.includes('cp -a'))
    expect(cp?.[2]).toContain(`'src/a.ts' 'src/b.ts'`)
    expect(cp?.[2]).not.toContain('novo.txt') // checkout não mexe em não rastreado
    expect(mundo.toasts[0]).toBe('Backup feito em /home/u/.cache/inema-freio/X')
    expect(rodou).toBe(1)
  })

  test('backup que falha: comando NÃO roda', async ($, on) => {
    const mundo = mundoDe(on)
    processos(mundo, { backupFalha: true })
    mundo.respostas.push('Fazer backup e prosseguir')
    let rodou = 0
    on('tool.call', () => (rodou++, { result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    const r = await $.tool.call(bash('rm -rf build'))
    expect(rodou).toBe(0)
    expect(r.deny).toContain('backup antes do comando falhou')
  })

  test('push --force e pkill -f: só Prosseguir/Cancelar', async ($, on) => {
    const mundo = mundoDe(on)
    processos(mundo)
    mundo.respostas.push('Prosseguir', 'Prosseguir')
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call(bash('git push --force origin main'))
    await $.tool.call(bash('pkill -9 -f "node server"'))
    expect(mundo.opcoes).toEqual([
      ['Cancelar', 'Prosseguir'],
      ['Cancelar', 'Prosseguir'],
    ])
    expect(mundo.perguntas[1]).toContain('Vai encerrar: 2 processo(s)')
    expect(mundo.rodados.find(a => a[0] === 'pgrep')).toEqual(['pgrep', '-a', '-f', 'node server'])
  })

  test('/freio lista o que foi parado', async ($, on) => {
    const mundo = mundoDe(on)
    processos(mundo)
    mundo.respostas.push('Cancelar')
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    expect((await $.command.run(comando('freio'))).text).toContain('nada parado')
    await $.tool.call(bash('git clean -fdx'))
    const t = (await $.command.run(comando('freio'))).text
    expect(t).toContain('1 parada(s)')
    expect(t).toContain('Cancelar · git clean -fdx')
    expect(mundo.rodados.find(a => a[1] === 'clean')).toEqual(['git', 'clean', '-n', '-dx'])
  })

  test(
    'contas_git: e-mail diferente do dono do remoto pergunta; sem tela nega',
    { options: { contas_git: ['inematds=inematds@gmail.com'] } },
    async ($, on) => {
      const mundo = mundoDe(on)
      mundo.saidaProcesso = argv => {
        const a = argv.join(' ')
        if (a === 'git remote get-url origin') return { exitCode: 0, stdout: 'git@github.com:inematds/portal.git\n' }
        if (a === 'git config user.email') return { exitCode: 0, stdout: 'outro@x.com\n' }
        return { exitCode: 1, stdout: '' }
      }
      let rodou = 0
      on('tool.call', () => (rodou++, { result: 'ok', text: 'ok' }))
      await $.session.start(SESSAO)
      const r = await $.tool.call(bash('git add . && git commit -m "x"'))
      expect(rodou).toBe(0)
      expect(mundo.perguntas[0]).toContain('esperado inematds@gmail.com')
      expect(r.deny).toContain('git config user.email inematds@gmail.com')
    },
  )

  test('contas_git: e-mail certo não pergunta', { options: { contas_git: ['inematds=inematds@gmail.com'] } }, async ($, on) => {
    const mundo = mundoDe(on)
    mundo.saidaProcesso = argv => {
      const a = argv.join(' ')
      if (a === 'git remote get-url origin') return { exitCode: 0, stdout: 'https://github.com/inematds/portal.git\n' }
      if (a === 'git config user.email') return { exitCode: 0, stdout: 'InemaTDS@gmail.com\n' }
      return { exitCode: 1, stdout: '' }
    }
    on('tool.call', () => ({ result: 'ok', text: 'ok' }))
    await $.session.start(SESSAO)
    await $.tool.call(bash('git push'))
    expect(mundo.perguntas).toEqual([])
  })

  test('regras puras: detecção', () => {
    const tipos = (c: string) => analisar(c, '/w').map(p => p.tipo)
    expect(tipos('rm -fr x')).toEqual(['rm'])
    expect(tipos('rm -R x')).toEqual(['rm'])
    expect(tipos('rm *.log')).toEqual(['rm'])
    expect(tipos("rm '*.log'")).toEqual([])
    expect(tipos('sudo rm -rf /var/x')).toEqual(['rm'])
    expect(tipos('git checkout -- . ; git restore src/ | cat')).toEqual(['git-checkout', 'git-restore'])
    expect(tipos('git clean -n')).toEqual([])
    expect(tipos('git push -f')).toEqual(['git-push-force'])
    expect(tipos('git push --force-with-lease')).toEqual([])
    expect(tipos('git branch -D velha')).toEqual(['git-branch-D'])
    expect(tipos('git branch -d velha')).toEqual([])
    expect(tipos('find . -name "*.tmp" -delete')).toEqual(['find'])
    expect(tipos('find . -name x -exec rm {} \\;')).toEqual(['find'])
    expect(tipos('killall node; fuser -k 8080/tcp')).toEqual(['matar', 'matar'])
    expect(tipos('truncate -s 0 log.txt')).toEqual(['truncate'])
    expect(tipos('dd if=/dev/zero of=/dev/sdb')).toEqual(['disco'])
    expect(tipos('mkfs.ext4 /dev/sdb1')).toEqual(['disco'])
    expect(tipos('Remove-Item -Recurse -Force C:\\x')).toEqual(['powershell'])
    expect(tipos('rd /s /q C:\\x')).toEqual(['powershell'])
    expect(tipos('git -C ../outro reset --hard')).toEqual(['git-reset'])
    expect(analisar('git -C ../outro reset --hard', '/w/a')[0]?.cwd).toBe('/w/outro')
  })

  test('regras puras: segurança da medição e lixeira', () => {
    expect(seguroParaShell(['build', '"a b"', '$HOME/x'])).toBe(true)
    expect(seguroParaShell(['$(cat lista)'])).toBe(false)
    expect(seguroParaShell(['`x`'])).toBe(false)
    expect(analisar('rm -rf $(cat lista)', '/w')[0]?.medicao).toBeUndefined()
    expect(analisar('rm -rf /', '/w')[0]?.semMedida).toContain('PERIGO')
    expect(analisar('rm -rf ~', '/w')[0]?.medicao).toBeUndefined()
    expect(dividirTrechos('a && b || c; d | e & f').map(t => t.texto.trim())).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
    expect(dividirTrechos('echo "a && b" 2>&1 && x').length).toBe(2)
    expect(palavras(`rm -rf "a b" 'c'`).map(p => p.valor)).toEqual(['rm', '-rf', 'a b', 'c'])
    expect(reescreverParaLixeira('rm -rf a; ls', [0], new Map([[0, ['a']]]), true, 'M')).toBe('gio trash -f -- a; ls')
    expect(marcaDeData(Date.UTC(2026, 0, 2, 3, 4, 5))).toBe('20260102-030405')
    expect(lerMedidaSh('N 2\nF 3\nD 1\nB 10\nL a\nL b/\n')).toEqual({ n: 2, arquivos: 3, pastas: 1, bytes: 10, lista: ['a', 'b/'] })
    expect(caminhosDoStatus([' M a.ts', 'R  velho.ts -> novo.ts'])).toEqual(['a.ts', 'novo.ts'])
    expect(tamanho(500)).toBe('500 bytes')
    expect(tamanho(1536)).toBe('1,5 KB')
  })
})
