# Prompt: criar o mod "previsão do contexto" do zero

Para aprender criando (o kit já tem um pronto: `clima-contexto`). Digite `/plugin-authoring` e cole:

```
Crie um mod chamado previsao-contexto: uma previsão do tempo da minha janela de contexto,
numa linha acima do prompt.

A linha mostra um símbolo e uma palavra conforme o quanto o contexto encheu:
- abaixo de 50%: ○ limpo, em amarelo
- de 50% a 69%: ◐ nublado, em ciano
- de 70% a 84%: ● chuva, em azul
- 85% ou mais: ▲ tempestade, em magenta

Inclua também: a porcentagem usada, um minigráfico de barras dos últimos 12 turnos
e quanto o último turno somou. Tudo em português, atualizando a cada turno.
Use símbolos simples que alinham em qualquer fonte, sem emoji.
Deixe o mod no escopo deste projeto.
```

Quando ele perguntar "Enable hot reloading for this session?", escolha **Enable for this session**. O mod aparece depois do próximo pedido, sem reiniciar.

Para mudar depois, fale normalmente: "troca o símbolo de chuva por ≈" ou "deixa a faixa só com a porcentagem".
