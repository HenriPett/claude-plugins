# subagentes

Faz o Claude Code trabalhar como coordenador de um time: a sessão principal planeja, delega e
confere, e o trabalho fica com subagentes especializados.

| Agente | Papel | Ferramentas |
| --- | --- | --- |
| `pesquisador-web` | Pesquisa externa com fontes | WebSearch, WebFetch, leitura |
| `pesquisador-memoria` | O que o Henrique decidiu ou registrou (MCP `cerebro`, só leitura) | ferramentas de leitura do cérebro |
| `implementador` | Escreve código numa área delimitada e roda os testes | leitura, Edit, Write, Bash |
| `depurador` | Causa raiz de bugs, sem alterar o projeto | leitura, Bash |
| `revisor` | Revisa o diff, sem editar | leitura, Bash |
| `verificador` | Roda testes, o app e o navegador, sem editar | leitura, Bash, navegador |
| `redator` | Textos para pessoas, com humanizer e copywriting | leitura, Write, Edit |
| `orquestrador` | Modo de sessão principal que só delega: `claude --agent subagentes:orquestrador` | Agent, tarefas, leitura |

Um hook `UserPromptSubmit` injeta a política de delegação (`hooks/politica.md`) em todo pedido.
Para desligar numa sessão: `SUBAGENTES_OFF=1 claude`.

Todos usam o modelo da sessão (`model: inherit`). Para gastar menos cota, troque para `sonnet`
nos pesquisadores e no verificador.

## Instalar

```
claude plugin install subagentes@henrique-plugins --scope user
```

## Permissões para rodar sem tela (VPS, `claude -p`)

Plugin não traz permissões. Sem elas, em `claude -p` os pesquisadores recebem "permission
denied". Na máquina sem tela, ponha no `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "WebSearch", "WebFetch",
      "mcp__cerebro__contexto", "mcp__cerebro__buscar", "mcp__cerebro__nota",
      "mcp__cerebro__periodo", "mcp__cerebro__listar",
      "mcp__cerebro__habilidades", "mcp__cerebro__habilidade"
    ]
  }
}
```

`mcp__cerebro__capturar` fica de fora de propósito: escrever na memória exige pedido explícito.
