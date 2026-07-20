var { app, BrowserWindow, shell, dialog } = require('electron');
var { spawn } = require('child_process');
var path = require('path');
var fs = require('fs');
var http = require('http');

var mainWindow = null;
var serverProcess = null;
var SERVER_PORT = 3000;
var SERVER_URL = 'http://localhost:' + SERVER_PORT;

function getServerPath() {
  var paths = [
    path.join(__dirname, 'server.js'),
    path.join(__dirname, '.next-standalone', 'server.js'),
    path.join(__dirname, '.next', 'standalone', 'server.js'),
  ];
  for (var i = 0; i < paths.length; i++) {
    if (fs.existsSync(paths[i])) return paths[i];
  }
  return paths[0];
}

function getPythonPath() {
  var paths = [path.join(__dirname, 'python', 'python.exe')];
  for (var i = 0; i < paths.length; i++) { if (fs.existsSync(paths[i])) return paths[i]; }
  return paths[0];
}

function waitForServer(url, max, interval) {
  max = max || 30; interval = interval || 1000;
  return new Promise(function(resolve, reject) {
    var retries = 0;
    function check() { http.get(url, function(res) { if (res.statusCode === 200 || res.statusCode === 500) resolve(); else retry(); }).on('error', function() { retry(); }); }
    function retry() { retries++; if (retries >= max) reject(new Error('Server timeout')); else setTimeout(check, interval); }
    check();
  });
}

function startServer() {
  return new Promise(function(resolve, reject) {
    var serverPath = getServerPath();
    var serverDir = __dirname;
    if (!fs.existsSync(serverPath)) { reject(new Error('Server not found: ' + serverPath)); return; }
    var env = Object.assign({}, process.env, { NODE_ENV: 'production', PORT: String(SERVER_PORT), PROJECT_ROOT: __dirname });
    var pythonPath = getPythonPath();
    if (fs.existsSync(pythonPath)) env.PYTHON_PATH = pythonPath;
    var userDataPath = app.getPath('userData');
    var dbDir = path.join(userDataPath, 'db');
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    var dbPath = path.join(dbDir, 'custom.db');
    env.DATABASE_URL = 'file:' + dbPath;
    if (!fs.existsSync(dbPath)) { var seeds = [path.join(__dirname, 'db', 'custom.db'), path.join(serverDir, 'db', 'custom.db')]; for (var i = 0; i < seeds.length; i++) { if (fs.existsSync(seeds[i])) { fs.copyFileSync(seeds[i], dbPath); break; } } }
    serverProcess = spawn(process.execPath, [serverPath], { env: env, stdio: ['ignore', 'pipe', 'pipe'], cwd: serverDir });
    serverProcess.stdout.on('data', function(d) { console.log('[server]', d.toString().trim()); });
    serverProcess.stderr.on('data', function(d) { console.error('[server]', d.toString().trim()); });
    serverProcess.on('error', function(err) { reject(err); });
    waitForServer(SERVER_URL).then(function() { resolve(); }).catch(reject);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({ width: 1400, height: 900, minWidth: 1024, minHeight: 700, title: 'Site Secretary', webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }, autoHideMenuBar: true, center: true, show: false });
  mainWindow.loadURL(SERVER_URL);
  mainWindow.once('ready-to-show', function() { mainWindow.show(); mainWindow.focus(); });
  mainWindow.webContents.setWindowOpenHandler(function(info) { if (info.url.indexOf('http://localhost') === 0) return { action: 'allow' }; shell.openExternal(info.url); return { action: 'deny' }; });
  mainWindow.on('closed', function() { mainWindow = null; });
}

app.whenReady().then(function() { startServer().then(function() { createWindow(); }).catch(function(err) { dialog.showErrorBox('Error', 'Failed:\n' + err.message); app.quit(); }); });
app.on('window-all-closed', function() { if (serverProcess) { serverProcess.kill(); serverProcess = null; } app.quit(); });
app.on('before-quit', function() { if (serverProcess) { serverProcess.kill(); serverProcess = null; } });
var lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else app.on('second-instance', function() { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); } });
