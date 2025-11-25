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

let lastUsedDirectory: string | null = null;

// Function to start Python backend
const startPythonBackend = () => {
    if (isDev()) {
        console.log('Development mode');
        return;
    }
    try {
        // Get platform-specific backend executable path
        const backendInfo = platformConfig.getBackendPath();
        const backendDir = path.join(process.resourcesPath, 'backend', backendInfo.dir);
        const backendPath = path.join(backendDir, backendInfo.executable);
        
        console.log('Starting backend:', backendPath);
        
        if (!fs.existsSync(backendPath)) {
            console.error('Backend executable not found:', backendPath);
            return;
        }

        if (platformConfig.isLinux || platformConfig.isMacOS) {
            try {
                fs.chmodSync(backendPath, '755');
                console.log('Set executable permissions for:', backendPath);
            } catch (error) {
                console.warn('Could not set executable permissions:', error);
            }
        }

        // Spawn the backend process with stdio pipes
        pythonProcess = spawn(backendPath, [], {
            cwd: backendDir,
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: false
        });

        // Handle backend process output and lifecycle events
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

        if (process.platform === 'win32') {
            // Windows: Use taskkill for proper process tree termination
            try {
                if (pythonProcess.pid) {
                    spawn('taskkill', ['/pid', pythonProcess.pid.toString(), '/f', '/t']);
                }
            } catch (error) {
                console.error('Error killing process with taskkill:', error);
                pythonProcess.kill('SIGTERM');
            }
        } else {
            // Unix-like: SIGTERM then SIGKILL if needed
            pythonProcess.kill('SIGTERM');
            
            setTimeout(() => {
                if (pythonProcess && !pythonProcess.killed) {
                    console.log('Force killing backend with SIGKILL');
                    pythonProcess.kill('SIGKILL');
                }
            }, 2000);
        }
        
        pythonProcess = null;
    }
};

let cameraWindow: BrowserWindow | null = null;

// Creates separate always-on-top camera window for image capture functionality
const createCameraWindow = () => {
    // Reuse existing window if available
    if (cameraWindow && !cameraWindow.isDestroyed()) {
        cameraWindow.focus();
        return;
    }

    // Create new camera window with always-on-top behavior
    cameraWindow = new BrowserWindow({
        width: 800,
        height: 600,
        title: 'Camera Window',
        alwaysOnTop: true,
        icon: path.join(app.getAppPath(), 'public', process.platform === 'win32' ? 'icon.ico' : 'icon.ico'),
        webPreferences: {
            preload: getPreloadPath(),
        },
    });

    // Load camera interface with special query parameter
    if (isDev()) {
        cameraWindow.loadURL('http://localhost:5123/?window=camera');
    } else {
        cameraWindow.loadFile(path.join(app.getAppPath(), '/dist-react/index.html'), {
            query: { window: 'camera' }
        });
    }

    // Clean up reference when window closes
    cameraWindow.on('closed', () => {
        cameraWindow = null;
    });
};

// Application ready event - creates main window and sets up IPC handlers
app.on("ready", ()=>{
    // Create maximized main application window
    const mainWindow = new BrowserWindow({
        width: 1920,
        height: 1080,
        icon: path.join(app.getAppPath(), 'public', process.platform === 'win32' ? 'icon.ico' : 'icon.ico'),
        webPreferences: {
            preload: getPreloadPath(),
        },
    });

    mainWindow.maximize();

    // Load main interface based on environment
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

    // Clean shutdown when main window closes
    mainWindow.on('close', () => {
        console.log('Main window closing, stopping backend...');
        stopPythonBackend();
    });

    // IPC Handler: Save measurement data
    ipcMain.handle('save-measurement-data', async (_, data: DataPoint[]) => {
        const defaultDirectory = lastUsedDirectory || app.getPath('desktop');
        const defaultPath = path.join(defaultDirectory, 'measurements.csv');

        // Show save dialog
        const { canceled, filePath } = await dialog.showSaveDialog({
            title: 'Save Measurements:',
            defaultPath: defaultPath,
            filters: [
                { name: 'CSV Files', extensions: ['csv'] },
                { name: 'Excel Files', extensions: ['xlsx'] },
            ],
            properties: ['createDirectory']
        });

        if (canceled || !filePath) {
            return { success: false };
        }

        try {
            lastUsedDirectory = path.dirname(filePath);
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
     
    // IPC Handler: List available serial ports filtered by platform
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

    // IPC Handler: Open camera window for image capture
    ipcMain.handle('open-camera-window', () => {
        createCameraWindow();
    });
});

// Handle app quit events - ensure proper cleanup of backend process
app.on('before-quit', (event) => {
    console.log('App before-quit event');
    if (pythonProcess && !pythonProcess.killed) {
        event.preventDefault();
        stopPythonBackend();
        
        setTimeout(() => {
            app.quit();
        }, 1000);
    }
});

app.on('will-quit', () => {
    console.log('App will-quit event');
    stopPythonBackend();
});

app.on('window-all-closed', () => {
    console.log('All windows closed');
    stopPythonBackend();
    
    setTimeout(() => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    }, 500);
});