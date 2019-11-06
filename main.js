const http = require('http')
const path = require('path')
const nanoid = require('nanoid')
const increment = require('add-filename-increment')
const { app, ipcMain, shell, BrowserWindow, Menu } = require('electron')
const windowStateKeeper = require('electron-window-state')

const dev = process.env.NODE_ENV === 'development'
const port = process.env.PORT || 3000

let mainWindow = null

const send = (...args) => {
  mainWindow && mainWindow.webContents.send(...args)
}

const createTemplate = () => {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Tab',
          accelerator: 'CmdOrCtrl+T',
          click: () => send('newTab')
        },
        {
          label: 'Duplicate Tab',
          accelerator: 'CmdOrCtrl+D',
          click: () => send('duplicateTab')
        },
        {
          label: 'Open Location...',
          accelerator: 'CmdOrCtrl+L',
          click: () => send('openLocation')
        },
        {
          label: 'Go to Tab...',
          accelerator: 'CmdOrCtrl+P',
          click: () => send('goToTab')
        },
        { type: 'separator' },
        {
          label: 'Close Tab',
          accelerator: 'CmdOrCtrl+W',
          click: () => send('closeTab')
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        // TODO: https://github.com/electron/electron/issues/15728
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => send('undo')
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => send('redo')
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        // { role: 'pasteandmatchstyle' },
        { role: 'delete' },
        { role: 'selectall' },
        { type: 'separator' },
        {
          label: 'Find...',
          accelerator: 'CmdOrCtrl+F',
          click: () => send('find')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Apps',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => send('showApps')
        },
        {
          label: 'Downloads',
          accelerator: 'CmdOrCtrl+Shift+D',
          click: () => send('showDownloads')
        },
        { type: 'separator' },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => send('reload')
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => send('forceReload')
        },
        { type: 'separator' },
        {
          label: 'Actual Size',
          accelerator: 'CmdOrCtrl+0',
          click: () => send('resetZoom')
        },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => send('zoomIn')
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => send('zoomOut')
        },
        { type: 'separator' },
        {
          label: 'Developer',
          submenu: [
            { role: 'reload', accelerator: 'CmdOrCtrl+Alt+R' },
            { role: 'forcereload', accelerator: 'CmdOrCtrl+Shift+Alt+R' },
            { role: 'toggledevtools' }
          ]
        },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Navigation',
      submenu: [
        {
          label: 'Back',
          accelerator: 'CmdOrCtrl+Left',
          click: () => send('goBack')
        },
        {
          label: 'Forward',
          accelerator: 'CmdOrCtrl+Right',
          click: () => send('goForward')
        },
        { type: 'separator' },
        {
          label: 'Back Tab',
          accelerator: 'Alt+Left',
          click: () => send('goBackTab')
        },
        {
          label: 'Forward Tab',
          accelerator: 'Alt+Right',
          click: () => send('goForwardTab')
        }
      ]
    },
    {
      role: 'window',
      submenu: [{ role: 'close' }, { role: 'minimize' }]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: () => shell.openExternal('https://github.com/fiahfy/sheafy')
        }
      ]
    }
  ]

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: () => send('showSettings')
        },
        { type: 'separator' },
        { role: 'services', submenu: [] },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideothers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    })

    template.forEach((menu) => {
      if (menu.label === 'Edit') {
        menu.submenu.push(
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [{ role: 'startspeaking' }, { role: 'stopspeaking' }]
          }
        )
      } else if (menu.role === 'window') {
        menu.submenu.push(
          { role: 'zoom' },
          { type: 'separator' },
          { role: 'front' }
        )
      }
    })
  }

  return template
}

const createWindow = async () => {
  const windowState = windowStateKeeper({
    defaultWidth: 1024,
    defaultHeight: 768
  })

  const options = {
    ...windowState,
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: true,
      webviewTag: true
    }
  }

  if (dev) {
    options.webPreferences = {
      ...options.webPreferences,
      webSecurity: false
    }
  }

  mainWindow = new BrowserWindow(options)

  if (dev) {
    // Disable security warnings
    process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = true

    // Install vue dev tool and open chrome dev tools
    const {
      default: installExtension,
      VUEJS_DEVTOOLS
    } = require('electron-devtools-installer')

    const name = await installExtension(VUEJS_DEVTOOLS.id)
    console.log(`Added Extension: ${name}`) // eslint-disable-line no-console

    // Wait for nuxt to build
    const url = `http://localhost:${port}`
    const pollServer = () => {
      http
        .get(url, (res) => {
          if (res.statusCode === 200) {
            mainWindow.loadURL(url)
            mainWindow.webContents.openDevTools()
          } else {
            setTimeout(pollServer, 300)
          }
        })
        .on('error', pollServer)
    }
    pollServer()
  } else {
    mainWindow.loadURL(`file://${__dirname}/app/index.html`)
  }

  windowState.manage(mainWindow)

  const template = createTemplate()
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  mainWindow.on('closed', () => (mainWindow = null))
  mainWindow.on('enter-full-screen', () => send('enterFullScreen'))
  mainWindow.on('leave-full-screen', () => send('leaveFullScreen'))
  mainWindow.on('swipe', (_e, direction) => send('swipe', direction))

  let downloadItems = {}
  ipcMain.on('pauseDownload', (_e, id) => {
    const item = downloadItems[id]
    if (item) {
      item.pause()
    }
  })
  ipcMain.on('resumeDownload', (_e, id) => {
    const item = downloadItems[id]
    if (item) {
      item.resume()
    }
  })
  ipcMain.on('cancelDownload', (_e, id) => {
    const item = downloadItems[id]
    if (item) {
      item.cancel()
    } else {
      const download = {
        id,
        status: 'failed'
      }
      send('upsertDownload', download)
    }
  })
  mainWindow.webContents.session.on('will-download', (_e, item) => {
    const id = nanoid()
    downloadItems = {
      ...downloadItems,
      [id]: item
    }

    const filepath = increment(
      path.join(app.getPath('downloads'), item.getFilename()),
      { fs: true, platform: 'win32' }
    )
    const filename = path.basename(filepath)
    const download = {
      id,
      filepath,
      filename,
      url: item.getURL(),
      receivedBytes: 0,
      totalBytes: item.getTotalBytes(),
      startTime: Math.floor(item.getStartTime() * 1000)
    }
    send('upsertDownload', download)
    send('showDownloads')

    item.setSavePath(filepath)
    item.on('updated', (_e, state) => {
      let status
      if (state === 'interrupted') {
        status = 'interrupted'
      } else {
        status = item.isPaused() ? 'paused' : 'progressing'
      }
      const download = {
        id,
        status,
        receivedBytes: item.getReceivedBytes()
      }
      send('upsertDownload', download)
    })
    item.once('done', (_e, state) => {
      let status
      if (state === 'interrupted') {
        status = 'failed'
      } else {
        status = state
      }
      const download = {
        id,
        status,
        receivedBytes: item.getReceivedBytes()
      }
      send('upsertDownload', download)
      delete downloadItems[id]
    })
  })
}

app.on('ready', createWindow)
app.on('activate', () => mainWindow === null && createWindow())
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())
// @see https://stackoverflow.com/questions/48298364/choose-which-popups-should-be-allowed-from-webview-in-electron-app
app.on('web-contents-created', (_e, contents) => {
  if (contents.getType() === 'webview') {
    contents.on('new-window', (e, _url, _windowName, disposition) => {
      disposition !== 'new-window' && e.preventDefault()
    })
  }
})
