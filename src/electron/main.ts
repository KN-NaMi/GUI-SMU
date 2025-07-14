import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import { isDev, platformConfig } from './util.js';
import { getPreloadPath } from './pathResolver.js';
import * as fs from 'fs';
import ExcelJS from 'exceljs/excel.js';
import { SerialPort } from 'serialport/dist/index.js';
import { spawn, ChildProcess } from 'child_process';

interface DataPoint {
    step: number;
    voltage: number;
    current: number;
}

let pythonProcess: ChildProcess | null = null;

// Function to start Python backend
const startPythonBackend = () => {
    if (isDev()) {
        console.log('Development mode');
        return;
    }

    // Production mode - uruchom embedded Python
    try {
        const backendInfo = platformConfig.getBackendPath();
        const backendDir = path.join(process.resourcesPath, 'backend', backendInfo.dir);
        const backendPath = path.join(backendDir, backendInfo.executable);
        
        console.log('Starting backend:', backendPath);
        
        if (!fs.existsSync(backendPath)) {
            console.error('Backend executable not found:', backendPath);
            return;
        }

        // Na Linuxie/macOS ustaw uprawnienia wykonywalne
        if (platformConfig.isLinux || platformConfig.isMacOS) {
            try {
                fs.chmodSync(backendPath, '755');
                console.log('Set executable permissions for:', backendPath);
            } catch (error) {
                console.warn('Could not set executable permissions:', error);
            }
        }

        pythonProcess = spawn(backendPath, [], {
            cwd: backendDir,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        pythonProcess.stdout?.on('data', (data) => {
            console.log('Backend stdout:', data.toString());
        });

        pythonProcess.stderr?.on('data', (data) => {
            console.error('Backend stderr:', data.toString());
        });

        pythonProcess.on('close', (code) => {
            console.log(`Backend process exited with code ${code}`);
            pythonProcess = null;
        });

        pythonProcess.on('error', (error) => {
            console.error('Failed to start backend process:', error);
            pythonProcess = null;
        });

        console.log('Backend started successfully');
    } catch (error) {
        console.error('Error starting backend:', error);
    }
};

// Function to stop Python backend
const stopPythonBackend = () => {
    if (pythonProcess) {
        console.log('Stopping backend');
        pythonProcess.kill();
        pythonProcess = null;
    }
};

app.on("ready", ()=>{
    const mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        icon: path.join(app.getAppPath(), 'public', process.platform === 'win32' ? 'icon.ico' : 'icon.ico'),
        webPreferences: {
            preload: getPreloadPath(),
        },
    });

    mainWindow.maximize();

    if (isDev()) {
        mainWindow.loadURL('http://localhost:5123');
    } else {
        mainWindow.loadFile(path.join(app.getAppPath(), '/dist-react/index.html'));
    }

    // Start Python backend after window is ready
    mainWindow.webContents.once('did-finish-load', () => {
        setTimeout(() => {
            startPythonBackend();
        }, 1000);
    });

    // IPC handler for saving measurement data
    ipcMain.handle('save-measurement-data', async (_, data: DataPoint[]) => {
        // Show save dialog
        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Save Measurements:',
            defaultPath: path.join(app.getPath('desktop'), 'measurements.csv'), 
            filters: [
                { name: 'Pliki CSV', extensions: ['csv'] },
                { name: 'Pliki Excel', extensions: ['xlsx'] },
            ],
            properties: ['createDirectory']
        });

        if (canceled || !filePath) {
            return { success: false };
        }

        try {
            const fileExt = path.extname(filePath).toLowerCase();
        
            if (fileExt === '.csv') {
                // Save as CSV
                let csvContent = 'Step, Voltage (V), Current (A)\n';
                data.forEach((point: DataPoint) => {
                    csvContent += `${point.step}, ${point.voltage}, ${point.current}\n`;
                });
                fs.writeFileSync(filePath, csvContent, 'utf8');
            } else if (fileExt === '.xlsx') {
                // Save as Excel
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Measurements');
                
                worksheet.columns = [
                    { header: 'Step', key: 'step' },
                    { header: 'Voltage (V)', key: 'voltage' },
                    { header: 'Current (A)', key: 'current' }
                ];
        
                worksheet.addRows(data);
                
                worksheet.columns.forEach(column => {
                    column.width = 15;
                });
        
                await workbook.xlsx.writeFile(filePath);
            }

            return { success: true };
        } catch (error) {
            console.error('Save error:', error);
            return { success: false};
        }
    });
     
    // Handler for listing serial ports
    ipcMain.handle('list-serial-ports', async () => {
        try {
            const allPorts = await SerialPort.list();
            const filteredPorts = platformConfig.filterSerialPorts(allPorts);
                
            console.log(`Platform: ${process.platform}`);
            console.log(`Found ${filteredPorts.length} relevant ports:`, filteredPorts.map(p => p.path));
                
            return filteredPorts;
        } catch (error) {
            console.error('Error listing serial ports:', error);
            return [];
        }
    });
});

// Clean up on app quit
app.on('before-quit', () => {
    stopPythonBackend();
});

app.on('window-all-closed', () => {
    stopPythonBackend();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});