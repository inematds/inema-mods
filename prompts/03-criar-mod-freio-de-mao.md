# Prompt: criar o mod "freio de mão" do zero

Para aprender criando (o kit já tem um pronto: `freio-de-mao`). Digite `/plugin-authoring` e cole:

```
Crie um mod chamado freio-de-mao.

Toda vez que o Claude for rodar um comando que apaga coisas de forma recursiva ou descarta
trabalho (rm -rf, git reset --hard, git clean, git checkout -- ., e no Windows
Remove-Item -Recurse), o mod para o comando ANTES de rodar.

Com o comando parado, o mod descobre o que seria afetado SEM apagar nada: quais arquivos e
pastas, quantos são e o tamanho total. Se for comando git, quais arquivos com mudanças não
salvas seriam perdidos.

Depois pergunta para mim, mostrando o comando, o resumo do dano e no máximo 15 arquivos da
lista, com as opções:
- Prosseguir: roda o comando normalmente
- Mandar para a lixeira: em vez de apagar, move para a lixeira
- Cancelar: não roda e avisa o que teria sido apagado

Se eu não estiver na tela para responder, o padrão é cancelar.
Deixe o mod no escopo deste projeto.
```

Teste: peça "apaga a pasta build" num projeto de teste e veja o freio aparecer.
