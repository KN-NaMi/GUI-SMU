import Toolbar, { ChartAxisKey } from "./Toolbar";
import './App.css'
import ScatterChart from "./ScatterChart";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { scaleChartData, CurrentUnit, VoltageUnit } from './ScaleChartData';
import CameraWindow from "./CameraWindow";

interface DataPoint {
    step: number;
    current: number;
    voltage: number;
}

interface MeasurementConfig {
    isVoltSrc: boolean;
    iterations: number;
    delay?: number;
    isBothWays?: boolean;
    repeats?: number;
    is4Wire?: boolean;
    voltLimit?: number;
    currLimit?: number;
    iMax?: number;
    iMin?: number;
    uMax?: number;
    uMin?: number;
}

declare global {
    interface Window {
        websocket: {
            connect: (url: string) => Promise<void>;
            send: (message: string) => void;
            onMessage: (callback: (data: string) => void) => void;
            disconnect: () => void;
            isConnected: () => boolean;
        };
        serialport: {
            listPorts: () => Promise<Array<{ path: string }>>;
        };
        fileSystem: {
            saveMeasurementData: (data: any[]) => Promise<{
                success: boolean;
                message: string;
                path?: string;
            }>;
        };
        platform: {
            formatPortDisplay: (portPath: string) => string;
        };
        camera: {
            openWindow: () => Promise<void>;
        };
    }
}

