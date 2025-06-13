import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'path';
import { isDev } from './util.js';
import { getPreloadPath } from './pathResolver.js';
import * as fs from 'fs';
import ExcelJS from 'exceljs/excel.js';
import { SerialPort } from 'serialport/dist/index.js';
import { startBackend } from './startBackend.js';

interface DataPoint {
    step: number;
    voltage: number;
    current: number;
}

app.on("ready", ()=>{
    // Start the backend
    startBackend();

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
                
                worksheet.columns.forEach((column: Partial<ExcelJS.Column>) => {
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