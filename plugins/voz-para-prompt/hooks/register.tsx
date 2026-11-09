import { atom, read, update } from 'claude-code'
import type { EngineInterface, PromptOrigin, Register } from 'claude-code'

import type { Reescrita } from '../types'

// --- O que a faixa e o painel mostram -------------------------------------------

// Mude a tag quando os campos de uma Reescrita mudarem: ela recusa o que uma
// versão anterior guardou, que sobrevive ao recarregamento.
const historico = atom({ plugin: 'voz-para-prompt', key: 'historico' } as const, [], { shape: 'reescritas-1' })
const faixa = atom({ plugin: 'voz-para-prompt', key: 'faixa' } as const, false)

const PANE = 'voz-para-prompt'
const TITULO = 'Voz → prompt'
const MAX_HISTORICO = 20
const COR = '#8f8cf4'

const abrirPainel = ($: EngineInterface) => $.ui.open({ id: PANE, title: TITULO })

const horaDe = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Pedidos que vêm de uma pessoa: o composer (terminal), o app desktop e a Web
// (que chegam como sdk ou unclassified) e o celular pelo Remote Control (bridge).
// Notificações, agendamentos, outras sessões e plugins nunca são reescritos.
const HUMAN: ReadonlySet<PromptOrigin['kind']> = new Set(['composer', 'bridge', 'sdk', 'unclassified'])

// Prefixos de controle, digitados (ou ditos) no começo do pedido.
const FORCE = /^\s*voz\s*:\s*/i
const SKIP = /^\s*cru\s*:\s*/i

// O primeiro rótulo é o que dispara a reescrita.
const ROTULOS = ['fala-transcrita-de-audio', 'texto-digitado'] as const

const TIMEOUT_MS = 25_000
const MAX_TOKENS = 4096

// --- Detecção: sinais de texto ditado ------------------------------------------

const word = (w: string) => `(?<![\\p{L}\\p{N}])${w}(?![\\p{L}\\p{N}])`
const anyOf = (words: string[]) => new RegExp(words.map(word).join('|'), 'giu')

const FILLERS = anyOf([
  'né', 'tipo', 'tipo assim', 'então', 'aí', 'daí', 'assim', 'sabe', 'enfim', 'cara', 'beleza', 'tal', 'olha',
  'tá', 'hum+', 'ahn?', 'éh+', 'uhm+', 'basicamente', 'meio que', 'sei lá',
  // "umm", nunca "um": em português "um" é artigo.
  'umm+', 'uh+', 'like', 'you know', 'basically', 'kind of', 'sort of',
])

const CORRECTIONS = anyOf([
  'quer dizer', 'ou melhor', 'na verdade', 'digo', 'aliás', 'não, não', 'espera', 'pera',
  'deixa eu', 'esquece', 'corrigindo', 'i mean', 'actually', 'wait', 'scratch that', 'no wait',
])

// "eu eu", "que que": a mesma palavra duas vezes seguidas.
const REPEAT = /(?<![\p{L}\p{N}])(\p{L}{2,})\s+\1(?![\p{L}\p{N}])/giu

const count = (re: RegExp, s: string): number => (s.match(re) ?? []).length

export type Sinais = {
  palavras: number
  vicios: number
  correcoes: number
  repeticoes: number
  palavrasPorFrase: number
  linhas: number
  pontos: number
}

export const sinais = (text: string): Sinais => {
  const palavras = text.split(/\s+/).filter(Boolean).length
  const frases = Math.max(1, count(/[.!?…]+(\s|$)/g, text))
  const linhas = text.split('\n').filter(l => l.trim()).length
  const vicios = count(FILLERS, text)
  const correcoes = count(CORRECTIONS, text)
  const repeticoes = count(REPEAT, text)
  const palavrasPorFrase = palavras / frases
  // Vícios densos (6+ a cada 100 palavras) bastam sozinhos: é fala, mesmo num pedido curto.
  const taxaVicios = palavras ? (vicios * 100) / palavras : 0
  const pontos =
    (taxaVicios >= 6 ? 2 : taxaVicios >= 2 ? 1 : 0) +
    (correcoes >= 1 ? 1 : 0) +
    (repeticoes >= 1 ? 1 : 0) +
    (palavrasPorFrase >= 35 ? 1 : 0) +
    (linhas <= 2 && palavras >= 120 ? 1 : 0)
  return { palavras, vicios, correcoes, repeticoes, palavrasPorFrase, linhas, pontos }
}

