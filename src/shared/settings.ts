export interface Settings {
  staleDays: number
  closeAfterStash: boolean
  closePinned: boolean
  stripAllParams: boolean
  stripTrackingParams: boolean
}

export const defaultSettings: Settings = {
  staleDays: 30,
  closeAfterStash: true,
  closePinned: false,
  stripAllParams: false,
  stripTrackingParams: true
}

export async function getSettings(): Promise<Settings> {
  const obj = await chrome.storage.local.get(defaultSettings)
  return { ...defaultSettings, ...obj }
}

export async function setSettings(patch: Partial<Settings>): Promise<void> {
  await chrome.storage.local.set(patch)
}
