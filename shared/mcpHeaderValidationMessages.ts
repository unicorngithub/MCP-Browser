import { interpolateTemplate } from './appShellStrings'
import type { McpErrorI18n } from './types'

/** 与 src/locales/*.json 中 tools.mcpHeaderNameInvalid 一致 */
export const MCP_HEADER_NAME_INVALID_I18N_KEY = 'tools.mcpHeaderNameInvalid' as const

/** 与 src/locales/*.json 中 tools.mcpHeaderValueInvalid 一致 */
export const MCP_HEADER_VALUE_INVALID_I18N_KEY = 'tools.mcpHeaderValueInvalid' as const

const EN_NAME_INVALID =
  'Row {{row}}: the header name contains non-Latin-1 characters (e.g. CJK). Electron/Chromium cannot build this HTTP header locally. Use ASCII-only names (e.g. Authorization, X-Api-Key).'

const EN_VALUE_INVALID =
  'The value of header "{{name}}" contains non-Latin-1 characters (e.g. CJK). Use only letters, digits, and common symbols, or encode payload as Base64 (ASCII-only).'

export function mcpHeaderValidationDetailEnNameInvalid(row1Based: number): string {
  return interpolateTemplate(EN_NAME_INVALID, { row: String(row1Based) })
}

export function mcpHeaderValidationDetailEnValueInvalid(headerName: string): string {
  return interpolateTemplate(EN_VALUE_INVALID, { name: headerName })
}

export type McpHeaderValidationFailure = { detailEn: string; detailI18n: McpErrorI18n }

export function mcpHeaderValidationFailureName(row1Based: number): McpHeaderValidationFailure {
  return {
    detailEn: mcpHeaderValidationDetailEnNameInvalid(row1Based),
    detailI18n: {
      key: MCP_HEADER_NAME_INVALID_I18N_KEY,
      values: { row: row1Based },
    },
  }
}

export function mcpHeaderValidationFailureValue(headerName: string): McpHeaderValidationFailure {
  return {
    detailEn: mcpHeaderValidationDetailEnValueInvalid(headerName),
    detailI18n: {
      key: MCP_HEADER_VALUE_INVALID_I18N_KEY,
      values: { name: headerName },
    },
  }
}
