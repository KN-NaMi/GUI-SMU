import { spawn } from 'child_process';
import path from 'path';
import { app, BrowserWindow } from 'electron';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';

let backendProcess: any = null;

// Function to send log to renderer process
function sendLogToRenderer(message: string) {
    // Try to send to any available renderer process
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window: any) => {
        if (!window.isDestroyed()) {
            window.webContents.send('backend-log', message);
        }
    });
}

async function setupPythonEnvironment() {
    console.log('=== Starting Python environment setup ===');
    sendLogToRenderer('=== Starting Python environment setup ===');
    
    const isDev = process.env.NODE_ENV === 'development';
    const platform = os.platform();
    
    console.log(`Environment: isDev=${isDev}, platform=${platform}`);
    sendLogToRenderer(`Environment: isDev=${isDev}, platform=${platform}`);
    
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
    sendLogToRenderer(`Python path: ${pythonPath}`);
    
    const setupScript = isDev
        ? path.join(process.cwd(), 'backend', 'setup.py')
        : path.join(process.resourcesPath, 'backend', 'setup.py');

    console.log(`Setup script path: ${setupScript}`);
    sendLogToRenderer(`Setup script path: ${setupScript}`);

    return new Promise<void>((resolve, reject) => {
        console.log('Spawning setup process...');
        sendLogToRenderer('Spawning setup process...');
        
        const setup = spawn(pythonPath, [setupScript]);
        
        setup.stdout.on('data', (data: Buffer) => {
            const message = `Setup stdout: ${data}`;
            console.log(message);
            sendLogToRenderer(message);
        });

        setup.stderr.on('data', (data: Buffer) => {
            const message = `Setup stderr: ${data}`;
            console.error(message);
            sendLogToRenderer(message);
        });

        setup.on('close', (code: number) => {
            const message = `Setup process closed with code: ${code}`;
            console.log(message);
            sendLogToRenderer(message);
            
            if (code === 0) {
                const successMessage = '✅ Python environment setup completed successfully';
                console.log(successMessage);
                sendLogToRenderer(successMessage);
                resolve();
            } else {
                const errorMessage = `❌ Setup failed with code ${code}`;
                console.error(errorMessage);
                sendLogToRenderer(errorMessage);
                reject(new Error(`Setup failed with code ${code}`));
            }
        });

        setup.on('error', (error: Error) => {
            const errorMessage = `❌ Setup process error: ${error.message}`;
            console.error(errorMessage);
            sendLogToRenderer(errorMessage);
            reject(error);
        });
    });
}

