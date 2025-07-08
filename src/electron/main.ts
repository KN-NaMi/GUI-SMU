import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import { isDev } from './util.js';
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
        // Development mode - nie uruchamiamy Python z Electron
        // Backend jest uruchamiany przez npm script
        console.log('Development mode - Python backend managed by npm');
        return;
    }

    // Production mode - uruchom embedded Python
    try {
        const pythonPath = path.join(process.resourcesPath, 'backend', 'python-embedded', 'python.exe');
        const scriptPath = path.join(process.resourcesPath, 'backend', 'main.py');
        
        console.log('Starting Python backend:', pythonPath);
        console.log('Script path:', scriptPath);
        
        // Sprawdź czy pliki istnieją
        if (!fs.existsSync(pythonPath)) {
            console.error('Python executable not found:', pythonPath);
            return;
        }
        
        if (!fs.existsSync(scriptPath)) {
            console.error('Python script not found:', scriptPath);
            return;
        }

        pythonProcess = spawn(pythonPath, [scriptPath], {
            cwd: path.join(process.resourcesPath, 'backend'),
            stdio: ['pipe', 'pipe', 'pipe']
        });

        pythonProcess.stdout?.on('data', (data) => {
            console.log('Python stdout:', data.toString());
        });

        pythonProcess.stderr?.on('data', (data) => {
            console.error('Python stderr:', data.toString());
        });

        pythonProcess.on('close', (code) => {
            console.log(`Python process exited with code ${code}`);
            pythonProcess = null;
        });

        pythonProcess.on('error', (error) => {
            console.error('Failed to start Python process:', error);
            pythonProcess = null;
        });

        console.log('Python backend started successfully');
    } catch (error) {
        console.error('Error starting Python backend:', error);
    }
};

// Function to stop Python backend
const stopPythonBackend = () => {
    if (pythonProcess) {
        console.log('Stopping Python backend');
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
        // Delay to ensure everything is loaded
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
            const ports = await SerialPort.list();
            return ports;
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