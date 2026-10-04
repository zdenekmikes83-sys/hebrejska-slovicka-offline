const { app, BrowserWindow, Menu } = require("electron");
const path = require("path");

function createWindow() {
  Menu.setApplicationMenu(null);
  const window = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 760,
    minHeight: 620,
    backgroundColor: "#edf4fc",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  window.loadFile(path.join(__dirname, "..", "www", "index.html"));
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
