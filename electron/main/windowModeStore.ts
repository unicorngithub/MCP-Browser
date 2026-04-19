import ElectronStore from 'electron-store'
import type { WindowModePreference } from '../../shared/windowMode'

type Schema = { windowMode: WindowModePreference }

interface WindowModePersist {
  get(key: 'windowMode'): WindowModePreference | undefined
  set(key: 'windowMode', value: WindowModePreference): void
}

const store = new ElectronStore<Schema>({
  name: 'mcp-browser-window-mode',
  defaults: { windowMode: 'single' },
}) as unknown as WindowModePersist

export function getWindowModePreference(): WindowModePreference {
  const v = store.get('windowMode')
  return v === 'multi' ? 'multi' : 'single'
}

export function setWindowModePreference(mode: WindowModePreference): void {
  store.set('windowMode', mode)
}
