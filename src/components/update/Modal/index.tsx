import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

type ModalProps = {
  open: boolean
  title?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  cancelText?: string
  okText?: string
  onCancel?: () => void
  onOk?: () => void
  /** 用于 aria-labelledby */
  titleId?: string
}

/**
 * 与 ServerDialog / McpServersImportExport 遮罩一致；z-[100] 高于主内容区 z-10，避免只盖住侧栏。
 */
export default function UpdateModal({
  open,
  title,
  children,
  footer,
  cancelText,
  okText,
  onCancel,
  onOk,
  titleId = 'mcp-update-dialog-title',
}: ModalProps) {
  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm dark:bg-black/60"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onCancel?.()
      }}
    >
      <div
        className="max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200/90 bg-white/95 shadow-lg backdrop-blur-xl dark:border-white/[0.08] dark:bg-zinc-900/95 dark:shadow-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-zinc-200/90 px-6 pb-4 pt-5 dark:border-white/[0.06]">
          {title
            ? (
              <h2
                id={titleId}
                className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white"
              >
                {title}
              </h2>
            )
            : null}
        </div>

        <div className="px-6 py-5 text-sm text-zinc-700 dark:text-zinc-300">{children}</div>

        {footer === undefined
          ? (
            <div className="flex justify-end gap-2 border-t border-zinc-200/90 px-6 py-4 dark:border-white/[0.06]">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-zinc-200"
              >
                {cancelText ?? ''}
              </button>
              <button
                type="button"
                onClick={onOk}
                className="rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-lg shadow-cyan-500/15 transition hover:brightness-110"
              >
                {okText ?? ''}
              </button>
            </div>
          )
          : (
            footer
          )}
      </div>
    </div>,
    document.body,
  )
}
