import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const DITADO =
  'então é o seguinte né eu queria que você desse uma olhada no projeto da ascende tipo assim o app ' +
  'tá com um problema no login quando a pessoa tenta entrar com o google ele volta pra tela inicial ' +
  'e não entra quer dizer às vezes entra mas demora muito e aí eu queria que você investigasse isso ' +
  'e e corrigisse sem mexer na parte de pagamento que tá funcionando beleza e depois roda os testes ' +
  'e me fala o que você encontrou sabe porque eu preciso subir isso pra loja até sexta enfim é isso'

const ESCRITO =
  'Revise o módulo de login do app Ascende. Quando a pessoa entra com o Google, o app volta para a tela ' +
  'inicial em vez de concluir o acesso. Investigue a causa, corrija sem alterar o fluxo de pagamento e ' +
  'rode a suíte de testes. Depois, descreva o que encontrou. Preciso publicar a correção na loja até ' +
  'sexta-feira, então priorize uma solução pequena e segura. Se precisar mudar alguma dependência, ' +
  'me avise antes de instalar qualquer coisa nova no projeto.'

type Seen = {
  text?: string
  context?: readonly string[]
  asked: number
  forked: number
  completed: number
  classified: number
  forkPrompt?: string
  opened: string[]
}

async function setup(
  $: Engine,
  on: On,
  reply: string | null = '**Objetivo:** corrigir o login com Google.',
  rotulo = 'texto-digitado',
  // A bifurcação responde como a reescrita, a menos que o teste diga outra coisa.
  fork: string | null | 'nothing-to-fork' = reply,
) {
  const seen: Seen = { asked: 0, forked: 0, completed: 0, classified: 0, opened: [] }
  // O relógio só anda quando o teste manda: o limite de tempo da bifurcação não dispara sozinho.
  mock.clock(on, { now: Date.parse('2026-11-09T12:00:00Z') })
  const usage = { input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
  on('model.fork', (_, e) => {
    seen.asked += 1
    seen.forked += 1
    seen.forkPrompt = e.prompt
    const value =
      fork === 'nothing-to-fork'
        ? { isAnswered: false, reason: 'nothing-to-fork' }
        : fork === null
          ? { isAnswered: false, reason: 'empty-reply', usage }
          : { isAnswered: true, text: fork, usage }
    return { value } as never
  })
  on('model.classify', () => {
    seen.classified += 1
    return { value: rotulo } as never
  })
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('model.complete', () => {
    seen.asked += 1
    seen.completed += 1
    return {
      value: reply === null ? { isAnswered: false, reason: 'empty-reply', usage } : { isAnswered: true, text: reply, usage },
    } as never
  })
  on('ui.status', () => ({ value: undefined }))
  on('ui.open', (_, e) => {
    seen.opened.push(e.id)
    return { value: { isPlaced: true } } as never
  })
  // O que o próprio Claude Code desenharia embaixo da faixa.
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  on('command.register', () => ({ value: { command: 'voz' } }) as never)
  on('ui.toast', () => ({ value: undefined }))
  on('prompt.submit', (_, e) => {
    seen.text = e.text
    seen.context = e.context
    return { text: e.text, context: e.context }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  return seen
}

const submit = ($: Engine, text: string, kind = 'composer') =>
  $.prompt.submit({ text, wait: false, origin: { kind } } as never)

test('um pedido longo ditado é reorganizado e o original vai para o contexto', async ($, on) => {
  const seen = await setup($, on)
  await submit($, DITADO)
  expect(seen.asked).toBe(1)
  expect(seen.text?.startsWith('**Objetivo:** corrigir o login com Google.')).toBe(true)
  expect(seen.text?.includes('voz-para-prompt')).toBe(true)
  expect(seen.context?.some(c => c.includes(DITADO))).toBe(true)
})

test('um pedido longo escrito com pontuação passa direto', async ($, on) => {
  const seen = await setup($, on)
  await submit($, ESCRITO)
  expect(seen.asked).toBe(0)
  expect(seen.text).toBe(ESCRITO)
})

test('um pedido curto passa direto, mesmo com vícios', async ($, on) => {
  const seen = await setup($, on)
  await submit($, 'então né tipo roda os testes aí')
  expect(seen.asked).toBe(0)
})

test('o prefixo voz: força a reescrita de um pedido curto', async ($, on) => {
  const seen = await setup($, on)
  await submit($, 'voz: roda os testes e me fala')
  expect(seen.asked).toBe(1)
})

test('o prefixo cru: pula a reescrita e some do texto', async ($, on) => {
  const seen = await setup($, on)
  await submit($, `cru: ${DITADO}`)
  expect(seen.asked).toBe(0)
  expect(seen.text).toBe(DITADO)
})

test('mensagens que não vêm da pessoa nunca são reescritas', async ($, on) => {
  const seen = await setup($, on)
  await submit($, DITADO, 'task-notification')
  expect(seen.asked).toBe(0)
})

test('se o modelo falha, o pedido segue como foi ditado', async ($, on) => {
  const seen = await setup($, on, null)
  await submit($, DITADO)
  expect(seen.forked).toBe(1)
  expect(seen.completed).toBe(1)
  expect(seen.text).toBe(DITADO)
})

test('modo sempre reescreve um pedido longo escrito', { options: { modo: 'sempre' } }, async ($, on) => {
  const seen = await setup($, on)
  await submit($, ESCRITO)
  expect(seen.asked).toBe(1)
})

test('modo desligado não reescreve nem o ditado', { options: { modo: 'desligado' } }, async ($, on) => {
  const seen = await setup($, on)
  await submit($, DITADO)
  expect(seen.asked).toBe(0)
})

const CURTO_DITADO =
  'É, vamos fazer o teste aqui. Então, né, aqui, né, vamos ver se o mod tal funciona tal e vamos ver se ' +
  'funcionar legal, já torne como um plugin e daí a gente vê se fica maneiro.'

const CURTO_ESCRITO =
  'Atualize o README do projeto com as instruções de instalação do plugin, inclua o comando de teste e ' +
  'explique as três opções de configuração. Mantenha o texto curto e em português, sem emojis.'

test('um pedido curto mas cheio de vícios é reorganizado', async ($, on) => {
  const seen = await setup($, on)
  await submit($, CURTO_DITADO)
  expect(seen.asked).toBe(1)
})

test('um pedido curto escrito passa direto', async ($, on) => {
  const seen = await setup($, on)
  await submit($, CURTO_ESCRITO)
  expect(seen.asked).toBe(0)
})

const ZONA_CINZENTA =
  'Vamos fazer de novo aqui o teste, né? Vamos ver se funciona aqui o negócio de pegar e corrigir o áudio ' +
  'longo que eu tô mandando aqui. Se funcionar, você vai pegar, né, aquele esquema e vai transformar em um ' +
  'plugin automático para carregar em todas as sessões.'

test('na zona cinzenta, o Haiku diz que é fala e o pedido é reorganizado', async ($, on) => {
  const seen = await setup($, on, undefined, 'fala-transcrita-de-audio')
  await submit($, ZONA_CINZENTA)
  expect(seen.classified).toBe(1)
  expect(seen.asked).toBe(1)
})

test('na zona cinzenta, o Haiku diz que é texto digitado e o pedido passa direto', async ($, on) => {
  const seen = await setup($, on)
  await submit($, ZONA_CINZENTA)
  expect(seen.classified).toBe(1)
  expect(seen.asked).toBe(0)
})

test('texto sem nenhum sinal de fala nem chega a ser classificado', async ($, on) => {
  const seen = await setup($, on)
  await submit($, CURTO_ESCRITO)
  expect(seen.classified).toBe(0)
})

test('por padrão a reescrita lê a conversa: bifurca a sessão e não chama o Haiku', async ($, on) => {
  const seen = await setup($, on)
  await submit($, DITADO)
  expect(seen.forked).toBe(1)
  expect(seen.completed).toBe(0)
  expect(seen.forkPrompt?.startsWith('PAUSA')).toBe(true)
  expect(seen.forkPrompt?.includes(DITADO)).toBe(true)
})

test('na primeira mensagem não há conversa: cai na reescrita só da transcrição', async ($, on) => {
  const seen = await setup($, on, undefined, undefined, 'nothing-to-fork')
  await submit($, DITADO)
  expect(seen.forked).toBe(1)
  expect(seen.completed).toBe(1)
  expect(seen.text?.startsWith('**Objetivo:**')).toBe(true)
})

test('contexto so-transcricao nunca bifurca', { options: { contexto: 'so-transcricao' } }, async ($, on) => {
  const seen = await setup($, on)
  await submit($, DITADO)
  expect(seen.forked).toBe(0)
  expect(seen.completed).toBe(1)
})

const BAND = { plugin: 'voz-para-prompt', component: 'AbovePrompt', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100 } } as const
const PANE = {
  plugin: 'voz-para-prompt',
  component: 'Pane',
  requestId: 'voz-para-prompt',
  props: { title: 'Voz → prompt', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

const faixa = async ($: Engine, surface: 'terminal' | 'desktop') => {
  const ui = await $.ui.mount({ ...BAND, surface } as never)
  const t = await ui.find({ type: 'Text', text: /reorganizado/ })
  await ui.unmount()
  return t?.text
}

for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: depois de uma reescrita aparece a faixa, e o próximo pedido a apaga`, async ($, on) => {
    await setup($, on)
    expect(await faixa($, surface)).toBeUndefined()
    await submit($, DITADO)
    expect(await faixa($, surface)).toBe('🎙 Seu pedido de voz foi reorganizado (lendo a conversa)')
    await submit($, ESCRITO)
    expect(await faixa($, surface)).toBeUndefined()
  })

  test(`${surface}: o painel mostra como foi enviado e o que foi ditado`, async ($, on) => {
    await setup($, on)
    await submit($, DITADO)
    const ui = await $.ui.mount({ ...PANE, surface } as never)
    expect((await ui.find({ type: 'Text', text: /^Como foi enviado/ }))?.text).toBe('Como foi enviado ao Claude')
    expect((await ui.find({ type: 'Text', text: /^então é o seguinte/ }))?.text).toBe(DITADO)
    await ui.unmount()
  })
}

test('o painel vazio diz que ainda não houve reescrita', async ($, on) => {
  await setup($, on)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' } as never)
  expect((await ui.find({ type: 'Text' }))?.text).toBe('Nenhum pedido de voz reorganizado nesta sessão ainda.')
  await ui.unmount()
})

test('/voz abre o painel', async ($, on) => {
  const seen = await setup($, on)
  await submit($, DITADO)
  const r = await $.command.run({ command: 'voz', args: '' } as never)
  expect(seen.opened).toEqual(['voz-para-prompt'])
  expect((r as { text?: string }).text).toBe('Painel Voz → prompt aberto.')
})
