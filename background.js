const DEFAULTS = {
  enabled: true,
  globalKeywords: [],
  sites: {},
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get('settings')
  if (!existing.settings) {
    await chrome.storage.local.set({ settings: DEFAULTS })
  }
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) {
    const isEnabled = changes.settings.newValue.enabled
    updateBadgeStatus(isEnabled)

    chrome.tabs.query({}, (tabs) => {
      for (const t of tabs) {
        if (t.id) {
          chrome.tabs
            .sendMessage(t.id, { type: 'settings-updated' })
            .catch(() => {})
        }
      }
    })
  }
})

const updateBadgeStatus = (enabled) => {
  if (!enabled) {
    chrome.action.setBadgeText({ text: 'OFF' })
    chrome.action.setBadgeBackgroundColor({ color: '#9e9e9e' })
  } else {
    chrome.action.setBadgeText({ text: '' })
    chrome.action.setBadgeBackgroundColor({ color: '#000000' })
  }
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'blocked-count' && sender.tab?.id) {
    const text = msg.count > 0 ? `${msg.count}` : ''
    chrome.action.setBadgeText({
      tabId: sender.tab.id,
      text: text,
    })
    chrome.action.setBadgeBackgroundColor({
      tabId: sender.tab.id,
      color: '#e10f1a',
    })
  }
})
