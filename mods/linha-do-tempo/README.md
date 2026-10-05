# linha-do-tempo

Um "gravador de voo" da sessão: guarda, turno a turno, o que aconteceu na conversa principal, e mostra num painel.

Para cada turno:

- o começo do pedido;
- **modelo** e **esforço** usados (low/medium/high... em português);
- quantos **passos** (chamadas ao modelo) o turno teve;
- **chamadas de ferramenta por tipo**: Bash, Edit, Read, Agent... (toda ferramenta de MCP conta como `MCP`);
- **tokens** do turno: entrada, saída, cache lido e cache escrito;
- **duração** e se foi interrompido.

## Comandos

- `/timeline` — abre o painel.
- `/timeline exportar` — devolve a tabela em Markdown, pronta para colar num `canal.md` ou relatório.
- `/timeline limpar` — zera a lista (o painel também tem o botão `limpar`).

Guarda no máximo os **100 últimos turnos** da sessão. Não tem opções no `/config`.

## Limites (honestos)

- Só a conversa principal entra; os passos e turnos de subagentes ficam de fora (o turno principal mostra a chamada `Agent`).
- Modelo e esforço vêm de cada chamada ao modelo (`turn.step`); quando um turno faz várias, vale a última. Se o turno não fez nenhuma (por exemplo, interrompido antes), usa o modelo informado no fim do turno ou mostra `?`.
- Tokens são os que a API informou para o turno; turno interrompido ou com erro pode vir "sem dados".
- O painel não mostra custo em dinheiro (a assinatura não cobra por token).
- A lista vive só nesta sessão: depois de fechar o Claude Code, use `/timeline exportar` antes se quiser guardar.
