import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import { SerialPort } from 'serialport';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs')
        }
    });

    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist-react/index.html'));
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Handle serial port listing
ipcMain.handle('list-serial-ports', async () => {
    try {
        const ports = await SerialPort.list();
        console.log('Available ports:', ports);
        return ports;
    } catch (error) {
        console.error('Error listing serial ports:', error);
        return [];
    }
}); 