import { spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';
import os from 'os';

let backendProcess: any = null;

async function setupPythonEnvironment() {
    console.log('=== Starting Python environment setup ===');
    const isDev = process.env.NODE_ENV === 'development';
    const platform = os.platform();
    
    console.log(`Environment: isDev=${isDev}, platform=${platform}`);
    
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
    
    console.log(`Python path: ${pythonPath}`);
    
    const setupScript = isDev
        ? path.join(process.cwd(), 'backend', 'setup.py')
        : path.join(process.resourcesPath, 'backend', 'setup.py');

    console.log(`Setup script path: ${setupScript}`);

    return new Promise<void>((resolve, reject) => {
        console.log('Spawning setup process...');
        const setup = spawn(pythonPath, [setupScript]);
        
        setup.stdout.on('data', (data: Buffer) => {
            console.log(`Setup stdout: ${data}`);
        });

        setup.stderr.on('data', (data: Buffer) => {
            console.error(`Setup stderr: ${data}`);
        });

        setup.on('close', (code: number) => {
            console.log(`Setup process closed with code: ${code}`);
            if (code === 0) {
                console.log('✅ Python environment setup completed successfully');
                resolve();
            } else {
                console.error(`❌ Setup failed with code ${code}`);
                reject(new Error(`Setup failed with code ${code}`));
            }
        });

        setup.on('error', (error: Error) => {
            console.error(`❌ Setup process error:`, error);
            reject(error);
        });
    });
}

export async function startBackend() {
    console.log('=== Starting backend process ===');
    
    if (backendProcess) {
        console.log('⚠️ Backend is already running');
        return;
    }

    try {
        console.log('🔧 Setting up Python environment...');
        await setupPythonEnvironment();

        const isDev = process.env.NODE_ENV === 'development';
        const platform = os.platform();
        
        console.log(`Environment: isDev=${isDev}, platform=${platform}`);
        
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

        const workingDir = path.dirname(scriptPath);

        console.log('📋 Backend startup configuration:');
        console.log(`  Python path: ${pythonPath}`);
        console.log(`  Script path: ${scriptPath}`);
        console.log(`  Working directory: ${workingDir}`);
        console.log(`  Environment: isDev=${isDev}, platform=${platform}`);

        // Check if files exist
        const fs = require('fs');
        console.log('🔍 Checking file existence:');
        console.log(`  Python executable exists: ${fs.existsSync(pythonPath)}`);
        console.log(`  Script file exists: ${fs.existsSync(scriptPath)}`);
        console.log(`  Working directory exists: ${fs.existsSync(workingDir)}`);

        console.log('🚀 Spawning backend process...');
        backendProcess = spawn(pythonPath, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000'], {
            cwd: workingDir,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        console.log(`✅ Backend process spawned with PID: ${backendProcess.pid}`);

        backendProcess.stdout.on('data', (data: Buffer) => {
            console.log(`📤 Backend stdout: ${data.toString().trim()}`);
        });

        backendProcess.stderr.on('data', (data: Buffer) => {
            console.error(`📥 Backend stderr: ${data.toString().trim()}`);
        });

        backendProcess.on('close', (code: number) => {
            console.log(`🔚 Backend process exited with code ${code}`);
            backendProcess = null;
        });

        backendProcess.on('error', (error: Error) => {
            console.error(`❌ Backend process error:`, error);
            backendProcess = null;
        });

        backendProcess.on('spawn', () => {
            console.log('🎉 Backend process spawned successfully');
        });

    } catch (error) {
        console.error('❌ Failed to start backend:', error);
        backendProcess = null;
    }
}

export function stopBackend() {
    console.log('=== Stopping backend process ===');
    if (backendProcess) {
        console.log(`🛑 Killing backend process with PID: ${backendProcess.pid}`);
        backendProcess.kill();
        backendProcess = null;
        console.log('✅ Backend process stopped');
    } else {
        console.log('⚠️ No backend process to stop');
    }
}

// Handle app quit
app.on('before-quit', () => {
    console.log('🔄 App quitting, stopping backend...');
    stopBackend();
}); 