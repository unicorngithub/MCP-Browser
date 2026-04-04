export const LANGUAGE_STORAGE_KEY = 'mcp-browser-language'

export type AppLanguage = 'en' | 'zh-CN'

export function parseAppLanguage(raw: string | null): AppLanguage | null {
  if (raw === 'en' || raw === 'zh-CN') return raw
  return null
}

/** 无本地记录时的默认语言（与既有中文界面及 E2E 一致） */
export function getDefaultAppLanguage(): AppLanguage {
  return 'zh-CN'
}