export async function startBackend() {
    console.log('=== Starting backend process ===');
    sendLogToRenderer('=== Starting backend process ===');
    
    if (backendProcess) {
        const message = '⚠️ Backend is already running';
        console.log(message);
        sendLogToRenderer(message);
        return;
    }

    try {
        console.log('🔧 Setting up Python environment...');
        sendLogToRenderer('🔧 Setting up Python environment...');
        
        await setupPythonEnvironment();

        const isDev = process.env.NODE_ENV === 'development';
        const platform = os.platform();
        
        console.log(`Environment: isDev=${isDev}, platform=${platform}`);
        sendLogToRenderer(`Environment: isDev=${isDev}, platform=${platform}`);
        
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
        
        // Log additional information for production mode
        if (!isDev) {
            console.log(`🔍 Production mode details:`);
            sendLogToRenderer(`🔍 Production mode details:`);
            console.log(`  process.resourcesPath: ${process.resourcesPath}`);
            sendLogToRenderer(`  process.resourcesPath: ${process.resourcesPath}`);
            console.log(`  process.execPath: ${process.execPath}`);
            sendLogToRenderer(`  process.execPath: ${process.execPath}`);
            console.log(`  process.cwd(): ${process.cwd()}`);
            sendLogToRenderer(`  process.cwd(): ${process.cwd()}`);
            
            // Check if python directory exists in resources
            const pythonDir = path.join(process.resourcesPath, 'backend', 'python');
            console.log(`  Python directory exists: ${fs.existsSync(pythonDir)}`);
            sendLogToRenderer(`  Python directory exists: ${fs.existsSync(pythonDir)}`);
            
            if (fs.existsSync(pythonDir)) {
                const pythonFiles = fs.readdirSync(pythonDir);
                console.log(`  Python directory contents: ${pythonFiles.join(', ')}`);
                sendLogToRenderer(`  Python directory contents: ${pythonFiles.join(', ')}`);
            }
        }

        const scriptPath = isDev
            ? path.join(process.cwd(), 'backend', 'main.py')
            : path.join(process.resourcesPath, 'backend', 'main.py');

        const workingDir = path.dirname(scriptPath);

        console.log('📋 Backend startup configuration:');
        sendLogToRenderer('📋 Backend startup configuration:');
        
        console.log(`  Python path: ${pythonPath}`);
        sendLogToRenderer(`  Python path: ${pythonPath}`);
        
        console.log(`  Script path: ${scriptPath}`);
        sendLogToRenderer(`  Script path: ${scriptPath}`);
        
        console.log(`  Working directory: ${workingDir}`);
        sendLogToRenderer(`  Working directory: ${workingDir}`);
        
        console.log(`  Environment: isDev=${isDev}, platform=${platform}`);
        sendLogToRenderer(`  Environment: isDev=${isDev}, platform=${platform}`);

        // Check if files exist
        console.log('🔍 Checking file existence:');
        sendLogToRenderer('🔍 Checking file existence:');
        
        console.log(`  Python executable exists: ${fs.existsSync(pythonPath)}`);
        sendLogToRenderer(`  Python executable exists: ${fs.existsSync(pythonPath)}`);
        
        // If Python not found in production mode, try alternative paths
        if (!isDev && !fs.existsSync(pythonPath)) {
            console.log('⚠️ Python not found in expected location, trying alternatives...');
            sendLogToRenderer('⚠️ Python not found in expected location, trying alternatives...');
            
            const alternativePaths = [
                path.join(process.resourcesPath, 'python', 'python.exe'),
                path.join(process.resourcesPath, 'python', 'python3.exe'),
                path.join(process.resourcesPath, 'python', 'Python.framework', 'Versions', '3.11', 'bin', 'python3'),
                path.join(process.resourcesPath, 'python', 'Python.framework', 'Versions', '3.11', 'bin', 'python'),
                'python',
                'python3'
            ];
            
            for (const altPath of alternativePaths) {
                console.log(`  Trying: ${altPath}`);
                sendLogToRenderer(`  Trying: ${altPath}`);
                
                if (altPath === 'python' || altPath === 'python3') {
                    // Try system Python
                    try {
                        execSync(`${altPath} --version`, { stdio: 'pipe' });
                        pythonPath = altPath;
                        console.log(`✅ Found system Python: ${altPath}`);
                        sendLogToRenderer(`✅ Found system Python: ${altPath}`);
                        break;
                    } catch (e) {
                        console.log(`❌ System Python not found: ${altPath}`);
                        sendLogToRenderer(`❌ System Python not found: ${altPath}`);
                    }
                } else if (fs.existsSync(altPath)) {
                    pythonPath = altPath;
                    console.log(`✅ Found Python at: ${altPath}`);
                    sendLogToRenderer(`✅ Found Python at: ${altPath}`);
                    break;
                } else {
                    console.log(`❌ Not found: ${altPath}`);
                    sendLogToRenderer(`❌ Not found: ${altPath}`);
                }
            }
        }
        
        console.log(`  Script file exists: ${fs.existsSync(scriptPath)}`);
        sendLogToRenderer(`  Script file exists: ${fs.existsSync(scriptPath)}`);
        
        console.log(`  Working directory exists: ${fs.existsSync(workingDir)}`);
        sendLogToRenderer(`  Working directory exists: ${fs.existsSync(workingDir)}`);

        console.log('🚀 Spawning backend process...');
        sendLogToRenderer('🚀 Spawning backend process...');
        
        backendProcess = spawn(pythonPath, ['-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8000'], {
            cwd: workingDir,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        const pidMessage = `✅ Backend process spawned with PID: ${backendProcess.pid}`;
        console.log(pidMessage);
        sendLogToRenderer(pidMessage);

        backendProcess.stdout.on('data', (data: Buffer) => {
            const message = `📤 Backend stdout: ${data.toString().trim()}`;
            console.log(message);
            sendLogToRenderer(message);
        });

        backendProcess.stderr.on('data', (data: Buffer) => {
            const message = `📥 Backend stderr: ${data.toString().trim()}`;
            console.error(message);
            sendLogToRenderer(message);
        });

        backendProcess.on('close', (code: number) => {
            const message = `🔚 Backend process exited with code ${code}`;
            console.log(message);
            sendLogToRenderer(message);
            backendProcess = null;
        });

        backendProcess.on('error', (error: Error) => {
            const message = `❌ Backend process error: ${error.message}`;
            console.error(message);
            sendLogToRenderer(message);
            backendProcess = null;
        });

        backendProcess.on('spawn', () => {
            const message = '🎉 Backend process spawned successfully';
            console.log(message);
            sendLogToRenderer(message);
        });

    } catch (error) {
        const errorMessage = `❌ Failed to start backend: ${error}`;
        console.error(errorMessage);
        sendLogToRenderer(errorMessage);
        backendProcess = null;
    }
}

export function stopBackend() {
    console.log('=== Stopping backend process ===');
    sendLogToRenderer('=== Stopping backend process ===');
    
    if (backendProcess) {
        const message = `🛑 Killing backend process with PID: ${backendProcess.pid}`;
        console.log(message);
        sendLogToRenderer(message);
        backendProcess.kill();
        backendProcess = null;
        console.log('✅ Backend process stopped');
        sendLogToRenderer('✅ Backend process stopped');
    } else {
        const message = '⚠️ No backend process to stop';
        console.log(message);
        sendLogToRenderer(message);
    }
}

// Handle app quit
app.on('before-quit', () => {
    console.log('🔄 App quitting, stopping backend...');
    sendLogToRenderer('🔄 App quitting, stopping backend...');
    stopBackend();
}); 