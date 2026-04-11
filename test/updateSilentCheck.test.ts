import { describe, expect, test } from 'vitest'
import {
  shouldRunSilentUpdaterCheck,
  SILENT_UPDATE_CHECK_INTERVAL_MS,
} from '../shared/updateSilentCheck'

describe('shouldRunSilentUpdaterCheck', () => {
  const t0 = Date.UTC(2026, 0, 1, 12, 0, 0)

  test('无记录时应检查', () => {
    expect(shouldRunSilentUpdaterCheck(null, t0)).toBe(true)
    expect(shouldRunSilentUpdaterCheck('', t0)).toBe(true)
    expect(shouldRunSilentUpdaterCheck(undefined, t0)).toBe(true)
  })

  test('非法时间字符串应检查', () => {
    expect(shouldRunSilentUpdaterCheck('not-a-date', t0)).toBe(true)
  })

  test('未满间隔不应检查', () => {
    const last = new Date(t0 - SILENT_UPDATE_CHECK_INTERVAL_MS + 60_000).toISOString()
    expect(shouldRunSilentUpdaterCheck(last, t0)).toBe(false)
  })

  test('已满间隔应检查', () => {
    const last = new Date(t0 - SILENT_UPDATE_CHECK_INTERVAL_MS - 60_000).toISOString()
    expect(shouldRunSilentUpdaterCheck(last, t0)).toBe(true)
  })
})
