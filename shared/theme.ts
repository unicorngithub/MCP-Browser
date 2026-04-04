export const THEME_STORAGE_KEY = 'mcp-browser-theme'

export type ThemePreference = 'light' | 'dark' | 'system'

export function parseThemePreference(raw: string | null): ThemePreference {
  if (raw === 'light' || raw === 'dark' || raw === 'system') return raw
  return 'system'
}

export function isDarkEffective(pref: ThemePreference, systemPrefersDark: boolean): boolean {
  if (pref === 'dark') return true
  if (pref === 'light') return false
  return systemPrefersDark
}
