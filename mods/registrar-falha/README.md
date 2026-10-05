# registrar-falha

Ajuda a manter o changelog de falhas (`FALHAS.md`, uma linha por falha). Quando comandos do
terminal (Bash) dão erro **2 vezes ou mais no mesmo pedido**, aparece uma faixa acima do prompt:

```
[!] 2 comando(s) falharam neste turno. [registrar falha no FALHAS.md] [dispensar]
```

O botão **escreve no prompt** (não envia) o pedido:

```
Registre no FALHAS.md uma linha: | 2026-10-05 | <o que quebrou> | <menor correção> | prompt | infra | — sobre: npm test
```

Você completa ou ajusta e envia; quem escreve no arquivo é o Claude. O mod nunca envia nada
sozinho nem mexe no `FALHAS.md`.

## Como usar

| Ação | O que faz |
|---|---|
| botão `registrar falha no FALHAS.md` (tecla `r` com a faixa em foco) | Escreve o pedido no prompt (no fim do que já estiver digitado). |
| botão `dispensar` (tecla `d`) | Esconde a faixa até o próximo pedido. |
| `/falha` | Abre a faixa na mão, mesmo sem erro, e mostra o pedido que o botão escreve. |

A contagem zera a cada pedido novo seu.

## Opções (`/config`)

- **erros_minimos** (padrão 2): quantos comandos com erro no mesmo pedido fazem a faixa aparecer.

## Limites

- Conta só o Bash. Erros de outras ferramentas (Edit que não achou o texto etc.) não contam.
- **Comando que você recusou** no diálogo de permissão (ou que uma regra de permissão
  bloqueou) também conta como erro: o Claude Code entrega a recusa ao mod do mesmo jeito
  que um erro.
- O "sobre" é o **primeiro** comando que falhou no pedido, 1ª linha, até 80 letras.
- A data segue o fuso da máquina.
- Testado com o kit de testes do Claude Code 2.1.289 (terminal e desktop).
