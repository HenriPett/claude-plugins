import { expect, mock, test } from 'claude-code/testing'

const PLUGIN = 'savvy-progress'
const band = { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 100, scroll: { offset: 0, bodyRows: 4 }, view: {} }
const pane = { title: '', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 30 }, view: {} } as const

// Any subagent, not only a savvy-flow worker, puts the progress bar above the prompt.
for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: a plain subagent draws the bar, and each role its own person`, async ($, on) => {
    mock.clock(on, { now: Date.parse('2026-11-09T18:00:00Z') })
    on('ui.open', () => ({ value: { isPlaced: true } }))
    let n = 0
    on('agent.spawn', () => ({ model: 'claude-opus-5-5', agentId: `a${++n}` }) as never)

    await $.agent.spawn({ prompt: 'Fix the bug', description: 'Fix the bug', subagentType: 'general-purpose' } as never)
    await $.agent.spawn({ prompt: 'Find the code', description: 'Find the code', subagentType: 'Explore' } as never)

    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: band })
    expect((await ui.find({ key: 'savvy-agents' }))?.props.label).toBe('×2')
    if (surface === 'desktop') {
      const row = String((await ui.find({ type: 'Svg' }))?.props.source)
      expect(row).toContain('Tasks 0/2')
      expect(row).toContain('r-explore')
    } else {
      expect(await ui.find({ type: 'Text', text: /^Tasks 0\/2$/ })).toBeDefined()
    }

    if (surface === 'desktop') {
      const panel = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: 'savvy-agents', props: pane })
      const drawn = (await panel.findAll({ type: 'Svg' })).map(el => String(el.props.source)).join('')
      expect(drawn).toContain('r-dev')
      expect(drawn).toContain('r-explore')
      expect(drawn).not.toContain('NaN')
      expect(drawn).not.toContain('undefined')
    }
  })
}
