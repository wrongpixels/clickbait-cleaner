let settingsCache = null
let observer = null
let debounceTimer = null

const normalizeString = (str) => (str || '').trim().toLowerCase()

const getHostname = () => window.location.hostname

const isSiteEnabled = (settings) => {
  const host = getHostname()
  return settings.sites[host] && settings.sites[host].enabled
}

const getEffectiveKeywords = (settings) => {
  const host = getHostname()
  const siteConfig = settings.sites[host] || {
    localKeywords: [],
    disabledGlobals: [],
  }

  const activeGlobals = settings.globalKeywords.filter(
    (k) => !siteConfig.disabledGlobals.includes(k),
  )

  return [...new Set([...activeGlobals, ...siteConfig.localKeywords])]
}

const hideElement = (el) => {
  if (!el || el.style.display === 'none') {
    return 0
  }
  el.style.setProperty('display', 'none', 'important')
  return 1
}

const processArticles = () => {
  if (
    !settingsCache ||
    !settingsCache.enabled ||
    !isSiteEnabled(settingsCache)
  ) {
    chrome.runtime
      .sendMessage({ type: 'blocked-count', count: 0 })
      .catch(() => {})
    return
  }

  const keywords = getEffectiveKeywords(settingsCache).map(normalizeString)
  if (keywords.length === 0) {
    return
  }

  let blockedCount = 0
  const articles = document.querySelectorAll('article')

  articles.forEach((article) => {
    if (article.style.display === 'none') {
      blockedCount++
      return
    }

    const h2 = article.querySelector('h2')
    if (h2) {
      const text = normalizeString(h2.textContent)
      const match = keywords.some((k) => text.includes(k))
      if (match) {
        blockedCount += hideElement(article)
      }
    }
  })

  chrome.runtime
    .sendMessage({ type: 'blocked-count', count: blockedCount })
    .catch(() => {})
}

const startObserver = () => {
  if (observer) observer.disconnect()
  observer = new MutationObserver(() => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(processArticles, 500)
  })
  observer.observe(document.body, { subtree: true, childList: true })
}

const init = async () => {
  const data = await chrome.storage.local.get('settings')
  settingsCache = data.settings || {
    enabled: true,
    globalKeywords: [],
    sites: {},
  }

  processArticles()
  startObserver()

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'settings-updated') {
      chrome.storage.local.get('settings').then((data) => {
        settingsCache = data.settings
        if (!settingsCache.enabled || !isSiteEnabled(settingsCache)) {
          document
            .querySelectorAll('article[style*="display: none"]')
            .forEach((el) => {
              el.style.display = ''
            })
        }
        processArticles()
      })
    }
  })
}

init()
