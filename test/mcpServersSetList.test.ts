import { describe, expect, it } from 'vitest'
import { parseMcpServersSetList } from '../shared/mcpServersJson'

describe('parseMcpServersSetList', () => {
  it('rejects non-array', () => {
    expect(parseMcpServersSetList({})).toEqual({ ok: false, error: '须为数组' })
  })

  it('accepts empty list', () => {
    expect(parseMcpServersSetList([])).toEqual({ ok: true, servers: [] })
  })

  it('accepts valid row with optional headers', () => {
    const r = parseMcpServersSetList([
      {
        id: 'a',
        name: 'Test',
        url: 'https://example.com/mcp',
        createdAt: 1,
        headers: [{ name: 'Authorization', value: 'Bearer x' }],
      },
    ])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.servers).toHaveLength(1)
      expect(r.servers[0].id).toBe('a')
      expect(r.servers[0].headers).toEqual([{ name: 'Authorization', value: 'Bearer x' }])
    }
  })

  it('rejects duplicate id', () => {
    const r = parseMcpServersSetList([
      { id: 'x', name: 'A', url: 'https://a.com/m', createdAt: 1 },
      { id: 'x', name: 'B', url: 'https://b.com/m', createdAt: 2 },
    ])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('重复')
  })

  it('rejects bad url', () => {
    const r = parseMcpServersSetList([{ id: 'a', name: 'A', url: 'ftp://x', createdAt: 1 }])
    expect(r.ok).toBe(false)
  })

  it('rejects non-array headers when present', () => {
    const r = parseMcpServersSetList([
      { id: 'a', name: 'A', url: 'https://a.com/m', createdAt: 1, headers: 'bad' as unknown as [] },
    ])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('headers')
  })
})
