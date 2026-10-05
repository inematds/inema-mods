// Leitura simples de linha de comando de shell (sem $): divide em trechos por
// && || ; | & e quebra de linha, respeitando aspas e $( ); depois em palavras.
// Não é um parser de shell completo — é o suficiente para achar comandos perigosos.

export type Trecho = { texto: string; sep: string }
export type Palavra = { bruto: string; valor: string }

export function dividirTrechos(comando: string): Trecho[] {
  const trechos: Trecho[] = []
  let atual = ''
  let aspas: '' | "'" | '"' = ''
  let profundidade = 0
  const fechar = (sep: string) => {
    trechos.push({ texto: atual, sep })
    atual = ''
  }
  for (let i = 0; i < comando.length; i++) {
    const c = comando[i]!
    const prox = comando[i + 1] ?? ''
    if (aspas) {
      atual += c
      if (c === '\\' && aspas === '"' && prox) {
        atual += prox
        i++
      } else if (c === aspas) aspas = ''
      continue
    }
    if (c === '\\' && prox) {
      atual += c + prox
      i++
      continue
    }
    if (c === "'" || c === '"') {
      aspas = c
      atual += c
      continue
    }
    if (c === '(') profundidade++
    if (c === ')' && profundidade > 0) profundidade--
    if (profundidade > 0) {
      atual += c
      continue
    }
    if ((c === '&' && prox === '&') || (c === '|' && prox === '|')) {
      fechar(c + prox)
      i++
      continue
    }
    if (c === '|' && prox === '&') {
      fechar('|&')
      i++
      continue
    }
    if (c === '&' && (comando[i - 1] === '>' || prox === '>')) {
      atual += c // 2>&1, &>arquivo
      continue
    }
    if (c === ';' || c === '|' || c === '&' || c === '\n') {
      fechar(c)
      continue
    }
    atual += c
  }
  if (atual.trim() !== '' || trechos.length === 0) trechos.push({ texto: atual, sep: '' })
  return trechos
}

export const juntarTrechos = (trechos: readonly Trecho[]) => trechos.map(t => t.texto + t.sep).join('')

export function palavras(texto: string): Palavra[] {
  const lista: Palavra[] = []
  let bruto = ''
  let valor = ''
  let aspas: '' | "'" | '"' = ''
  let tem = false
  const fechar = () => {
    if (tem) lista.push({ bruto, valor })
    bruto = ''
    valor = ''
    tem = false
  }
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]!
    if (aspas) {
      bruto += c
      if (c === aspas) aspas = ''
      else if (c === '\\' && aspas === '"' && i + 1 < texto.length) {
        bruto += texto[i + 1]
        valor += texto[i + 1]
        i++
      } else valor += c
      continue
    }
    if (c === ' ' || c === '\t' || c === '\n') {
      fechar()
      continue
    }
    tem = true
    if (c === "'" || c === '"') {
      aspas = c
      bruto += c
      continue
    }
    if (c === '\\' && i + 1 < texto.length) {
      bruto += c + texto[i + 1]
      valor += texto[i + 1]
      i++
      continue
    }
    bruto += c
    valor += c
  }
  fechar()
  return lista
}

/** Tira prefixos que não mudam o comando: VAR=x, sudo, env, nohup, time, command, exec. */
export function semPrefixos(lista: readonly Palavra[]): { args: Palavra[]; sudo: boolean } {
  let i = 0
  let sudo = false
  while (i < lista.length) {
    const v = lista[i]!.valor
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(v)) i++
    else if (v === 'sudo' || v === 'doas') {
      sudo = true
      i++
      while (i < lista.length && lista[i]!.valor.startsWith('-')) {
        const f = lista[i]!.valor
        i++
        if (/^-[ugCDhpRrT]$/.test(f)) i++ // flag com valor: sudo -u fulano
      }
    } else if (['env', 'nohup', 'time', 'command', 'exec', 'builtin'].includes(v)) i++
    else break
  }
  return { args: lista.slice(i), sudo }
}

/** Nome do programa sem caminho: /usr/bin/rm -> rm. */
export const programa = (p: Palavra | undefined) => (p ? p.valor.slice(p.valor.lastIndexOf('/') + 1) : '')

/** Junta caminho relativo ao diretório: resolve . e .. (sem tocar no disco). */
export function resolver(base: string, alvo: string): string {
  if (alvo.startsWith('~') || alvo.startsWith('$')) return alvo
  const partes = (alvo.startsWith('/') ? alvo : `${base}/${alvo}`).split('/')
  const saida: string[] = []
  for (const p of partes) {
    if (p === '' || p === '.') continue
    if (p === '..') saida.pop()
    else saida.push(p)
  }
  return '/' + saida.join('/')
}
