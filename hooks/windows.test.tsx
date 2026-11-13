import { expect, mock, test } from 'claude-code/testing'

const PANE = {
  plugin: 'session-lens',
  component: 'Pane',
  requestId: 'session-lens',
  props: { title: 'Session lens', isFocused: false, bodyColumns: 100, placement: 'dock', scroll: { offset: 0, bodyRows: 400 }, view: {} },
} as const

const ask = (ts: string, pv: string) => ({ t: 'user', id: null, o: 'human', pv, ts, u: null, c: [{ k: 'text', n: 8, w: 0 }] })
const reply = (id: string, ts: string, cr: number) => ({ t: 'assistant', id, ts, u: { i: 100, o: 50, cr, cw: 0 }, md: 'claude-opus-5-5', ef: 'medium', c: [{ k: 'text', n: 4, w: 0 }] })
const square = { color: 'permission', isFilled: true, categoryName: 'System tools', tokens: 1, percentage: 1, squareFullness: 1 }

// Windows sets no HOME: the person's folder is USERPROFILE, spelled with backslashes. The record is still found, under
// the same folder with the slashes every path here is built with.
test('with no HOME, the record is read from under USERPROFILE', async ($, on) => {
  mock.clock(on)
  on('command.register', () => ({ value: { command: 'session-lens' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('command.run', () => ({ text: '' }))
  on('env.get', (_, e) => ({ value: JSON.stringify(e).includes('USERPROFILE') ? 'C:\\Users\\u' : undefined }))
  on('session.root', () => ({ value: 'C:\\work\\app' }))
  on('session.cwd', () => ({ value: 'C:\\work\\app' }))
  on('session.id', () => ({ value: 'sid' }))
  on('session.messages', () => ({ value: [] }))
  on('agent.list', () => ({ value: [] }))
  on('fs.list', () => ({ value: [{ name: 'sid.jsonl', kind: 'file' as const, size: 100, mtimeMs: 0, isLink: false }] }))
  on('fs.read', () => ({ value: '{}' }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      rateLimits: [],
      context: {
        window: 200000,
        breakdown: {
          model: 'm', maxTokens: 200000, autocompactSource: 'auto' as const, isAutoCompactEnabled: true, apiUsage: null, percentage: 1, totalTokens: 30000, rawMaxTokens: 200000, autoCompactThreshold: 160000,
          categories: [{ name: 'System tools', tokens: 600, color: 'permission', kind: 'used', isDeferred: false }],
          gridRows: [[square]], mcpTools: [], memoryFiles: [], agents: [],
        },
      },
    },
  }))
  const record = [
    ask('2026-01-01T00:00:00.000Z', 'first'),
    reply('m0', '2026-01-01T00:00:03.000Z', 20_000),
    ask('2026-01-01T00:01:00.000Z', 'second'),
    reply('m1', '2026-01-01T00:01:03.000Z', 25_000),
  ].map(r => JSON.stringify(r))
  const ran = (exitCode: number, stdout: string) => ({ value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } })
  const read: string[] = []
  on('process.run', (_, e) => {
    const argv = (e as { argv: string[] }).argv
    if (argv.includes('--version')) return ran(0, 'jq-1.7')
    if (argv[0] !== 'jq') return ran(2, '')
    read.push(argv.at(-1) ?? '')
    return argv.some(a => a.includes('api-request-shape')) ? ran(2, '') : ran(0, record.join('\n'))
  })
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'session-lens', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal', viewport: { columns: 100, rows: 400 } })
  const text = async (re: RegExp) => (await ui.find({ type: 'Text', text: re }))?.text
  expect(await text(/Could not read the session transcript/)).toBeFalsy()
  expect(await text(/ · ≈\d+ turns$/)).toBeTruthy()
  expect(read).toContain('C:/Users/u/.claude/projects/C--work-app/sid.jsonl')
  await ui.unmount()
})
