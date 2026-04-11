import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import UpdateModal from '@/components/update/Modal'

/**
 * 菜单「帮助 → 使用说明」：在渲染进程内展示，与主窗口同一套 Tailwind 浅/深主题。
 */
export function UsageGuideModal() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const api = window.appShellMenu
    if (!api?.onUsageGuideRequest) return
    return api.onUsageGuideRequest(() => setOpen(true))
  }, [])

  const close = t('update.close')
  const paragraphs = t('usageGuide.content')
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <UpdateModal
      open={open}
      title={t('usageGuide.title')}
      titleId="mcp-usage-guide-title"
      cancelText={close}
      okText={close}
      onCancel={() => setOpen(false)}
      onOk={() => setOpen(false)}
    >
      <div className="space-y-3">
        {paragraphs.map((p, i) => (
          <p key={i} className="leading-relaxed">
            {p}
          </p>
        ))}
      </div>
    </UpdateModal>
  )
}
