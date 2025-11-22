const DEFAULTS = { enabled: true, globalKeywords: [], sites: {} }
let currentSettings = { ...DEFAULTS }

const init = async () => {
  const data = await chrome.storage.local.get('settings')
  currentSettings = { ...DEFAULTS, ...(data.settings || {}) }
  renderAll()
}

const save = async () => {
  await chrome.storage.local.set({ settings: currentSettings })
  const status = document.getElementById('save-status')
  status.style.opacity = '1'
  setTimeout(() => (status.style.opacity = '0'), 2000)

  chrome.tabs.query({}, (tabs) => {
    tabs.forEach((t) =>
      chrome.tabs
        .sendMessage(t.id, { type: 'settings-updated' })
        .catch(() => {}),
    )
  })
}

const renderAll = () => {
  renderGlobalList()
  renderSiteSelect()
  renderSiteDetails()
}

const renderGlobalList = () => {
  const container = document.getElementById('global-list')
  container.innerHTML = ''
  currentSettings.globalKeywords.forEach((kw, idx) => {
    const div = document.createElement('div')
    div.className = 'item'
    div.innerHTML = `<span>${kw}</span><span class="btn-del">&times;</span>`
    div.querySelector('.btn-del').onclick = () => {
      currentSettings.globalKeywords.splice(idx, 1)

      Object.values(currentSettings.sites).forEach((site) => {
        if (site.disabledGlobals)
          site.disabledGlobals = site.disabledGlobals.filter((k) => k !== kw)
      })
      save()
      renderAll()
    }
    container.appendChild(div)
  })
}

const renderSiteSelect = () => {
  const select = document.getElementById('site-select')
  const currentVal = select.value

  const siteKeys = Object.keys(currentSettings.sites).sort()

  const previouslySelected = select.value
  select.innerHTML = '<option value="">Select a site to configure...</option>'

  siteKeys.forEach((host) => {
    const opt = document.createElement('option')
    opt.value = host
    opt.textContent = host
    select.appendChild(opt)
  })

  if (previouslySelected && currentSettings.sites[previouslySelected]) {
    select.value = previouslySelected
  }
}

const renderSiteDetails = () => {
  const select = document.getElementById('site-select')
  const host = select.value
  const details = document.getElementById('site-details')
  const msg = document.getElementById('no-site-msg')

  if (!host || !currentSettings.sites[host]) {
    details.style.display = 'none'
    msg.style.display = 'block'
    return
  }

  details.style.display = 'block'
  msg.style.display = 'none'

  const config = currentSettings.sites[host]

  const localContainer = document.getElementById('local-list')
  localContainer.innerHTML = ''
  config.localKeywords.forEach((kw, idx) => {
    const div = document.createElement('div')
    div.className = 'item'
    div.innerHTML = `<span>${kw}</span><span class="btn-del">&times;</span>`
    div.querySelector('.btn-del').onclick = () => {
      config.localKeywords.splice(idx, 1)
      save()
      renderSiteDetails()
    }
    localContainer.appendChild(div)
  })

  const exContainer = document.getElementById('exceptions-list')
  exContainer.innerHTML = ''
  if (config.disabledGlobals.length === 0) {
    exContainer.innerHTML =
      '<div style="color:#ccc; font-size:12px; padding:5px;">No global keywords disabled for this site.</div>'
  }
  config.disabledGlobals.forEach((kw) => {
    const div = document.createElement('div')
    div.className = 'item'
    div.innerHTML = `
        <span style="text-decoration: line-through; color: #999;">${kw}</span>
        <span class="btn-del" title="Re-enable">Enable</span>
    `
    div.querySelector('.btn-del').onclick = () => {
      config.disabledGlobals = config.disabledGlobals.filter((k) => k !== kw)
      save()
      renderSiteDetails()
    }
    exContainer.appendChild(div)
  })
}

document.addEventListener('DOMContentLoaded', () => {
  init()

  document.getElementById('site-select').onchange = renderSiteDetails

  document.getElementById('global-add').onclick = () => {
    const input = document.getElementById('global-input')
    const val = input.value.trim()
    if (val && !currentSettings.globalKeywords.includes(val)) {
      currentSettings.globalKeywords.push(val)
      input.value = ''
      save()
      renderAll()
    }
  }

  document.getElementById('local-add').onclick = () => {
    const select = document.getElementById('site-select')
    const host = select.value
    if (!host) return

    const input = document.getElementById('local-input')
    const val = input.value.trim()
    if (val && !currentSettings.sites[host].localKeywords.includes(val)) {
      currentSettings.sites[host].localKeywords.push(val)
      input.value = ''
      save()
      renderSiteDetails()
    }
  }
})