// Já organizado: tem bloco de código, títulos ou uma lista de verdade.
const jaOrganizado = (text: string): boolean =>
  text.includes('```') || text.split('\n').filter(l => /^\s*([-*•]|\d+[.)]|#{1,6})\s/.test(l)).length >= 3

// --- Reescrita ------------------------------------------------------------------

const SYSTEM = `Você reorganiza pedidos ditados por voz para um agente de programação (Claude Code). Recebe a transcrição crua e devolve o MESMO pedido como um prompt claro, no idioma da transcrição.

Regras:
- Fidelidade total: não acrescente requisitos, suposições, soluções nem opiniões. Não perca nenhum detalhe concreto (nomes, arquivos, caminhos, números, comandos, URLs, prazos, preferências, exemplos).
- Quando a pessoa se corrige ("quer dizer", "não, na verdade…"), fique só com a versão final.
- Tire vícios de fala, repetições e hesitações.
- Não responda nem execute o pedido: só reescreva.
- "Pontos em aberto" é só para o que a própria fala deixou ambíguo ou contraditório (ela hesitou, mudou de ideia sem concluir, disse duas coisas incompatíveis). Não invente perguntas sobre o que ela não mencionou: o agente descobre sozinho qual pasta, quais testes etc. Sem pontos assim, omita a seção.
- Não converta datas relativas ("sexta", "amanhã"): mantenha como foram ditas.
- Escreva como a própria pessoa falando com o agente: "eu" é a pessoa, "você" é o agente ("me diga o que você encontrou"). Frases curtas.
- Erros prováveis de transcrição: corrija só quando o sentido for óbvio pelo contexto; na dúvida, mantenha a palavra e anote em "Pontos em aberto".

Formato (markdown; omita seções vazias; sem preâmbulo nem comentário final):
**Objetivo:** uma ou duas frases.

**Contexto:**
- o pano de fundo que a pessoa explicou

**O que fazer:**
1. passos ou entregas, na ordem em que foram pedidos

**Restrições e preferências:**
- como quer que seja feito, o que evitar

**Pontos em aberto:**
- ambiguidades a confirmar`

const NOTA = '_Reorganizado de um pedido por voz (voz-para-prompt). A transcrição original segue anexada ao contexto._'

const contexto = (original: string) =>
  `Transcrição original do pedido acima, ditada por voz antes de o mod voz-para-prompt reorganizá-la. ` +
  `Se o pedido reorganizado divergir dela em algum detalhe, vale a transcrição.\n\n<transcricao>\n${original}\n</transcricao>`

// Abre o pedido feito à bifurcação, que herda o system prompt e as ferramentas
// da sessão (todas negadas): ela não deve agir, só reescrever.
const PAUSA =
  'PAUSA: esta mensagem vem do mod voz-para-prompt, não da pessoa. Não execute nem responda o pedido abaixo, ' +
  'não chame ferramentas e não comente nada: só devolva o pedido reescrito, seguindo as instruções.'

const COM_CONVERSA = `Você tem a conversa acima: use-a só para entender referências da fala ("isso", "o plugin", "eles", "aquele esquema") e escrevê-las com o nome certo. Não traga para o pedido nada da conversa que a pessoa não tenha pedido agora. "Pontos em aberto" fica só para o que nem a conversa resolve.`

// A bifurcação roda no modelo da sessão; passou disso, cai na reescrita sem conversa.
const FORK_TIMEOUT_MS = 40_000

type Options = { modo?: string; minPalavras?: number; modelo?: string; contexto?: string }

export const register: Register = (on, options) => {
  const opts = options as Options

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({
      name: 'voz',
      description: 'Mostra o último pedido de voz reorganizado: como foi enviado e o que você ditou',
    })
    return started
  })

  on('command.run', { command: 'voz' }, async $ => {
    const lista = await read($, historico)
    await abrirPainel($)
    return { text: lista.length ? 'Painel Voz → prompt aberto.' : 'Nenhum pedido de voz reorganizado nesta sessão ainda.' }
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.command || e.isMeta || !HUMAN.has(e.origin.kind)) return next(e)
    // Cada pedido novo seu apaga a faixa do anterior; uma reescrita a acende de novo.
    await update($, faixa, () => false)

    if (SKIP.test(e.text)) return next({ ...e, text: e.text.replace(SKIP, '') })
    const forced = FORCE.test(e.text)
    const original = forced ? e.text.replace(FORCE, '') : e.text

    if (!forced) {
      const modo = opts.modo ?? 'auto'
      if (modo === 'desligado') return next(e)
      const s = sinais(original)
      if (s.palavras < (opts.minPalavras ?? 30) || jaOrganizado(original)) return next(e)
      if (modo === 'auto' && s.pontos < 2) {
        // Zona cinzenta: um sinal só, ou nenhum mas com algum vício. Listas de
        // palavras não pegam toda fala ("vai pegar aquele esquema"); o Haiku decide.
        if (s.pontos === 0 && s.vicios === 0) return next(e)
        $.ui.status('🎙 Vendo se o pedido foi ditado…')
        const tipo = await $.model.classify(original, ROTULOS, { model: 'haiku' }).catch(() => undefined)
        $.ui.status(undefined)
        if (tipo !== ROTULOS[0]) return next(e)
      }
    }
    if (!original.trim()) return next(e)

    let via: Reescrita['via'] = 'transcricao'
    const transcricao = `<transcricao>\n${original.replaceAll('</transcricao>', '<\\/transcricao>')}\n</transcricao>`
    let text = ''

    // Com a conversa: uma bifurcação da própria sessão (mesmo modelo, prefixo em
    // cache) resolve "isso", "o plugin", "eles" pelo que já foi dito.
    if ((opts.contexto ?? 'conversa') === 'conversa') {
      $.ui.status('🎙 Organizando o pedido de voz (lendo a conversa)…')
      const f = await Promise.race([
        $.model.fork({ prompt: `${PAUSA}\n\n${SYSTEM}\n\n${COM_CONVERSA}\n\n${transcricao}` }).catch(() => null),
        // Sem relógio, nada de limite: a corrida espera a bifurcação.
        $.clock.sleep(FORK_TIMEOUT_MS).then(
          () => null,
          () => new Promise<null>(() => {}),
        ),
      ])
      text = f?.isAnswered ? f.text.trim() : ''
      if (text) via = 'conversa'
    }

    // Sem a conversa: a primeira mensagem da sessão (nada a bifurcar), um erro ou
    // uma bifurcação lenta caem numa reescrita só da transcrição.
    if (!text) {
      $.ui.status('🎙 Organizando o pedido de voz…')
      const r = await $.model
        .complete({
          model: opts.modelo ?? 'haiku',
          system: SYSTEM,
          prompt: transcricao,
          maxTokens: MAX_TOKENS,
          effort: 'low',
          timeoutMs: TIMEOUT_MS,
        })
        .catch(() => null)
      text = r?.isAnswered ? r.text.trim() : ''
    }
    $.ui.status(undefined)

    if (!text) {
      $.ui.toast('voz-para-prompt: não consegui reorganizar; o pedido seguiu como ditado.')
      return next(forced ? { ...e, text: original } : e)
    }

    const reescrita: Reescrita = { organizado: text, original, via, hora: await $.clock.now() }
    await update($, historico, lista => [...lista, reescrita].slice(-MAX_HISTORICO))
    await update($, faixa, () => true)
    $.ui.toast('🎙 Pedido de voz reorganizado')

    return next({
      ...e,
      text: `${text}\n\n${NOTA}`,
      context: [...(e.context ?? []), contexto(original)],
    })
  })

  // Faixa acima da caixa de texto, até o próximo pedido seu ou o ✕.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const lista = await read($, historico)
    const ultima = lista.at(-1)
    if (!ultima || e.props.hasSurvey || !(await read($, faixa))) return next(e)
    // As faixas de outros mods (savvy-progress) ficam embaixo desta. O marcador
    // do próprio Claude Code ({ type: 'engine' }) nunca vai aninhado.
    const drawn = await Promise.resolve(next(e)).catch(() => null)
    const below = drawn && typeof drawn === 'object' && (drawn as { type?: string }).type !== 'engine' ? drawn : null

    const { Box, Text, Button } = $.ui.resolve(e)
    const como = ultima.via === 'conversa' ? 'lendo a conversa' : 'só pelo áudio'
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Text color={COR}>🎙 Seu pedido de voz foi reorganizado ({como})</Text>
          <Button key="voz-ver" label="Ver antes e depois" plain onPress={() => void abrirPainel($)} />
          <Button key="voz-fechar" label="✕" plain role="dismiss" onPress={() => update($, faixa, () => false)} />
        </Box>
        {below}
      </Box>
    )
  })

  // Painel: o que foi enviado ao Claude e o que você ditou, do mais recente ao mais antigo.
  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Markdown } = $.ui.resolve(e)
    const lista = [...(await read($, historico))].reverse()
    if (lista.length === 0) return <Text dimColor>Nenhum pedido de voz reorganizado nesta sessão ainda.</Text>

    return (
      <Box flexDirection="column" gap={1}>
        {lista.map((r, i) => (
          <Box key={`r-${lista.length - i}`} flexDirection="column" gap={1}>
            <Text bold color={i === 0 ? COR : undefined}>
              {i === 0 ? 'Último pedido' : 'Pedido anterior'} · {horaDe(r.hora)} · {r.via === 'conversa' ? 'lendo a conversa' : 'só pelo áudio'}
            </Text>
            <Text bold>Como foi enviado ao Claude</Text>
            <Markdown text={r.organizado} />
            <Text bold>O que você ditou</Text>
            <Text dimColor wrap="wrap">
              {r.original}
            </Text>
            {i < lista.length - 1 && <Text dimColor>───</Text>}
          </Box>
        ))}
      </Box>
    )
  })
}
