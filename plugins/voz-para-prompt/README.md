# voz-para-prompt

Mod do Claude Code que reorganiza pedidos longos ditados por voz antes de o Claude começar a trabalhar.

Quando você envia um pedido longo com cara de fala (vícios como "né", "tipo", "aí"; autocorreções como "quer dizer", "na verdade"; palavras repetidas; frases enormes sem pontuação), o mod reescreve o mesmo pedido em seções: **Objetivo**, **Contexto**, **O que fazer**, **Restrições e preferências** e, só quando a fala deixou algo ambíguo, **Pontos em aberto**. A reescrita não acrescenta nem tira requisitos.

Se só um desses sinais aparece, o Haiku decide numa chamada rápida se o texto foi ditado ou digitado. Texto sem nenhum sinal de fala não passa por essa checagem.

- A reescrita lê a conversa inteira (uma bifurcação da própria sessão, no mesmo modelo, com o histórico em cache), então entende "isso", "o plugin", "eles". Custa uma chamada no modelo da sessão e leva alguns segundos. Na primeira mensagem, sem conversa, ou se passar de 40 s, cai numa reescrita só do áudio com o Haiku.
- O pedido reorganizado é o que aparece na conversa, com uma linha avisando que veio da voz.
- A transcrição original vai junto como contexto para o Claude (você não vê), e prevalece se houver divergência.
- Se nenhuma reescrita der certo, o pedido segue como foi ditado e aparece um aviso.
- Só pedidos seus são reescritos: notificações, tarefas agendadas, outras sessões e comandos `/` passam direto.

## Como saber que o pedido foi reorganizado

- Aparece um aviso rápido "🎙 Pedido de voz reorganizado".
- Acima da caixa de texto fica a faixa "🎙 Seu pedido de voz foi reorganizado (lendo a conversa)" até o seu próximo pedido, com o botão **Ver antes e depois** e um ✕.
- O painel **Voz → prompt** (o botão da faixa ou o comando `/voz`) mostra, do mais recente ao mais antigo, como cada pedido foi enviado ao Claude e o que você ditou.

## Atalhos no começo do pedido

- `voz:` força a reescrita, mesmo de um pedido curto.
- `cru:` envia como está, sem reescrever (o prefixo é removido).

## Opções

Em `~/.claude/settings.json`, em `pluginConfigs` → `voz-para-prompt@henrique-plugins` → `options`:

- `modo`: `auto` (padrão: só o que parece fala), `sempre` (todo pedido longo) ou `desligado`.
- `minPalavras`: tamanho mínimo, padrão 30.
- `contexto`: `conversa` (padrão) ou `so-transcricao` (só o áudio, mais rápido e barato).
- `modelo`: `haiku` (padrão) ou `sonnet`, para a reescrita sem conversa.

## Testes

```bash
claude plugin test plugins/voz-para-prompt
```
