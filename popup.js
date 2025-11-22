const DEFAULTS = { enabled: true, globalKeywords: [], sites: {} }

const getSettings = async () => {
  const obj = await chrome.storage.local.get('settings')
  return { ...DEFAULTS, ...(obj.settings || {}) }
}

const saveSettings = async (settings) => {
  await chrome.storage.local.set({ settings })
}

const getCurrentTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

const getHostname = (url) => {
  try {
    return new URL(url).hostname
  } catch (e) {
    return null
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  let settings = await getSettings()
  const tab = await getCurrentTab()
  const hostname = tab && tab.url ? getHostname(tab.url) : null

  const globalEnableEl = document.getElementById('global-enable')
  const statusText = document.getElementById('status-text')
  const siteEnableEl = document.getElementById('site-enable')
  const hostnameEl = document.getElementById('current-hostname')
  const controlsWrapper = document.getElementById('site-controls-wrapper')
  const inputEl = document.getElementById('new-keyword')
  const addGlobalBtn = document.getElementById('add-global')
  const addLocalBtn = document.getElementById('add-local')
  const localListEl = document.getElementById('local-list')
  const globalListEl = document.getElementById('global-list')
  const optionsBtn = document.getElementById('open-options')

  const updateUI = () => {
    globalEnableEl.checked = settings.enabled
    statusText.textContent = settings.enabled ? 'Active' : 'Paused'
    statusText.style.color = settings.enabled ? '#e10f1a' : '#999'

    if (hostname) {
      hostnameEl.textContent = `Enabled for ${hostname}`
      const siteConfig = settings.sites[hostname]
      const isSiteActive = siteConfig && siteConfig.enabled
      siteEnableEl.checked = !!isSiteActive

      if (settings.enabled && isSiteActive) {
        controlsWrapper.style.display = 'block'
        renderLists()
      } else {
        controlsWrapper.style.display = 'none'
      }
    } else {
      hostnameEl.textContent = 'Clickbait Cleaner cannot be used in this page'
      siteEnableEl.disabled = true
      controlsWrapper.style.display = 'none'
    }
  }

  const renderLists = () => {
    localListEl.innerHTML = ''
    globalListEl.innerHTML = ''

    if (!hostname) return

    const siteConfig = settings.sites[hostname] || {
      localKeywords: [],
      disabledGlobals: [],
    }

    siteConfig.localKeywords.forEach((kw, idx) => {
      const div = document.createElement('div')
      div.className = 'keyword-item'
      div.innerHTML = `
        <span class="keyword-left">${kw}</span>
        <span class="delete-btn">&times;</span>
      `
      div.querySelector('.delete-btn').onclick = async () => {
        siteConfig.localKeywords.splice(idx, 1)
        settings.sites[hostname] = siteConfig
        await saveSettings(settings)
        renderLists()
      }
      localListEl.appendChild(div)
    })

    if (siteConfig.localKeywords.length === 0) {
      localListEl.innerHTML =
        '<div style="font-size:11px; color:#ccc; padding:4px 0;">No keywords added yet</div>'
    }

    settings.globalKeywords.forEach((kw, idx) => {
      const isEnabledHere = !siteConfig.disabledGlobals.includes(kw)
      const div = document.createElement('div')
      div.className = 'keyword-item'

      const left = document.createElement('div')
      left.className = 'keyword-left'

      const toggleLabel = document.createElement('label')
      toggleLabel.className = 'mini-toggle'
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.checked = isEnabledHere

      checkbox.onchange = async (e) => {
        if (!settings.sites[hostname]) {
          settings.sites[hostname] = {
            enabled: true,
            localKeywords: [],
            disabledGlobals: [],
          }
        }
        const currentSiteConfig = settings.sites[hostname]

        if (e.target.checked) {
          currentSiteConfig.disabledGlobals =
            currentSiteConfig.disabledGlobals.filter((k) => k !== kw)
        } else {
          if (!currentSiteConfig.disabledGlobals.includes(kw)) {
            currentSiteConfig.disabledGlobals.push(kw)
          }
        }
        await saveSettings(settings)
      }

      const slider = document.createElement('span')
      slider.className = 'mini-slider'

      toggleLabel.appendChild(checkbox)
      toggleLabel.appendChild(slider)

      const text = document.createElement('span')
      text.textContent = kw
      text.style.opacity = isEnabledHere ? '1' : '0.5'

      left.appendChild(toggleLabel)
      left.appendChild(text)

      const delBtn = document.createElement('span')
      delBtn.className = 'delete-btn'
      delBtn.innerHTML = '&times;'
      delBtn.onclick = async () => {
        settings.globalKeywords.splice(idx, 1)

        Object.keys(settings.sites).forEach((h) => {
          const s = settings.sites[h]
          if (s.disabledGlobals)
            s.disabledGlobals = s.disabledGlobals.filter((k) => k !== kw)
        })
        await saveSettings(settings)
        renderLists()
      }

      div.appendChild(left)
      div.appendChild(delBtn)
      globalListEl.appendChild(div)
    })

    if (settings.globalKeywords.length === 0) {
      globalListEl.innerHTML =
        '<div style="font-size:11px; color:#ccc; padding:4px 0;">No keywords added yet</div>'
    }
  }

  globalEnableEl.addEventListener('change', async () => {
    settings.enabled = globalEnableEl.checked
    await saveSettings(settings)
    updateUI()
  })

  siteEnableEl.addEventListener('change', async () => {
    if (!hostname) return
    if (siteEnableEl.checked) {
      if (!settings.sites[hostname]) {
        settings.sites[hostname] = {
          enabled: true,
          localKeywords: [],
          disabledGlobals: [],
        }
      } else {
        settings.sites[hostname].enabled = true
      }
    } else {
      if (settings.sites[hostname]) {
        settings.sites[hostname].enabled = false
      }
    }
    await saveSettings(settings)
    updateUI()
  })

  const addKeyword = async (type) => {
    const val = inputEl.value.trim()
    if (!val) return

    if (type === 'global') {
      if (!settings.globalKeywords.includes(val)) {
        settings.globalKeywords.push(val)
      }
    } else {
      if (hostname) {
        if (!settings.sites[hostname]) {
          settings.sites[hostname] = {
            enabled: true,
            localKeywords: [],
            disabledGlobals: [],
          }
        }

        const conf = settings.sites[hostname]
        if (!conf.localKeywords.includes(val)) {
          conf.localKeywords.push(val)
        }
      }
    }

    inputEl.value = ''
    await saveSettings(settings)
    renderLists()
  }

  addGlobalBtn.onclick = () => addKeyword('global')
  addLocalBtn.onclick = () => addKeyword('local')
  inputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addKeyword('global')
  })

  if (optionsBtn) {
    optionsBtn.onclick = () => {
      if (chrome.runtime.openOptionsPage) {
        chrome.runtime.openOptionsPage()
      } else {
        window.open(chrome.runtime.getURL('options.html'))
      }
    }
  }

  updateUI()
})
