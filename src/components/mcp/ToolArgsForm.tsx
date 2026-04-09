import { useTranslation } from 'react-i18next'
import type { ParsedField } from '@/lib/mcpInputSchema'

const inputBase =
  'w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none ring-cyan-500/25 transition focus:border-cyan-500/50 focus:ring-2 dark:border-zinc-700/80 dark:bg-zinc-950/80 dark:text-zinc-100 dark:focus:border-cyan-500/45'

interface ToolArgsFormProps {
  fields: ParsedField[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}

export function ToolArgsForm({ fields, values, onChange }: ToolArgsFormProps) {
  const { t } = useTranslation()
  if (fields.length === 0) return null

  return (
    <div className="flex flex-col gap-4">
      {fields.map((f) => {
        const label = f.title ?? f.key
        const id = `tool-arg-${f.key}`
        const hint = f.description ? (
          <p className="mt-1 select-none text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-500">{f.description}</p>
        ) : null

        if (f.kind === 'enum' && f.enumValues?.length) {
          return (
            <div key={f.key}>
              <label htmlFor={id} className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {label}
                {f.required ? <span className="ml-1 text-amber-400/90">*</span> : null}
              </label>
              <select
                id={id}
                value={values[f.key] ?? ''}
                onChange={(e) => onChange(f.key, e.target.value)}
                className={`${inputBase} mt-1.5 cursor-pointer`}
              >
                {!f.required ? (
                  <option value="">{t('toolArgs.omit')}</option>
                ) : null}
                {f.enumValues.map((v) => (
                  <option key={String(v)} value={String(v)}>
                    {String(v)}
                  </option>
                ))}
              </select>
              {hint}
            </div>
          )
        }

        if (f.kind === 'boolean') {
          return (
            <div key={f.key}>
              <label htmlFor={id} className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {label}
                {f.required ? <span className="ml-1 text-amber-400/90">*</span> : null}
              </label>
              <select
                id={id}
                value={values[f.key] ?? ''}
                onChange={(e) => onChange(f.key, e.target.value)}
                className={`${inputBase} mt-1.5 cursor-pointer`}
              >
                {!f.required ? <option value="">{t('toolArgs.omit')}</option> : null}
                <option value="false">{t('toolArgs.boolFalse')}</option>
                <option value="true">{t('toolArgs.boolTrue')}</option>
              </select>
              {hint}
            </div>
          )
        }

        if (f.kind === 'number' || f.kind === 'integer') {
          return (
            <div key={f.key}>
              <label htmlFor={id} className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {label}
                {f.required ? <span className="ml-1 text-amber-400/90">*</span> : null}
                <span className="ml-2 font-mono text-[10px] font-normal text-zinc-500 dark:text-zinc-600">
                  {f.kind === 'integer' ? t('toolArgs.typeInteger') : t('toolArgs.typeNumber')}
                </span>
              </label>
              <input
                id={id}
                type="text"
                inputMode="decimal"
                value={values[f.key] ?? ''}
                onChange={(e) => onChange(f.key, e.target.value)}
                placeholder={f.kind === 'integer' ? t('toolArgs.placeholderInt') : t('toolArgs.placeholderNumber')}
                className={`${inputBase} mt-1.5 font-mono text-xs`}
              />
              {hint}
            </div>
          )
        }

        if (f.kind === 'json') {
          return (
            <div key={f.key}>
              <label htmlFor={id} className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                {label}
                {f.required ? <span className="ml-1 text-amber-400/90">*</span> : null}
                <span className="ml-2 font-mono text-[10px] font-normal text-zinc-500 dark:text-zinc-600">
                  {t('toolArgs.typeJson')}
                </span>
              </label>
              <textarea
                id={id}
                value={values[f.key] ?? ''}
                onChange={(e) => onChange(f.key, e.target.value)}
                spellCheck={false}
                rows={4}
                placeholder={t('toolArgs.placeholderJson')}
                className={`${inputBase} mt-1.5 resize-y font-mono text-xs leading-relaxed`}
              />
              {hint}
            </div>
          )
        }

        return (
          <div key={f.key}>
            <label htmlFor={id} className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              {label}
              {f.required ? <span className="ml-1 text-amber-400/90">*</span> : null}
              <span className="ml-2 font-mono text-[10px] font-normal text-zinc-500 dark:text-zinc-600">
                {t('toolArgs.typeString')}
              </span>
            </label>
            <input
              id={id}
              type="text"
              value={values[f.key] ?? ''}
              onChange={(e) => onChange(f.key, e.target.value)}
              className={`${inputBase} mt-1.5 text-sm`}
            />
            {hint}
          </div>
        )
      })}
    </div>
  )
}
