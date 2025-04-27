import Toolbar from "./Toolbar";
import './App.css'
import ScatterChart from "./ScatterChart";
import React, { useState, useEffect, useCallback } from "react";

// Interface for measurement data points
interface DataPoint {
    step: number;
    current: number;
    voltage: number;
}

// Interface for measurement configuration
interface MeasurementConfig {
    isVoltSrc: boolean;
    iterations: number;
    voltLimit?: number;
    currLimit?: number;
    iMax?: number;
    iMin?: number;
    uMax?: number;
    uMin?: number;
}

// Global declaration for WebSocket interface
declare global {
    interface Window {
        websocket: {
            connect: (url: string) => Promise<void>;
            send: (message: string) => void;
            onMessage: (callback: (data: string) => void) => void;
            disconnect: () => void;
            isConnected: () => boolean;
        };
    }
}

// Main application component
const App: React.FC = () => {
    const [xScaleType, setXScaleType] = useState<"linear" | "log">("linear");
    const [yScaleType, setYScaleType] = useState<"linear" | "log">("linear");
    
    // WebSocket connection state
    const [isConnected, setIsConnected] = useState(false);
    const [measurementData, setMeasurementData] = useState<DataPoint[]>([]);
    const [isMeasuring, setIsMeasuring] = useState(false);

    const connect = useCallback(async () => {
        try {
            await window.websocket.connect('ws://127.0.0.1:8000/com');
            setIsConnected(true);
            
            // Clear previous measurement data when connecting
            setMeasurementData([]);
            
            return true;
        } catch (error) {
            console.error('Connection error:', error);
            setIsConnected(false);
            return false;
        }
    }, []);

    // Function to start measurement
    const startMeasurement = useCallback((iterations: number, port: string, config?: MeasurementConfig): boolean => {
    if (!window.websocket.isConnected()) {
        console.error("Cannot start measurement: WebSocket not connected");
        return false;
    }
        setIsMeasuring(true);
    
        const measurementConfig = {
            command: 'test',
            port: port,
            iterations: iterations,
            isVoltSrc: config?.isVoltSrc ?? true,
            voltLimit: config?.voltLimit,
            currLimit: config?.currLimit,
            iMax: config?.iMax,
            iMin: config?.iMin,
            uMax: config?.uMax,
            uMin: config?.uMin
        };
    
        console.log("Sending measurement configuration:", measurementConfig);
        window.websocket.send(JSON.stringify(measurementConfig));
        
        return true;
    }, []);

    // Stops the current measurement and sends a stop command
    const stopMeasurement = useCallback(() => {
        if (window.websocket && window.websocket.isConnected()) {
            console.log("Disconnecting WebSocket");
            
            const stopConfig = {
                command: 'stop'
            };
            
            console.log("Sending stop command");
            window.websocket.send(JSON.stringify(stopConfig));
            
            disconnect();
        }
    }, []);

    // Function to disconnect from WebSocket
    const disconnect = useCallback(() => {
        if (window.websocket && window.websocket.isConnected()) {
            console.log("Disconnecting WebSocket");
            
            setTimeout(() => {
                if (window.websocket && window.websocket.isConnected()) {
                    window.websocket.disconnect();
                    setIsConnected(false);
                    setIsMeasuring(false);
                    console.log("WebSocket disconnected");
                }
            }, 100);
        }
    }, []);

    // Function to handle WebSocket messages
    const handleWebSocketMessage = useCallback((data: string) => {
        console.log("WebSocket message received:", data);
        
        // Check if this is a "Finished" message
        if (typeof data === 'string') {
            if (
                data === "Finished" || 
                data.includes("Finished") ||
                data.includes("finished")
            ) {
                console.log("Detected 'Finished' message");
                setIsMeasuring(false);
                console.log("Test completed, data points collected:", measurementData.length);
                
                disconnect();
                return;
            }
        }
        
        try {
            const jsonData = JSON.parse(data);
            
            // Check if it's JSON with a "Finished" message
            if (jsonData && typeof jsonData === 'object') {
                if (jsonData.message === "Finished") {
                    console.log("Detected JSON 'Finished' message");
                    setIsMeasuring(false);
                    disconnect();
                    return;
                }
            }
          
            // If these are regular measurement data, add them to the chart
            if (jsonData && 'voltage' in jsonData && 'current' in jsonData && 'step' in jsonData) {
                const dataPoint = jsonData as DataPoint;
                setMeasurementData(prev => [...prev, dataPoint]);
            }
        } catch (e) {
            console.log("Non-JSON message received");
        }
    }, [disconnect, measurementData.length]);

    // Set up WebSocket message handling
    useEffect(() => {
        if (window.websocket) {
            console.log("Setting up WebSocket message handler");
            window.websocket.onMessage(handleWebSocketMessage);
        }
        
        return () => {
            console.log("Cleaning up WebSocket message handler");
        };
    }, [handleWebSocketMessage]);

    return (
        <div className="app-container">
            <Toolbar 
                xScaleType={xScaleType}
                yScaleType={yScaleType}
                setXScaleType={setXScaleType}
                setYScaleType={setYScaleType}
                connect={connect}
                isConnected={isConnected}
                setIsConnected={setIsConnected}
                isMeasuring={isMeasuring}
                setIsMeasuring={setIsMeasuring}
                startMeasurement={startMeasurement}
                stopMeasurement={stopMeasurement}
            />
            <div className="chart-container">
                <ScatterChart 
                    xScaleType={xScaleType}
                    yScaleType={yScaleType}
                    data={measurementData}
                />
                
                {/* Status panel */}
                <div style={{ 
                    position: 'absolute', 
                    bottom: 5, 
                    right: 5, 
                    background: 'rgba(0,0,0,0.7)', 
                    color: 'white',
                    padding: 8,
                    borderRadius: 5,
                    overflow: 'hidden',
                    width: 180,
                    fontSize: '12px'
                }}>
                    <div>{isConnected ? "Connected" : "Disconnected"}</div>
                    <div>Points: {measurementData.length}</div>
                </div>
            </div>
        </div>
    );
};

export default App;