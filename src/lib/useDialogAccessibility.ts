import { useLayoutEffect, useRef, type RefObject } from 'react'

/** 与 UpdateModal / ServerDialog 正文容器一致：全选/拖选仅针对此区域，不含标题与底部按钮文案 */
export const DIALOG_SELECT_SURFACE_ATTR = 'data-dialog-select-surface'

const TABBABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function listTabbable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter((el) => {
    if (el.closest('[inert]')) return false
    const t = el.getAttribute('tabindex')
    if (t === '-1') return false
    return true
  })
}

/**
 * 打开时焦点移入对话框、Tab 在容器内循环、Esc 触发关闭；关闭时恢复之前焦点。
 * onEscape 请用稳定引用或由内联传入（hook 内用 ref 保存最新回调）。
 */
export function useDialogAccessibility(
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
  onEscape: () => void,
): void {
  const onEscapeRef = useRef(onEscape)
  onEscapeRef.current = onEscape
  const prevFocusRef = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (!open) return

    const root = rootRef.current
    const ae = document.activeElement
    prevFocusRef.current = ae instanceof HTMLElement ? ae : null

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onEscapeRef.current()
        return
      }

      /**
       * 弹层挂在 body、与 #root 并列；若仅当焦点在对话框内才拦截，焦点在 body/遮罩时 Ctrl+A 会默认全选整页（含主窗口）。
       * 弹层打开时：除输入类控件外一律拦截，并把选区限制在正文表面（含 data-dialog-select-surface 时）。
       */
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && root) {
        const active = document.activeElement as HTMLElement | null
        if (
          active &&
          (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)
        ) {
          return
        }
        const surface =
          root.querySelector<HTMLElement>(`[${DIALOG_SELECT_SURFACE_ATTR}]`) ?? root
        e.preventDefault()
        e.stopPropagation()
        const sel = window.getSelection()
        if (sel && surface.isConnected) {
          const range = document.createRange()
          range.selectNodeContents(surface)
          sel.removeAllRanges()
          sel.addRange(range)
        }
        return
      }

      if (e.key !== 'Tab' || !root) return

      const list = listTabbable(root)
      if (list.length === 0) return

      const active = document.activeElement
      if (!root.contains(active)) {
        e.preventDefault()
        list[0].focus()
        return
      }

      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (active === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown, true)

    const id = requestAnimationFrame(() => {
      const r = rootRef.current
      if (!r) return
      const list = listTabbable(r)
      if (list.length > 0) list[0].focus()
      else {
        if (!r.hasAttribute('tabindex')) r.setAttribute('tabindex', '-1')
        r.focus()
      }
    })

    return () => {
      cancelAnimationFrame(id)
      document.removeEventListener('keydown', onKeyDown, true)
      const p = prevFocusRef.current
      if (p?.isConnected && typeof p.focus === 'function') p.focus()
    }
  }, [open, rootRef])
}
