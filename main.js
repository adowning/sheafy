const http = require('http')
const { app, shell, BrowserWindow, Menu } = require('electron')
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
          label: 'Open Location...',
          accelerator: 'CmdOrCtrl+L',
          click: () => send('openLocation')
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
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        // { role: 'pasteandmatchstyle' },
        { role: 'delete' },
        { role: 'selectall' },
        { type: 'separator' },
        {
          label: 'Search...',
          accelerator: 'CmdOrCtrl+F',
          click: () => send('search')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
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
          label: 'Developer',
          submenu: [
            { role: 'reload', accelerator: 'CmdOrCtrl+Alt+R' },
            { role: 'forcereload', accelerator: 'CmdOrCtrl+Shift+Alt+R' },
            { role: 'toggledevtools' }
          ]
        },
        { type: 'separator' },
        // { role: 'resetzoom' },
        // { role: 'zoomin' },
        // { role: 'zoomout' },
        // { type: 'separator' },
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
    defaultWidth: 820,
    defaultHeight: 600
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

  const path = '#/explorer'

  mainWindow = new BrowserWindow(options)

  if (dev) {
    // Disable security warnings
    process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = true

    // Install vue dev tool and open chrome dev tools
    const {
      default: installExtension,
      VUEJS_DEVTOOLS
    } = require('electron-devtools-installer')

    const name = await installExtension(VUEJS_DEVTOOLS.id)
    console.log(`Added Extension: ${name}`) // eslint-disable-line no-console

    // Wait for nuxt to build
    const url = `http://localhost:${port}/${path}`
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
    mainWindow.loadURL(`file://${__dirname}/app/index.html${path}`)
  }

  windowState.manage(mainWindow)

  const template = createTemplate()
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)

  mainWindow.on('closed', () => (mainWindow = null))
  mainWindow.on('enter-full-screen', () => send('enterFullScreen'))
  mainWindow.on('leave-full-screen', () => send('leaveFullScreen'))
}

app.on('ready', createWindow)
app.on('activate', () => mainWindow === null && createWindow())
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())