const App: React.FC = () => {
    const [xScaleType, setXScaleType] = useState<"linear" | "log">("linear");
    const [yScaleType, setYScaleType] = useState<"linear" | "log">("linear");
    const [currentUnit, setCurrentUnit] = useState<CurrentUnit>('A');
    const [voltageUnit, setVoltageUnit] = useState<VoltageUnit>('V');
    const [xAxisDataKey, setXAxisDataKey] = useState<ChartAxisKey>('current');
    const [yAxisDataKey, setYAxisDataKey] = useState<ChartAxisKey>('voltage');

    const handleCurrentUnitChange = (unit: CurrentUnit) => {
        setCurrentUnit(unit);
    };

    const handleVoltageUnitChange = (unit: VoltageUnit) => {
        setVoltageUnit(unit);
    };
    
    const handleAxesChange = useCallback((newXKey: ChartAxisKey, newYKey: ChartAxisKey) => {
        setXAxisDataKey(newXKey);
        setYAxisDataKey(newYKey);
    }, []);

    const [isConnected, setIsConnected] = useState(false);
    const [measurementData, setMeasurementData] = useState<DataPoint[]>([]);
    const [isMeasuring, setIsMeasuring] = useState(false);

    const connect = useCallback(async () => {
        try {
            await window.websocket.connect('ws://127.0.0.1:8000/com');
            setIsConnected(true);
            setMeasurementData([]);
            return true;
        } catch (error) {
            setIsConnected(false);
            return false;
        }
    }, []);

    const startMeasurement = useCallback((iterations: number, port: string, config?: MeasurementConfig): boolean => {
        if (!window.websocket.isConnected()) {
            return false;
        }
        setIsMeasuring(true);
    
        const measurementConfig = {
            command: 'start',
            port: port,
            iterations: iterations,
            delay: config?.delay,
            isBothWays: config?.isBothWays,
            repeats: config?.repeats,
            is4Wire: config?.is4Wire,
            isVoltSrc: config?.isVoltSrc ?? true,
            voltLimit: config?.voltLimit,
            currLimit: config?.currLimit,
            iMax: config?.iMax,
            iMin: config?.iMin,
            uMax: config?.uMax,
            uMin: config?.uMin
        };
    
        window.websocket.send(JSON.stringify(measurementConfig));
        return true;
    }, []);

    const stopMeasurement = useCallback(() => {
        if (window.websocket && window.websocket.isConnected()) {
            const stopConfig = {
                command: 'stop',
                port: null,
                iterations: null,
                delay: null,
                isBothWays: null,
                repeats: null,
                is4Wire: null,
                isVoltSrc: null,
                voltLimit: null,
                currLimit: null,
                iMax: null,
                iMin: null,
                uMax: null,
                uMin: null
            };

            window.websocket.send(JSON.stringify(stopConfig));
            disconnect();
        }
    }, []);

    const disconnect = useCallback(() => {
        if (window.websocket && window.websocket.isConnected()) {
            setTimeout(() => {
                if (window.websocket && window.websocket.isConnected()) {
                    window.websocket.disconnect();
                    setIsConnected(false);
                    setIsMeasuring(false);
                }
            }, 100);
        }
    }, []);

    const handleWebSocketMessage = useCallback((data: string) => {
        if (typeof data === 'string') {
            if (
                data === "Finished" || 
                data.includes("Finished") ||
                data.includes("finished")
            ) {
                setIsMeasuring(false);
                disconnect();
                return;
            }
        }
        
        try {
            const jsonData = JSON.parse(data);
            
            if (jsonData && typeof jsonData === 'object') {
                if (jsonData.message === "Finished") {
                    setIsMeasuring(false);
                    disconnect();
                    return;
                }
            }
          
            if (jsonData && 'voltage' in jsonData && 'current' in jsonData && 'step' in jsonData) {
                const dataPoint = jsonData as DataPoint;
                setMeasurementData(prev => [...prev, dataPoint]);
            }
        } catch (e) {
        }
    }, [disconnect, measurementData.length]);

    const scaledMeasurementData = useMemo(() => {
        return scaleChartData(measurementData, currentUnit, voltageUnit);
    }, [measurementData, currentUnit, voltageUnit]);

    useEffect(() => {
        if (window.websocket) {
            window.websocket.onMessage(handleWebSocketMessage);
        }
        return () => {
        };
    }, [handleWebSocketMessage]);

    const [showCamera, setShowCamera] = useState(false);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('window') === 'camera') {
            setShowCamera(true);
        }
    }, []);

    if (showCamera) {
        return <CameraWindow />;
    }

    return (
        <div className="app-container">
            <header className="nami-topbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <svg width="45" height="40" viewBox="0 0 960 859" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M65.9255 289.232C127.686 120.453 289.66 0 479.754 0C669.848 0 831.822 120.453 893.583 289.232H857.657C797.57 139.378 651.014 33.5547 479.754 33.5547C308.494 33.5547 161.939 139.378 101.852 289.232H65.9255Z" fill="white"/>
                        <path d="M81.1455 628.713C132.149 736.796 225.777 820.794 340.332 859H619.177C733.732 820.794 827.36 736.796 878.363 628.713H840.918C793.306 720.104 712.056 791.16 613.594 825.445H345.915C247.453 791.16 166.202 720.104 118.591 628.713H81.1455Z" fill="white"/>
                        <path d="M896.543 606.156V386.526H957.427V606.156H896.543Z" fill="white"/>
                        <path d="M927.128 358.214C918.077 358.214 910.311 355.211 903.832 349.206C897.448 343.105 894.256 335.812 894.256 327.328C894.256 318.94 897.448 311.743 903.832 305.737C910.311 299.636 918.077 296.586 927.128 296.586C936.18 296.586 943.898 299.636 950.281 305.737C956.76 311.743 960 318.94 960 327.328C960 335.812 956.76 343.105 950.281 349.206C943.898 355.211 936.18 358.214 927.128 358.214Z" fill="white"/>
                        <path d="M605.735 313.315H529.415V606.156H589.442V414.837H591.872L667.62 604.726H708.495L784.243 415.552H786.673V606.156H846.7V313.315H770.38L689.772 510.068H686.342L605.735 313.315Z" fill="white"/>
                        <path fillRule="evenodd" clipRule="evenodd" d="M357.409 610.303C343.403 610.303 330.921 607.872 319.964 603.011C309.007 598.054 300.336 590.761 293.952 581.133C287.664 571.41 284.519 559.304 284.519 544.814C284.519 532.612 286.759 522.365 291.237 514.072C295.715 505.778 301.813 499.105 309.531 494.053C317.248 489.001 326.014 485.188 335.828 482.614C345.737 480.04 356.123 478.229 366.985 477.18C379.752 475.846 390.043 474.607 397.856 473.463C405.669 472.224 411.338 470.412 414.863 468.029C418.389 465.646 420.151 462.119 420.151 457.448V456.59C420.151 447.534 417.293 440.528 411.576 435.571C405.955 430.614 397.951 428.135 387.565 428.135C376.608 428.135 367.89 430.566 361.411 435.428C354.932 440.194 350.644 446.2 348.548 453.444L292.237 448.869C295.096 435.523 300.717 423.989 309.102 414.265C317.487 404.447 328.301 396.916 341.545 391.673C354.884 386.335 370.32 383.666 387.851 383.666C400.047 383.666 411.719 385.096 422.867 387.955C434.11 390.815 444.067 395.248 452.737 401.253C461.503 407.259 468.411 414.98 473.461 424.418C478.511 433.76 481.036 444.96 481.036 458.02V606.156H423.296V575.7H421.581C418.055 582.563 413.339 588.616 407.431 593.859C401.524 599.007 394.426 603.058 386.136 606.013C377.847 608.873 368.271 610.303 357.409 610.303ZM374.845 568.264C383.802 568.264 391.71 566.501 398.57 562.974C405.431 559.351 410.814 554.49 414.72 548.389C418.627 542.288 420.58 535.377 420.58 527.656V504.348C418.675 505.588 416.054 506.731 412.72 507.78C409.48 508.733 405.812 509.639 401.715 510.497C397.618 511.259 393.52 511.974 389.423 512.642C385.326 513.214 381.61 513.738 378.276 514.215C371.13 515.263 364.889 516.931 359.553 519.219C354.217 521.507 350.073 524.605 347.119 528.513C344.165 532.326 342.688 537.093 342.688 542.812C342.688 551.106 345.69 557.445 351.692 561.83C357.79 566.12 365.508 568.264 374.845 568.264Z" fill="white"/>
                        <path d="M244.824 606.156V313.315H183.225V497.485H180.652L54.31 313.315H0V606.156H61.8848V421.844H64.0286L191.371 606.156H244.824Z" fill="white"/>
                    </svg>
                    <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, letterSpacing: '0.5px' }}>
                        GUI-SMU
                    </h1>
                </div>
                <div style={{ display: 'flex', gap: '20px', fontSize: '14px' }}>
                    <span style={{ fontWeight: 'bold', borderBottom: '2px solid white', paddingBottom: '2px' }}>Homepage</span>
                    <span style={{ opacity: 0.7 }}>Driver</span>
                </div>
            </header>

            <div className="main-workspace">
                <div className="sidebar">
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
                        data={measurementData}
                        onCurrentUnitChange={handleCurrentUnitChange}
                        onVoltageUnitChange={handleVoltageUnitChange}
                        selectedCurrentUnit={currentUnit}
                        selectedVoltageUnit={voltageUnit}
                        onAxesChange={handleAxesChange}
                    />
                </div>
                
                <div className="chart-workspace">
                    <div className="chart-container">
                        <ScatterChart 
                            xScaleType={xScaleType}
                            yScaleType={yScaleType}
                            data={scaledMeasurementData}
                            xAxisDataKey={xAxisDataKey}
                            yAxisDataKey={yAxisDataKey}
                            selectedCurrentUnit={currentUnit}
                            selectedVoltageUnit={voltageUnit}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default App;