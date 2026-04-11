import type { McpToolCallHttpTrace } from '@shared/types'
import { useTranslation } from 'react-i18next'
import UpdateModal from '@/components/update/Modal'

/** 请求/响应的头、体共用：无内部滚动条，由弹层整体滚动；长行换行。 */
const HTTP_TRACE_PRE =
  'whitespace-pre-wrap break-words rounded-lg border border-zinc-200/90 bg-zinc-100/90 p-3 font-mono text-[11px] leading-relaxed text-zinc-900 dark:border-white/[0.06] dark:bg-zinc-900/70 dark:text-zinc-200'

type Props = {
  open: boolean
  trace: McpToolCallHttpTrace | null
  onClose: () => void
}

export function ToolCallHttpDetailModal({ open, trace, onClose }: Props) {
  const { t } = useTranslation()
  const close = t('update.close')
  const req = trace?.request
  const res = trace?.response

  return (
    <UpdateModal
      open={open && trace != null}
      title={t('tools.httpDetailTitle')}
      titleId="mcp-tool-call-http-detail-title"
      resizable
      cancelText={close}
      okText={close}
      onCancel={onClose}
      onOk={onClose}
    >
      <div className="space-y-5 text-left">
        {req
          ? (
            <section>
              <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-600">
                {t('tools.httpRequestSection')}
              </h3>
              <p className="mb-2 font-mono text-xs text-zinc-800 dark:text-zinc-200">
                <span className="text-cyan-700 dark:text-cyan-400/90">{req.method}</span>
                {' '}
                <span className="break-all">{req.url}</span>
              </p>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-600">
                {t('tools.httpRequestHeaders')}
              </div>
              <pre className={`${HTTP_TRACE_PRE} mb-3`}>
                {req.headersText || '—'}
              </pre>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-600">
                {t('tools.httpRequestBody')}
              </div>
              <pre className={HTTP_TRACE_PRE}>
                {req.body || '—'}
              </pre>
            </section>
          )
          : null}

        <section className="border-t border-zinc-200/80 pt-4 dark:border-white/[0.06]">
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-600">
            {t('tools.httpResponseSection')}
          </h3>
          {res
            ? (
              <>
                <p className="mb-2 font-mono text-xs text-zinc-800 dark:text-zinc-200">
                  {t('tools.httpResponseStatus')}
                  {': '}
                  <span className="tabular-nums text-cyan-700 dark:text-cyan-400/90">
                    {res.status}
                    {res.statusText ? ` ${res.statusText}` : ''}
                  </span>
                </p>
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-600">
                  {t('tools.httpResponseHeaders')}
                </div>
                <pre className={`${HTTP_TRACE_PRE} mb-3`}>
                  {res.headersText || '—'}
                </pre>
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-600">
                  {t('tools.httpResponseBody')}
                </div>
                <pre className={HTTP_TRACE_PRE}>
                  {res.body || '—'}
                </pre>
              </>
            )
            : (
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {t('tools.httpNoResponse')}
              </p>
            )}
        </section>
      </div>
    </UpdateModal>
  )
}
