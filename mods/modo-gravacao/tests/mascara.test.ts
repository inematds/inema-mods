import { describe, expect, test } from 'claude-code/testing'

import { mascarar, mascararTudo, regrasExtras, TEXTO_DE_FALHA } from '../hooks/mascara'

// Cada caso: [entrada, o que NÃO pode sobrar na saída, o que deve aparecer no lugar]
const POSITIVOS: [string, string, string][] = [
  ['fale com fulano.silva@exemplo.com hoje', 'fulano.silva@exemplo.com', '[e-mail]'],
  ['contato: a_b+tag@sub.dominio.com.br.', 'a_b+tag@sub.dominio.com.br', '[e-mail]'],
  ['chave sk-ant-api03-AbCdEfGhIjKlMnOpQrStUv_wx-yz', 'sk-ant-api03-AbCdEfGhIjKlMnOpQrStUv', '[token]'],
  ['OPENAI sk-proj-1234567890abcdefghijKLMN', 'sk-proj-1234567890abcdefghij', '[token]'],
  ['token ghp_abcdefghijklmnopqrstuvwxyz0123456789', 'ghp_abcdefghij', '[token]'],
  ['github_pat_11ABCDEFG0123456789_abcdefghijklmnopqrstuvwxyz', 'github_pat_11ABC', '[token]'],
  ['jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abc123XYZ_-', 'eyJhbGciOiJIUzI1NiJ9', '[token]'],
  ['aws AKIAIOSFODNN7EXAMPLE fim', 'AKIAIOSFODNN7EXAMPLE', '[token]'],
  ['slack xoxb-123456789012-abcdefghij', 'xoxb-123456789012', '[token]'],
  ['google AIzaSyA1234567890abcdefghijklmnopqrstuv', 'AIzaSyA1234567890', '[token]'],
  ['groq gsk_abcdefghijklmnopqrstuvwxyz123', 'gsk_abcdefghij', '[token]'],
  ['Authorization: Bearer abc.def-ghi_jkl123456', 'abc.def-ghi_jkl123456', 'Bearer [token]'],
  ['servidor em 192.168.1.10 ok', '192.168.1.10', '[ip]'],
  ['tailscale 100.70.253.64.', '100.70.253.64', '[ip]'],
  ['ligue (11) 98765-4321', '98765-4321', '[telefone]'],
  ['ligue +55 11 98765-4321', '98765-4321', '[telefone]'],
  ['ligue 11 98765-4321', '98765-4321', '[telefone]'],
  ['cel 98765-4321', '98765-4321', '[telefone]'],
  ['ligue (51)3333-4444', '3333-4444', '[telefone]'],
  ['CPF 123.456.789-09', '123.456.789-09', '[cpf]'],
  ['CNPJ 12.345.678/0001-95', '12.345.678/0001-95', '[cnpj]'],
  ['cpf 12345678909 sem ponto', '12345678909', '[número oculto]'],
  ['cnpj 12345678000195 sem ponto', '12345678000195', '[número oculto]'],
  ['custou R$ 1.234,56 no mês', '1.234,56', 'R$ ***'],
  ['custou R$12 só', 'R$12', 'R$ ***'],
  ['fatura US$ 12', 'US$ 12', 'US$ ***'],
  ['plano de $12 por mês', '$12', '$***'],
  ['plano de $1.50 por dia', '$1.50', '$***'],
  ['plano de $1,234.00', '$1,234.00', '$***'],
  ['arquivo /home/usuario/projetos/x.ts', 'usuario', '~/projetos/x.ts'],
  ['mac /Users/nei/Documents', '/Users/nei', '~/Documents'],
  ['win C:\\Users\\nei\\Desktop', 'C:\\Users\\nei', '~\\Desktop'],
  ['OPENROUTER_API_KEY=abc123', 'abc123', 'OPENROUTER_API_KEY=[oculto]'],
  ['export DB_PASS="segredo"', 'segredo', 'DB_PASS=[oculto]'],
  ['  GROQ_KEY = valor com espaço', 'valor com espaço', 'GROQ_KEY = [oculto]'],
  ['rode com api_key=xyz987 depois', 'xyz987', 'api_key=[oculto]'],
  ['{"api_key": "abc-123"}', 'abc-123', '"api_key": "[oculto]"'],
  ['git clone https://nei:senha123@github.com/x', 'senha123', 'https://nei:[oculto]@'],
  ['-----BEGIN OPENSSH PRIVATE KEY-----\nAAAAB3Nza\n-----END OPENSSH PRIVATE KEY-----', 'AAAAB3Nza', '[chave privada oculta]'],
]

