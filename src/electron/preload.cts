const electron = require('electron');
const { contextBridge, ipcRenderer } = electron;

let socket: WebSocket | null = null;
let messageCallback: ((data: string) => void) | null = null;

const websocketAPI = {
    connect: (url: string): Promise<void> => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected');
            return Promise.resolve();
        }
        
        if (socket) {
            socket.close();
        }
        
        return new Promise<void>((resolve, reject) => {
            socket = new WebSocket(url);
            
            socket.onopen = () => {
                console.log('WebSocket Connected');
                resolve();
            };
            
            socket.onmessage = (event: MessageEvent) => {
                console.log("WebSocket message received:", event.data);
                if (messageCallback) {
                    messageCallback(event.data);
                }
            };
            
            socket.onclose = (event: CloseEvent) => {
                console.log('WebSocket Disconnected', event);
                socket = null;
            };
        
            socket.onerror = (event: Event) => {
                console.error('WebSocket Error:', event);
                reject(event);
                socket = null;
            };
        });
    },
  
    send: (message: string): void => {
        console.log("Sending WebSocket message:", message);
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(message);
        } else {
            console.error('WebSocket is not connected');
        }
    },
  
    onMessage: (callback: (data: string) => void): void => {
        console.log("Setting onMessage callback");
        messageCallback = callback;
    },
  
    disconnect: (): void => {
        console.log("Disconnecting WebSocket");
        if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
        socket = null;
        }
    },
  
    isConnected: (): boolean => {
        return !!socket && socket.readyState === WebSocket.OPEN;
    }
};

// API for serial ports
const serialPortAPI = {
    listPorts: async (): Promise<any[]> => {
        console.log("preload.cts: Calling listPorts");
        try {
            const ports = await ipcRenderer.invoke('list-serial-ports');
            console.log("preload.cts: Received ports:", ports);
            return ports;
        } catch (error) {
            console.error("preload.cts: Error when fetching ports:", error);
            return [];
        }
    }
};

// API for port formatting
const platformAPI = {
    formatPortDisplay: (portPath: string): string => {
        if (process.platform === 'win32') {
            return portPath;
        } else if (process.platform === 'linux') {
            const usbMatch = portPath.match(/\/dev\/ttyUSB(\d+)/);
            if (usbMatch) return `USB${usbMatch[1]}`;
            
            const acmMatch = portPath.match(/\/dev\/ttyACM(\d+)/);
            if (acmMatch) return `ACM${acmMatch[1]}`;
        }
        return portPath;
    }
};

// Add new API for saving files
const fileSystemAPI = {
    saveMeasurementData: (data: any[]) => {
        return ipcRenderer.invoke('save-measurement-data', data);
    }
};

electron.contextBridge.exposeInMainWorld("websocket", websocketAPI);
contextBridge.exposeInMainWorld("serialport", serialPortAPI);
contextBridge.exposeInMainWorld("platform", platformAPI);
contextBridge.exposeInMainWorld("fileSystem", fileSystemAPI);