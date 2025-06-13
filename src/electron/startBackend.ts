import { spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';
import fs from 'fs';
import os from 'os';

let backendProcess: any = null;

async function setupPythonEnvironment() {
    const isDev = process.env.NODE_ENV === 'development';
    const platform = os.platform();
    
    let pythonPath: string;
    if (platform === 'win32') {
        pythonPath = isDev 
            ? path.join(process.cwd(), 'backend', '.venv', 'Scripts', 'python.exe')
            : path.join(process.resourcesPath, 'backend', 'python', 'python.exe');
    } else if (platform === 'darwin') {
        pythonPath = isDev
            ? path.join(process.cwd(), 'backend', '.venv', 'bin', 'python')
            : path.join(process.resourcesPath, 'backend', 'python', 'Python.framework', 'Versions', '3.11', 'bin', 'python3');
    } else {
        throw new Error(`Unsupported platform: ${platform}`);
    }
    
    const setupScript = isDev
        ? path.join(process.cwd(), 'backend', 'setup.py')
        : path.join(process.resourcesPath, 'backend', 'setup.py');

    return new Promise<void>((resolve, reject) => {
        const setup = spawn(pythonPath, [setupScript]);
        
        setup.stdout.on('data', (data: Buffer) => {
            console.log(`Setup stdout: ${data}`);
        });

        setup.stderr.on('data', (data: Buffer) => {
            console.error(`Setup stderr: ${data}`);
        });

        setup.on('close', (code: number) => {
            if (code === 0) {
                console.log('Python environment setup completed');
                resolve();
            } else {
                console.error(`Setup failed with code ${code}`);
                reject(new Error(`Setup failed with code ${code}`));
            }
        });
    });
}

export async function startBackend() {
    if (backendProcess) {
        console.log('Backend is already running');
        return;
    }

    try {
        await setupPythonEnvironment();

        const isDev = process.env.NODE_ENV === 'development';
        const platform = os.platform();
        
        let pythonPath: string;
        if (platform === 'win32') {
            pythonPath = isDev 
                ? path.join(process.cwd(), 'backend', '.venv', 'Scripts', 'python.exe')
                : path.join(process.resourcesPath, 'backend', 'python', 'python.exe');
        } else if (platform === 'darwin') {
            pythonPath = isDev
                ? path.join(process.cwd(), 'backend', '.venv', 'bin', 'python')
                : path.join(process.resourcesPath, 'backend', 'python', 'Python.framework', 'Versions', '3.11', 'bin', 'python3');
        } else {
            throw new Error(`Unsupported platform: ${platform}`);
        }
        
        const scriptPath = isDev
            ? path.join(process.cwd(), 'backend', 'main.py')
            : path.join(process.resourcesPath, 'backend', 'main.py');

        console.log('Starting backend with:', {
            pythonPath,
            scriptPath,
            isDev,
            platform
        });

        backendProcess = spawn(pythonPath, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000'], {
            cwd: path.dirname(scriptPath)
        });

        backendProcess.stdout.on('data', (data: Buffer) => {
            console.log(`Backend stdout: ${data}`);
        });

        backendProcess.stderr.on('data', (data: Buffer) => {
            console.error(`Backend stderr: ${data}`);
        });

        backendProcess.on('close', (code: number) => {
            console.log(`Backend process exited with code ${code}`);
            backendProcess = null;
        });
    } catch (error) {
        console.error('Failed to start backend:', error);
    }
}

export function stopBackend() {
    if (backendProcess) {
        backendProcess.kill();
        backendProcess = null;
    }
}

// Handle app quit
app.on('before-quit', () => {
    stopBackend();
}); 