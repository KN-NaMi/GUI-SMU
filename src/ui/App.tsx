import Toolbar, { ChartAxisKey } from "./Toolbar";
import './App.css'
import ScatterChart, { ChartStats } from "./ScatterChart";
import ChartPanel, { ZoomMode } from "./ChartPanel";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import * as d3 from "d3";
import { scaleChartData, CurrentUnit, VoltageUnit } from './ScaleChartData';
import CameraWindow from "./CameraWindow";
import { IconSun, IconMoon } from '@tabler/icons-react';

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
        websocket: any;
        serialport: any;
        fileSystem: any;
        platform: any;
        camera: any;
    }
}

const App: React.FC = () => {
    const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

    const [xScaleType, setXScaleType] = useState<"linear" | "log">("linear");
    const [yScaleType, setYScaleType] = useState<"linear" | "log">("linear");
    const [currentUnit, setCurrentUnit] = useState<CurrentUnit>('A');
    const [voltageUnit, setVoltageUnit] = useState<VoltageUnit>('V');
    const [xAxisDataKey, setXAxisDataKey] = useState<ChartAxisKey>('current');
    const [yAxisDataKey, setYAxisDataKey] = useState<ChartAxisKey>('voltage');
    const [chartStats, setChartStats] = useState<ChartStats | null>(null);
    const [zoomMode, setZoomMode] = useState<ZoomMode>("none");
    const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const chartSvgRef = useRef<SVGSVGElement | null>(null);

    // Aktualizacja atrybutów body i Mantine podczas zmiany motywu
    useEffect(() => {
        const root = document.documentElement;
        if (isDarkMode) {
            root.classList.add('dark-theme');
            root.setAttribute('data-mantine-color-scheme', 'dark');
        } else {
            root.classList.remove('dark-theme');
            root.setAttribute('data-mantine-color-scheme', 'light');
        }
    }, [isDarkMode]);

    const handleZoomRefReady = useCallback(
        (zoom: d3.ZoomBehavior<SVGSVGElement, unknown>, svg: SVGSVGElement) => {
            zoomBehaviorRef.current = zoom;
            chartSvgRef.current = svg;
        },
        []
    );

    const handleCurrentUnitChange = (unit: CurrentUnit) => setCurrentUnit(unit);
    const handleVoltageUnitChange = (unit: VoltageUnit) => setVoltageUnit(unit);

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
        if (!window.websocket.isConnected()) return false;
        setIsMeasuring(true);
        window.websocket.send(JSON.stringify({
            command: 'start', port, iterations,
            delay: config?.delay, isBothWays: config?.isBothWays,
            repeats: config?.repeats, is4Wire: config?.is4Wire,
            isVoltSrc: config?.isVoltSrc ?? true,
            voltLimit: config?.voltLimit, currLimit: config?.currLimit,
            iMax: config?.iMax, iMin: config?.iMin, uMax: config?.uMax, uMin: config?.uMin,
        }));
        return true;
    }, []);

    const disconnect = useCallback(() => {
        if (window.websocket?.isConnected()) {
            setTimeout(() => {
                if (window.websocket?.isConnected()) {
                    window.websocket.disconnect();
                    setIsConnected(false);
                    setIsMeasuring(false);
                }
            }, 100);
        }
    }, []);

    const stopMeasurement = useCallback(() => {
        if (window.websocket?.isConnected()) {
            window.websocket.send(JSON.stringify({
                command: 'stop', port: null, iterations: null, delay: null,
                isBothWays: null, repeats: null, is4Wire: null, isVoltSrc: null,
                voltLimit: null, currLimit: null, iMax: null, iMin: null, uMax: null, uMin: null,
            }));
            disconnect();
        }
    }, [disconnect]);

    const handleWebSocketMessage = useCallback((data: string) => {
        if (typeof data === 'string' && (data === "Finished" || data.includes("Finished") || data.includes("finished"))) {
            setIsMeasuring(false); disconnect(); return;
        }
        try {
            const json = JSON.parse(data);
            if (json?.message === "Finished") { setIsMeasuring(false); disconnect(); return; }
            if (json && 'voltage' in json && 'current' in json && 'step' in json) {
                setMeasurementData(prev => [...prev, json as DataPoint]);
            }
        } catch (_) {}
    }, [disconnect, measurementData.length]);

    const scaledMeasurementData = useMemo(
        () => scaleChartData(measurementData, currentUnit, voltageUnit),
        [measurementData, currentUnit, voltageUnit]
    );

    useEffect(() => {
        if (window.websocket) window.websocket.onMessage(handleWebSocketMessage);
    }, [handleWebSocketMessage]);

    const [showCamera, setShowCamera] = useState(false);
    useEffect(() => {
        if (new URLSearchParams(window.location.search).get('window') === 'camera') setShowCamera(true);
    }, []);

    if (showCamera) return <CameraWindow />;

    return (
        <div className={`app-container ${isDarkMode ? 'dark-theme' : ''}`}>
            <header className="nami-topbar" style={{ display: 'flex', justifyContent: 'space-between', paddingRight: '20px' }}>
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
                    <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 600, letterSpacing: '0.5px' }}>GUI-SMU</h1>
                </div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <button 
                        onClick={() => setIsDarkMode(!isDarkMode)} 
                        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'white', display: 'flex' }}
                        title="Toggle Theme"
                    >
                        {isDarkMode ? <IconSun size={24} /> : <IconMoon size={24} />}
                    </button>
                </div>
            </header>

            <div className="main-workspace">
                <div className="sidebar">
                    <Toolbar
                        xScaleType={xScaleType} yScaleType={yScaleType}
                        setXScaleType={setXScaleType} setYScaleType={setYScaleType}
                        connect={connect} isConnected={isConnected}
                        setIsConnected={setIsConnected} isMeasuring={isMeasuring}
                        setIsMeasuring={setIsMeasuring} startMeasurement={startMeasurement}
                        stopMeasurement={stopMeasurement} data={measurementData}
                        onCurrentUnitChange={handleCurrentUnitChange}
                        onVoltageUnitChange={handleVoltageUnitChange}
                        selectedCurrentUnit={currentUnit} selectedVoltageUnit={voltageUnit}
                        onAxesChange={handleAxesChange}
                    />
                </div>

                <div className="chart-workspace">
                    <div className="chart-container">
                        <ScatterChart
                            xScaleType={xScaleType} yScaleType={yScaleType}
                            data={scaledMeasurementData}
                            xAxisDataKey={xAxisDataKey} yAxisDataKey={yAxisDataKey}
                            selectedCurrentUnit={currentUnit} selectedVoltageUnit={voltageUnit}
                            onStatsChange={setChartStats}
                            zoomMode={zoomMode}
                            onZoomRefReady={handleZoomRefReady}
                            isDarkMode={isDarkMode} 
                        />
                    </div>
                    <ChartPanel
                        stats={chartStats}
                        zoomMode={zoomMode}
                        onZoomModeChange={setZoomMode}
                        zoomBehaviorRef={zoomBehaviorRef}
                        svgRef={chartSvgRef}
                    />
                </div>
            </div>

            <footer className="nami-footer" style={{ background: isDarkMode ? '#252525' : '', color: isDarkMode ? '#e2e8f0' : '', borderColor: isDarkMode ? '#334155' : '' }}>
                <div className="status-indicator">
                    <span className="status-dot" style={{ backgroundColor: isConnected ? '#10B981' : '#E53935' }} />
                    {isConnected ? 'Connected' : 'Disconnected'}
                </div>
                <div className="measuring-info">
                    {isMeasuring ? `Measuring... Points: ${measurementData.length}` : `Data points: ${measurementData.length}`}
                </div>
            </footer>
        </div>
    );
};

export default App;