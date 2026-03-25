const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const userDataPath = app.getPath('userData');
const todosPath = path.join(userDataPath, 'todos.json');
const memosPath = path.join(userDataPath, 'memos.json');
const voiceDir  = path.join(userDataPath, 'voice');

if (!fs.existsSync(voiceDir)) fs.mkdirSync(voiceDir, { recursive: true });

function createWindow() {
  const win = new BrowserWindow({
    width: 900,
    height: 600,
    minWidth: 780,
    minHeight: 520,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#f0f3ee',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── Todos ────────────────────────────────────────────────────────────────────
ipcMain.handle('todos:load', () => {
  try { return JSON.parse(fs.readFileSync(todosPath, 'utf-8')); } catch { return []; }
});
ipcMain.handle('todos:save', (_, todos) => {
  fs.writeFileSync(todosPath, JSON.stringify(todos, null, 2)); return true;
});

// ── Voice memos ───────────────────────────────────────────────────────────────
ipcMain.handle('memos:load', () => {
  try { return JSON.parse(fs.readFileSync(memosPath, 'utf-8')); } catch { return []; }
});
ipcMain.handle('memos:save-meta', (_, memos) => {
  fs.writeFileSync(memosPath, JSON.stringify(memos, null, 2)); return true;
});
ipcMain.handle('memos:save-audio', (_, { id, buffer }) => {
  fs.writeFileSync(path.join(voiceDir, `${id}.webm`), Buffer.from(buffer));
  return true;
});
ipcMain.handle('memos:load-audio', (_, id) => {
  const p = path.join(voiceDir, `${id}.webm`);
  if (!fs.existsSync(p)) return null;
  return Array.from(fs.readFileSync(p));
});
ipcMain.handle('memos:delete', (_, id) => {
  try {
    const p = path.join(voiceDir, `${id}.webm`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
  return true;
});
