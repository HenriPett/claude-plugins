import { expect, test } from 'claude-code/testing'

// autoOpen 'always' (the default in this fork): the panel opens with every session.
for (const surface of ['terminal', 'desktop'] as const) {
  test(`${surface}: the panel opens when the session starts`, async ($, on) => {
    const opened: string[] = []
    on('ui.open', (_$, e) => {
      opened.push(e.id)
      return { value: { isPlaced: true } }
    })
    on('settings.read', () => ({ value: {} }))
    on('env.get', () => ({ value: undefined }))
    on('tool.register', () => ({ value: undefined }))
    on('command.register', () => ({ value: undefined }))
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    await $.session.start({ cwd: '/', surface, isInteractive: true })
    expect(opened).toEqual(['savvy-agents'])
  })

  test(`${surface}: with autoOpen savvy the session starts with no panel`, { options: { autoOpen: 'savvy' } }, async ($, on) => {
    const opened: string[] = []
    on('ui.open', (_$, e) => {
      opened.push(e.id)
      return { value: { isPlaced: true } }
    })
    on('settings.read', () => ({ value: {} }))
    on('env.get', () => ({ value: undefined }))
    on('tool.register', () => ({ value: undefined }))
    on('command.register', () => ({ value: undefined }))
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    await $.session.start({ cwd: '/', surface, isInteractive: true })
    expect(opened).toEqual([])
  })
}
