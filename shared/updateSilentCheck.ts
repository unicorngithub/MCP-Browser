/** 静默检查更新的最小间隔（毫秒），默认 24h */
export const SILENT_UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

/** 根据上次检查时间（ISO 字符串）判断本次是否应再检查 */
export function shouldRunSilentUpdaterCheck(
  lastCheckIso: string | null | undefined,
  nowMs: number,
): boolean {
  if (lastCheckIso == null || lastCheckIso === '') return true
  const prev = Date.parse(lastCheckIso)
  if (Number.isNaN(prev)) return true
  return nowMs - prev >= SILENT_UPDATE_CHECK_INTERVAL_MS
}
