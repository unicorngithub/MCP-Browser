import { describe, expect, it } from 'vitest'
import {
  MCP_HEADER_NAME_INVALID_I18N_KEY,
  MCP_HEADER_VALUE_INVALID_I18N_KEY,
  mcpHeaderValidationDetailEnNameInvalid,
  mcpHeaderValidationDetailEnValueInvalid,
  mcpHeaderValidationFailureName,
  mcpHeaderValidationFailureValue,
} from '../shared/mcpHeaderValidationMessages'

describe('mcpHeaderValidationMessages', () => {
  it('failure name carries i18n key and English detail', () => {
    const f = mcpHeaderValidationFailureName(2)
    expect(f.detailI18n.key).toBe(MCP_HEADER_NAME_INVALID_I18N_KEY)
    expect(f.detailI18n.values).toEqual({ row: 2 })
    expect(f.detailEn).toBe(mcpHeaderValidationDetailEnNameInvalid(2))
    expect(f.detailEn).toContain('Row 2:')
  })

  it('failure value carries i18n key and English detail', () => {
    const f = mcpHeaderValidationFailureValue('Authorization')
    expect(f.detailI18n.key).toBe(MCP_HEADER_VALUE_INVALID_I18N_KEY)
    expect(f.detailI18n.values).toEqual({ name: 'Authorization' })
    expect(f.detailEn).toContain('Authorization')
  })
})
