interface VersionInfo {
  update: boolean
  version: string
  newVersion?: string
  /** 主进程静默检查；无新版本时不弹窗 */
  silentCheck?: boolean
}

interface ErrorType {
  message: string
  error: Error
  /** 与 shared/types `UpdateErrorUiKey` 一致；有则优先显示对应 i18n 文案 */
  uiKey?: 'not_packaged' | 'network' | 'download_failed'
}
