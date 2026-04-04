import { useTranslation } from 'react-i18next'
import { setAppLanguage } from '@/i18n/i18n'

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation()
  const lng = i18n.resolvedLanguage ?? i18n.language
  const isZh = lng === 'zh-CN' || lng.startsWith('zh')

  return (
    <div
      className="inline-flex shrink-0 rounded-lg border border-zinc-200/90 bg-zinc-100/80 p-0.5 dark:border-white/[0.08] dark:bg-zinc-900/50"
      role="group"
      aria-label={t('lang.switchToEn') + ' / ' + t('lang.switchToZh')}
    >
      <button
        type="button"
        onClick={() => setAppLanguage('en')}
        className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
          !isZh
            ? 'bg-white text-cyan-800 shadow-sm dark:bg-zinc-800 dark:text-cyan-200'
            : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300'
        }`}
        aria-pressed={!isZh}
        title={t('lang.switchToEn')}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setAppLanguage('zh-CN')}
        className={`rounded-md px-2 py-1 text-[10px] font-semibold transition ${
          isZh
            ? 'bg-white text-cyan-800 shadow-sm dark:bg-zinc-800 dark:text-cyan-200'
            : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300'
        }`}
        aria-pressed={isZh}
        title={t('lang.switchToZh')}
      >
        中文
      </button>
    </div>
  )
}
