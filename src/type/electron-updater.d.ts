interface VersionInfo {
  update: boolean
  version: string
  newVersion?: string
}

interface ErrorType {
  message: string
  error: Error
  /** 与 shared/types `UpdateErrorUiKey` 一致；有则优先显示对应 i18n 文案 */
  uiKey?: 'not_packaged' | 'network' | 'download_failed'
}
