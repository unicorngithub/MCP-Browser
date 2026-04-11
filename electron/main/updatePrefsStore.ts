import ElectronStore from 'electron-store'

type UpdatePrefsSchema = {
  /** 上次静默检查更新时间（ISO 8601），空表示从未检查 */
  lastSilentUpdateCheckAt: string
}

interface UpdatePrefsPersist {
  get(key: 'lastSilentUpdateCheckAt'): string
  set(key: 'lastSilentUpdateCheckAt', value: string): void
}

const store = new ElectronStore<UpdatePrefsSchema>({
  name: 'mcp-browser-updater',
  defaults: { lastSilentUpdateCheckAt: '' },
}) as unknown as UpdatePrefsPersist

export function getLastSilentUpdateCheckAt(): string {
  return store.get('lastSilentUpdateCheckAt')
}

export function setLastSilentUpdateCheckAt(iso: string): void {
  store.set('lastSilentUpdateCheckAt', iso)
}
