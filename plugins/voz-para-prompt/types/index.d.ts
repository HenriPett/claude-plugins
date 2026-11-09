export type Reescrita = {
  /** O pedido como foi enviado ao Claude (markdown). */
  organizado: string
  /** A transcrição como foi ditada. */
  original: string
  /** conversa: a bifurcação leu a conversa; transcricao: o Haiku leu só o áudio. */
  via: 'conversa' | 'transcricao'
  /** Quando foi reorganizado (ms). */
  hora: number
}

declare module 'claude-code' {
  interface PluginState {
    'voz-para-prompt': { historico: Shaped<Reescrita[]>; faixa: boolean }
  }
}
