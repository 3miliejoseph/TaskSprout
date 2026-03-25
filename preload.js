const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  todos: {
    load: ()       => ipcRenderer.invoke('todos:load'),
    save: (todos)  => ipcRenderer.invoke('todos:save', todos),
  },
  memos: {
    load:       ()           => ipcRenderer.invoke('memos:load'),
    saveMeta:   (memos)      => ipcRenderer.invoke('memos:save-meta', memos),
    saveAudio:  (id, buffer) => ipcRenderer.invoke('memos:save-audio', { id, buffer }),
    loadAudio:  (id)         => ipcRenderer.invoke('memos:load-audio', id),
    delete:     (id)         => ipcRenderer.invoke('memos:delete', id),
  },
});
