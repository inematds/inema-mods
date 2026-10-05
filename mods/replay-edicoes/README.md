# replay-edicoes

**"O que o Claude mudou, uma edição de cada vez?"** — bom para revisar e para ensinar.

O mod lê a conversa da sessão e separa cada edição de arquivo que deu certo (ferramentas Edit, Write, MultiEdit e NotebookEdit). Um painel mostra uma edição por vez, com o trecho que saiu (`-`) e o que entrou (`+`), e você anda para frente e para trás.

## Comandos

| Comando | O que faz |
|---|---|
| `/replay` | Relê a conversa e abre o painel no primeiro passo |
| `/replay ultimo` | Abre no último passo |
| `/replay 5` | Abre no passo 5 |

No painel (com o painel em foco):

| Botão | Tecla | O que faz |
|---|---|---|
| [< anterior] | `h` | Passo anterior |
| [próximo >] | `l` | Próximo passo |
| [copiar diff] | `c` | Copia o diff inteiro do passo (mesmo a parte que não coube) |
| [atualizar] | `u` | Relê a conversa (pega edições novas) |

## Opções (`/config`)

- **Linhas por passo**: padrão 40. Diff maior é cortado no painel com um aviso; o botão copiar leva o diff inteiro.

## Limites (honestos)

- **Os números de linha não são os do arquivo.** O Edit só guarda o texto antigo e o novo, não a posição. O diff começa sempre em "linha 1" do trecho.
- **Write mostra o arquivo como novo** (só linhas `+`), mesmo quando ele já existia: a conversa não guarda o conteúdo anterior.
- Edição que falhou ou foi negada não entra. Mudança feita por comando de terminal (`sed`, scripts) não aparece: o mod só vê as ferramentas de arquivo.
- Mostra o que o Claude **pediu** para mudar, não confere o arquivo no disco agora.
- Teclas: uma letra por botão. As setas do painel rolam o conteúdo; `h`/`l` trocam de passo.
- Linhas muito longas (mais de 400 letras) são cortadas; caracteres de controle somem.

Testado com Claude Code 2.1.289 (API de mods em acesso antecipado).