// Coisas comuns em sessão de programação que NÃO podem virar máscara.
const NEGATIVOS = [
  'versão v1.2.3 do pacote',
  'versão 2.1.289',
  'data 2026-10-05 às 15:57',
  'hora 15:57:00',
  'cor #FFB000 e #fff',
  'tarefa task-123 e PR #42',
  'echo $1 e $HOME e $PATH',
  'custa $5 hoje',
  'porta 8080 e 3010',
  'localhost 127.0.0.1 e 0.0.0.0',
  'timestamp 1759680000000',
  'commit a1b2c3d4e5f6',
  'arquivo ~/projetos/x.ts',
  'const total = 5',
  'npm run build && npm test',
  'string sk-curta',
  'tamanho 1.234 linhas',
  'IP inválido 999.1.1.1',
  'versão 1.2.3.4.5',
  '"keyboard": "abnt2"',
]

describe('mascarar: positivos', () => {
  for (const [entrada, some, aparece] of POSITIVOS) {
    test(`mascara: ${entrada.slice(0, 40)}`, () => {
      const saida = mascarar(entrada)
      expect(saida.includes(some)).toBe(false)
      expect(saida).toContain(aparece)
    })
  }
})

describe('mascarar: negativos', () => {
  for (const entrada of NEGATIVOS) {
    test(`não mexe: ${entrada}`, () => {
      expect(mascarar(entrada)).toBe(entrada)
    })
  }
})

describe('mascarar: casos gerais', () => {
  test('vários dados na mesma linha', () => {
    const s = mascarar('nei@x.com em 10.0.0.5 pagou R$ 50,00')
    expect(s).toBe('[e-mail] em [ip] pagou R$ ***')
  })

  test('texto vazio e não-string passam', () => {
    expect(mascarar('')).toBe('')
    expect(mascarar(undefined as unknown as string)).toBe(undefined as unknown as string)
  })

  test('extras: literal sem maiúsculas, regex, regex inválida vira literal', () => {
    const extras = regrasExtras('meu-servidor, /cliente-\\d+/i, ACME Ltda, /[abc/')
    expect(mascarar('usuario@MEU-SERVIDOR:~$', extras)).toBe('usuario@[oculto]:~$')
    expect(mascarar('pasta Cliente-42 da acme ltda', extras)).toBe('pasta [oculto] da [oculto]')
    expect(mascarar('texto com /[abc/ literal', extras)).toBe('texto com [oculto] literal')
    expect(regrasExtras(' , ,')).toHaveLength(0)
  })

  test('mascararTudo mantém a forma do objeto', () => {
    const entrada = {
      command: 'curl -H "Authorization: Bearer abcdefghijklmnop" http://10.1.2.3',
      timeout: 5000,
      run_in_background: false,
      nada: undefined,
      lista: ['a@b.com', 3, null],
      dentro: { caminho: '/home/nei/x' },
    }
    const saida = mascararTudo(entrada) as typeof entrada
    expect(Object.keys(saida)).toEqual(Object.keys(entrada))
    expect(saida.command).toBe('curl -H "Authorization: Bearer [token]" http://[ip]')
    expect(saida.timeout).toBe(5000)
    expect(saida.run_in_background).toBe(false)
    expect(saida.nada).toBeUndefined()
    expect(saida.lista).toEqual(['[e-mail]', 3, null])
    expect(saida.dentro.caminho).toBe('~/x')
  })

  // Excesso conhecido (documentado no README): preferimos esconder demais a de menos.
  test('excesso aceito: nome com KEY/TOKEN/PASS seguido de = é sempre mascarado', () => {
    expect(mascarar('type Token = string')).toBe('type Token = [oculto]')
    expect(mascarar('git@github.com:inematds/x.git')).toBe('[e-mail]:inematds/x.git')
  })

  test('regra que lança esconde tudo em vez de deixar passar', () => {
    const quebrada = [{ nome: 'x', re: /a/g, troca: () => { throw new Error('x') } }]
    expect(mascarar('segredo a', quebrada)).toBe(TEXTO_DE_FALHA)
  })
})
