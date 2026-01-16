import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("dropcrate", {
  settings: {
    get: () => ipcRenderer.invoke("dropcrate:settings:get"),
    set: (next) => ipcRenderer.invoke("dropcrate:settings:set", next)
  },
  queue: {
    start: (payload) => ipcRenderer.invoke("dropcrate:queue:start", payload),
    cancel: () => ipcRenderer.invoke("dropcrate:queue:cancel")
  },
  library: {
    list: (payload) => ipcRenderer.invoke("dropcrate:library:list", payload)
  },
  shell: {
    open: (targetPath) => ipcRenderer.invoke("dropcrate:shell:open", targetPath),
    reveal: (targetPath) => ipcRenderer.invoke("dropcrate:shell:reveal", targetPath)
  },
  onEvent: (handler) => {
    const listener = (_evt, payload) => handler(payload);
    ipcRenderer.on("dropcrate:event", listener);
    return () => ipcRenderer.removeListener("dropcrate:event", listener);
  }
});
