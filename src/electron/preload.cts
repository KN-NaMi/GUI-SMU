const electron = require('electron');

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

electron.contextBridge.exposeInMainWorld("websocket", websocketAPI);