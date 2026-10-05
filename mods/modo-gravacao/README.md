# modo-gravacao

Para gravar vídeo ou fazer live com o Claude Code sem mostrar dado sensível na tela.

Com o modo ligado, as mensagens do transcript são **desenhadas** com os dados sensíveis
trocados por marcadores, e uma faixa vermelha fica acima do prompt:

```
 GRAVANDO — dados sensíveis mascarados na tela
```

> **Importante: isto REDUZ o risco, não GARANTE nada.** Revise o vídeo antes de publicar.

## Como usar

| Comando | O que faz |
|---|---|
| `/gravar on` | Liga. Fica ligado mesmo se você fechar e abrir o Claude Code. |
| `/gravar off` | Desliga. |
| `/gravar` | Mostra se está ligado. |

Começa **desligado**.

## O que é mascarado

| Dado | Exemplo | Vira |
|---|---|---|
| E-mail | `nei@gmail.com` | `[e-mail]` |
| Tokens e chaves | `sk-…`, `ghp_…`, `github_pat_…`, JWT `eyJ…`, `AKIA…`, `xox…`, `AIza…`, `gsk_…`, `hf_…`, `Bearer …` | `[token]` |
| Chave privada | bloco `-----BEGIN … PRIVATE KEY-----` | `[chave privada oculta]` |
| Linha de `.env` | `OPENAI_API_KEY=abc` | `OPENAI_API_KEY=[oculto]` |
| Segredo no meio do texto | `api_key=abc`, `"password": "abc"` | `[oculto]` |
| Senha em URL | `https://nei:senha@host` | `https://nei:[oculto]@host` |
| IP (v4) | `192.168.1.10` | `[ip]` (127.x e 0.0.0.0 ficam) |
| Telefone BR | `(11) 98765-4321`, `+55 11 98765-4321`, `98765-4321` | `[telefone]` |
| CPF / CNPJ | `123.456.789-09`, `12.345.678/0001-95` | `[cpf]` / `[cnpj]` |
| 11 ou 14 dígitos seguidos | CPF/CNPJ/celular sem pontuação | `[número oculto]` |
| Dinheiro | `R$ 1.234,56`, `US$ 12`, `$12`, `$1.50` | `R$ ***`, `US$ ***`, `$***` |
| Pasta do usuário | `/home/nei/…`, `/Users/nei/…`, `C:\Users\nei\…` | `~/…` |

Onde: sua mensagem, a resposta do Claude, a linha de cada ferramenta (comando, caminho,
resultado), o resultado das ferramentas, a saída de comandos `/…` e os grupos dobrados
("Read 3 files"). Vale também com a conversa aberta (ctrl+o).

Só o **desenho** muda. O que o modelo lê e o que fica salvo na conversa continuam iguais.

## Opções (`/config`)

- **extras** — termos a mais, separados por vírgula. Ex.: `meu-servidor, ACME Ltda, /cliente-\d+/i`.
  Texto comum é mascarado sem diferença de maiúsculas; entre barras é expressão regular.
  Expressão inválida é tratada como texto comum. Não dá para usar vírgula dentro da
  expressão (use `\x2C`).

## O que NÃO é coberto (leia antes de gravar)

- **Statusline feita por script** (ex.: `usuario@maquina:pasta`) — o mod não desenha ela.
- **O que você está digitando** no prompt antes de enviar.
- **Título da janela/aba** do terminal, **scrollback** do terminal (o que rolou para cima
  antes de ligar pode estar no histórico do terminal) e a tela fora do Claude Code.
- Painéis, avisos (toasts) e faixas de **outros plugins**; dicas abaixo do prompt; diálogos
  de pergunta (AskUserQuestion); diálogos de permissão; o spinner.
- Mensagens de **outro agente / teammate / outra sessão** com mais de um bloco ou com linha
  de resumo: o Claude Code ignora a reescrita e desenha o original, **sem máscara**.
- Resultado de ferramenta cuja versão mascarada não passe na checagem do engine aparece
  em branco (buraco visível, não vazamento).
- **Imagens** e diffs desenhados pelo próprio engine quando ele não usa as props.
- Formatos que as regras não conhecem: IPv6, telefone de outros países, tokens com prefixo
  novo, senha sem nome (`abc123` solto), dado sensível escrito por extenso.
- Se uma regra falhar, a mensagem aparece como `[oculto pelo modo gravação]` em vez do texto.

Excessos conhecidos (preferimos esconder demais): `type Token = string` vira
`type Token = [oculto]`; `git@github.com` vira `[e-mail]`.

## Limites técnicos

- Testado com o kit de testes do Claude Code 2.1.289 (terminal e desktop). O desenho real
  do engine embrulhado só é visto numa sessão de verdade.
- Ao ligar, o que já está na tela é redesenhado; confira rolando o transcript.
