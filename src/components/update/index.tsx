import type { ProgressInfo } from 'electron-updater'
import type { TFunction } from 'i18next'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/components/update/Modal'
import Progress from '@/components/update/Progress'

function updateErrorLines(err: ErrorType, t: TFunction): { primary: string; technical?: string } {
  const key = err.uiKey
  if (key === 'not_packaged') return { primary: t('update.errorNotPackaged') }
  if (key === 'network') return { primary: t('update.errorNetwork') }
  if (key === 'download_failed') {
    const technical = (err.message || err.error?.message || '').trim()
    return {
      primary: t('update.errorDownloadFailed'),
      technical: technical.length > 0 ? technical : undefined,
    }
  }
  const fallback = (err.message || err.error?.message || '').trim()
  return { primary: fallback.length > 0 ? fallback : t('update.errorUnknown') }
}

const Update = () => {
  const { t } = useTranslation()
  const checkCancelledRef = useRef(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [checkPending, setCheckPending] = useState(false)
  const [versionInfo, setVersionInfo] = useState<VersionInfo>()
  const [updateError, setUpdateError] = useState<ErrorType>()
  const [progressInfo, setProgressInfo] = useState<Partial<ProgressInfo>>()
  const [modalOpen, setModalOpen] = useState<boolean>(false)
  const [modalBtn, setModalBtn] = useState<{
    cancelText?: string
    okText?: string
    onCancel?: () => void
    onOk?: () => void
  }>({
    onCancel: () => setModalOpen(false),
    onOk: () => void window.updaterIpc.invoke('start-download'),
  })

  const checkUpdate = useCallback(async () => {
    checkCancelledRef.current = false
    setCheckPending(true)
    setUpdateError(undefined)
    setVersionInfo(undefined)
    setUpdateAvailable(false)
    setProgressInfo({ percent: 0 })
    setModalOpen(true)
    setModalBtn({
      cancelText: t('update.cancel'),
      okText: t('update.close'),
      onCancel: () => {
        checkCancelledRef.current = true
        void window.updaterIpc.invoke('cancel-check-update')
        setModalOpen(false)
        setCheckPending(false)
      },
      onOk: () => {
        checkCancelledRef.current = true
        void window.updaterIpc.invoke('cancel-check-update')
        setModalOpen(false)
        setCheckPending(false)
      },
    })
    const result = (await window.updaterIpc.invoke('check-update')) as
      | import('electron-updater').UpdateCheckResult
      | null
      | { error?: ErrorType; cancelled?: boolean }
    if (checkCancelledRef.current || (result && typeof result === 'object' && 'cancelled' in result && result.cancelled)) {
      return
    }
    if (result && typeof result === 'object' && 'error' in result) {
      const raw = result as { message?: string; error: unknown; uiKey?: ErrorType['uiKey'] }
      if (raw.error instanceof Error) {
        setCheckPending(false)
        setUpdateAvailable(false)
        setUpdateError({
          message: typeof raw.message === 'string' ? raw.message : raw.error.message,
          error: raw.error,
          uiKey: raw.uiKey,
        })
        setModalBtn({
          cancelText: t('update.close'),
          okText: t('update.close'),
          onCancel: () => setModalOpen(false),
          onOk: () => setModalOpen(false),
        })
      }
    }
  }, [t])

  useEffect(() => {
    const api = window.appShellMenu
    if (!api) return
    return api.onCheckForUpdatesRequest(() => {
      void checkUpdate()
    })
  }, [checkUpdate])

  const onUpdateCanAvailable = useCallback((_event: Electron.IpcRendererEvent, arg1: VersionInfo) => {
    if (arg1.silentCheck && !arg1.update) return
    if (!arg1.silentCheck && checkCancelledRef.current) return

    setCheckPending(false)
    setVersionInfo(arg1)
    setUpdateError(undefined)
    if (arg1.update) {
      setModalBtn(state => ({
        ...state,
        cancelText: t('update.cancel'),
        okText: t('update.download'),
        onCancel: () => setModalOpen(false),
        onOk: () => void window.updaterIpc.invoke('start-download'),
      }))
      setUpdateAvailable(true)
      if (arg1.silentCheck) setModalOpen(true)
    } else {
      setUpdateAvailable(false)
      setModalBtn(state => ({
        ...state,
        cancelText: t('update.close'),
        okText: t('update.close'),
        onCancel: () => setModalOpen(false),
        onOk: () => setModalOpen(false),
      }))
    }
  }, [t])

  const onUpdateError = useCallback((_event: Electron.IpcRendererEvent, arg1: ErrorType) => {
    setCheckPending(false)
    setUpdateAvailable(false)
    setUpdateError(arg1)
    setModalBtn(state => ({
      ...state,
      cancelText: t('update.close'),
      okText: t('update.close'),
      onCancel: () => setModalOpen(false),
      onOk: () => setModalOpen(false),
    }))
  }, [t])

  const onDownloadProgress = useCallback((_event: Electron.IpcRendererEvent, arg1: ProgressInfo) => {
    setProgressInfo(arg1)
  }, [])

  const onUpdateDownloaded = useCallback((_event: Electron.IpcRendererEvent, ..._args: unknown[]) => {
    setProgressInfo({ percent: 100 })
    setModalBtn(state => ({
      ...state,
      cancelText: t('update.later'),
      okText: t('update.installNow'),
      onCancel: () => setModalOpen(false),
      onOk: () => void window.updaterIpc.invoke('quit-and-install'),
    }))
  }, [t])

  useEffect(() => {
    const unsubs = [
      window.updaterIpc.on('update-can-available', onUpdateCanAvailable as (e: unknown, ...a: unknown[]) => void),
      window.updaterIpc.on('update-error', onUpdateError as (e: unknown, ...a: unknown[]) => void),
      window.updaterIpc.on('download-progress', onDownloadProgress as (e: unknown, ...a: unknown[]) => void),
      window.updaterIpc.on('update-downloaded', onUpdateDownloaded as (e: unknown, ...a: unknown[]) => void),
    ]
    return () => unsubs.forEach((u) => u())
  }, [onUpdateCanAvailable, onUpdateError, onDownloadProgress, onUpdateDownloaded])

  const vu = t('update.versionUnknown')
  const errorPresentation = updateError ? updateErrorLines(updateError, t) : null

  return (
    <Modal
      open={modalOpen}
      title={t('update.dialogTitle')}
      cancelText={modalBtn?.cancelText ?? t('update.cancel')}
      okText={modalBtn?.okText ?? t('update.close')}
      onCancel={modalBtn?.onCancel}
      onOk={modalBtn?.onOk}
    >
      {checkPending
        ? (
          <p className="text-zinc-600 dark:text-zinc-400">{t('update.checking')}</p>
        ) : updateError && errorPresentation
        ? (
          <div className="space-y-2">
            <p className="rounded-xl border border-red-300/80 bg-red-50 px-3 py-2 text-sm leading-relaxed text-red-800 dark:border-red-500/25 dark:bg-red-950/40 dark:text-red-300">
              {errorPresentation.primary}
            </p>
            {errorPresentation.technical
              ? (
                <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-500">
                  <span className="font-medium text-zinc-600 dark:text-zinc-400">
                    {t('update.errorTechnicalDetail')}
                  </span>
                  <span className="ml-1 font-mono break-all">{errorPresentation.technical}</span>
                </p>
              )
              : null}
          </div>
        ) : updateAvailable
        ? (
          <div className="space-y-4">
            <p className="text-zinc-800 dark:text-zinc-200">
              {t('update.newVersionLine', { version: versionInfo?.newVersion || vu })}
            </p>
            <p className="font-mono text-sm text-cyan-700 dark:text-cyan-400/90">
              {t('update.versionRange', {
                current: versionInfo?.version || vu,
                next: versionInfo?.newVersion || vu,
              })}
            </p>
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                {t('update.progressTitle')}
              </p>
              <Progress percent={progressInfo?.percent} />
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-center">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">{t('update.noUpdateTitle')}</p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {t('update.noUpdateDetail', { version: versionInfo?.version || vu })}
            </p>
          </div>
        )}
    </Modal>
  )
}

export default Update
