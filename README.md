# henrique-plugins

Mods do Claude Code do Henrique, num marketplace só.

| Mod | O que faz |
| --- | --- |
| [voz-para-prompt](plugins/voz-para-prompt) | Reorganiza pedidos longos ditados por voz num prompt claro antes de o Claude começar a trabalhar, com faixa e painel mostrando o antes e depois. |
| [subagentes](plugins/subagentes) | Oito subagentes especializados (pesquisador-web, pesquisador-memoria, implementador, depurador, revisor, verificador, redator e o modo orquestrador) e um lembrete em todo pedido para a sessão principal delegar o trabalho não trivial. |
| [savvy-progress](plugins/savvy-progress) | Barra de progresso acima do prompt e painel de subagentes que abre em toda sessão (fork de [johnnyvizz/claude-kit](https://github.com/johnnyvizz/claude-kit), MIT). |

## Instalar

O repositório é privado: precisa de acesso a ele no GitHub e do GitHub configurado no computador. No prompt de uma sessão do Claude Code no terminal:

```
/plugin install voz-para-prompt --marketplace HenriPett/claude-plugins
```

```
/plugin install savvy-progress --marketplace HenriPett/claude-plugins
```

Responda `y` para adicionar o marketplace e escolha o escopo (usuário, para valer em toda sessão).

## Em sessões na nuvem

Para um projeto aberto no Claude Code na Web, ponha no `.claude/settings.json` do repositório do projeto:

```json
{
  "extraKnownMarketplaces": {
    "henrique-plugins": { "source": { "source": "github", "repo": "HenriPett/claude-plugins" } }
  },
  "enabledPlugins": {
    "voz-para-prompt@henrique-plugins": true,
    "savvy-progress@henrique-plugins": true
  }
}
```

## Testes

```bash
claude plugin test plugins/voz-para-prompt
```

```bash
claude plugin test plugins/savvy-progress
```
