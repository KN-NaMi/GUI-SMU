import { useScale } from '../electron/useScale';
import './Toolbar.css'
import React, { useState, useCallback, useEffect } from "react";
import { DataPoint } from './ScatterChart';

interface ToolbarProps {
  xScaleType: "linear" | "log";
  yScaleType: "linear" | "log";
  setXScaleType: (type: "linear" | "log") => void;
  setYScaleType: (type: "linear" | "log") => void;
  connect: () => Promise<boolean>;
  isConnected: boolean;
  setIsConnected: (value: boolean) => void;
  isMeasuring: boolean;
  setIsMeasuring: (value: boolean) => void;
  startMeasurement: (iterations: number, port: string, config?: any) => boolean;
  stopMeasurement: () => void;
  disconnect?: () => void;
  data?: DataPoint[];
}

// Serial port interface
interface SerialPortInfo {
  path: string;
}

// Function to convert value based on selected unit
const convertValue = (value: string, elementId: string): number => {
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return 0;
  
  const selectElement = document.getElementById(elementId) as HTMLSelectElement;
  if (!selectElement) return numValue;
  
  const unit = selectElement.value;
  
  switch(unit) {
    case "μA":
    case "μV":
      return numValue * 0.000001;
    case "mA":
    case "mV":
      return numValue * 0.001;
    case "A":
    case "V":
      return numValue;
    case "kA":
    case "kV":
      return numValue * 1000;
    default:
      return numValue;
  }
};

// Function to extract port number from port path
const extractPortNumber = (portPath: string): string => {
  const match = portPath.match(/COM(\d+)/i);
  if (match && match[1]) {
    return match[1];
  }

  const usbMatch = portPath.match(/ttyUSB(\d+)/i);
  if (usbMatch && usbMatch[1]) {
    return usbMatch[1];
  }

  return portPath;
};

const Toolbar = ({
  xScaleType, 
  yScaleType, 
  setXScaleType, 
  setYScaleType,
  connect,
  isConnected,
  isMeasuring,
  startMeasurement,
  stopMeasurement,
  data = []
}: ToolbarProps) => {
  const scale = useScale();

  // Basic measurement configuration states
  const [sourceType, setSourceType] = useState<string>("voltage-src");
  const [measuredValueX, setMeasuredValueX] = useState<string>("I");
  const [measuredValueY, setMeasuredValueY] = useState<string>("U");
  const [iterations, setIterations] = useState<string>("");
  const [port, setPort] = useState<string>("");
  const [serialPorts, setSerialPorts] = useState<SerialPortInfo[]>([]);

   // Form field states for measurement parameters
  const [currentLimit, setCurrentLimit] = useState<string>("");
  const [voltageMax, setVoltageMax] = useState<string>(""); 
  const [voltageMin, setVoltageMin] = useState<string>("");
  const [voltageLimit, setVoltageLimit] = useState<string>("");
  const [currentMax, setCurrentMax] = useState<string>("");
  const [currentMin, setCurrentMin] = useState<string>("");

  // State for alerts/popups
  const [showAlert, setShowAlert] = useState<boolean>(false);
  const [alertMessage, setAlertMessage] = useState<string>("");

  // Load port list on initial component mount
  useEffect(() => {
    refreshSerialPorts()
  }, []);

  const handleChangeX = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setMeasuredValueX(newValue);
    setMeasuredValueY(newValue === "I" ? "U" : "I");
  }

  const handleChangeY = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setMeasuredValueY(newValue);
    setMeasuredValueX(newValue === "I" ? "U" : "I");
  }

  const handleIterationsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setIterations(e.target.value);
  };

  const handlePortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedPath = e.target.value;
    const portNum = extractPortNumber(selectedPath);
    setPort(portNum);
  };

  // Function to check if all values are valid (non-zero, non-negative)
  const checkValues = (isVoltSrc: boolean): boolean => {
    if (isVoltSrc) {
      const currLimit = convertValue(currentLimit, "current-limiter-units");
      const vMax = parseFloat(voltageMax);
      const vMin = parseFloat(voltageMin);
      
      return (
        currLimit > 0 && 
        !isNaN(vMax) && vMax > 0 && 
        !isNaN(vMin) && vMin >= 0 && 
        vMin < vMax
      );
    } else {
      const vLimit = convertValue(voltageLimit, "voltage-limiter-units");
      const iMax = parseFloat(currentMax);
      const iMin = parseFloat(currentMin);
      
      return (
        vLimit > 0 && 
        !isNaN(iMax) && iMax > 0 && 
        !isNaN(iMin) && iMin >= 0 && 
        iMin < iMax
      );
    }
  };

  // Validation check before sending to backend
  const checkData = (isVoltSrc: boolean): boolean => {
    if (!checkValues(isVoltSrc)) {
      showAlertMessage("Error. Missing data.");
      return false;
    }
    return true;
  };

  // Function to refresh the list of available serial ports
  const refreshSerialPorts = async () => {  
    try {
      const allPorts = await window.serialport.listPorts();
      const simplePorts = allPorts.map((port: { path: string }) => ({ path: port.path }));
      
      if (!simplePorts || simplePorts.length === 0) {
        console.log("No COM ports found");
        setSerialPorts([]);
        return;
      }
      
      console.log("Received ports:", simplePorts);
      setSerialPorts(simplePorts);
      
      // Automatycznie wybierz pierwszy port, jeśli żaden nie jest wybrany
      if (simplePorts.length > 0 && !port) {
        const portPath = simplePorts[0].path;
        const portNum = extractPortNumber(portPath);
        setPort(portNum);
      }
    } catch (error) {
      console.error("Error while fetching port list:", error);
      setSerialPorts([]);
    }
  };

  // Function for saving measurement data
  const handleSaveData = useCallback(async () => {
    if (!data || data.length === 0) {
      return;
    }

    try {
      await window.fileSystem.saveMeasurementData(data);
      
    } catch (error) {
      console.error('Error saving data:', error);
    }
  }, [data]);

  // Function to start measurement
  const handleStart = useCallback(async () => {
    if (isMeasuring) return;
    
    try {
      const isVoltSrc = sourceType === "voltage-src";
      
      if (!checkData(isVoltSrc)) {
        return;
      }
      
      if (!isConnected) {
        const connected = await connect();
        if (!connected) {
          return;
        }
      }

      const config = {
        isVoltSrc,
        iterations: parseInt(iterations),
        ...(isVoltSrc 
          ? {
              currLimit: convertValue(currentLimit, "current-limiter-units"),
              uMax: parseFloat(voltageMax),
              uMin: parseFloat(voltageMin)
            } 
          : {
              voltLimit: convertValue(voltageLimit, "voltage-limiter-units"),
              iMax: parseFloat(currentMax),
              iMin: parseFloat(currentMin)
            })
      };

      console.log("Measurement config with converted limits:", config);
      
      setTimeout(() => {
        startMeasurement(parseInt(iterations), port, config);
      }, 50);
    } catch (error) {
      console.error('Error connecting or starting measurement:', error);
    }
  }, [isMeasuring, isConnected, iterations, sourceType, currentLimit, voltageMax, voltageMin, voltageLimit, currentMax, currentMin, connect, startMeasurement, port]);
  
  // Function to stop measurement
  const handleStop = useCallback(() => {
    if (!isConnected) return;
    stopMeasurement();
  }, [isConnected, stopMeasurement]);

  // Function to display alert message
  const showAlertMessage = (message: string) => {
    setAlertMessage(message);
    setShowAlert(true);
    
    setTimeout(() => {
      setShowAlert(false);
    }, 2000);
  };

  return (
    <div className='toolbar' 
    style={{
      transform: `scale(${scale})`,
      width: `${100/scale}%`,
      height: `${100/175}%`,
    }}
    >
      <div className='first-column'>
        <div className='start-stop-buttons'>
          {/* start and stop buttons */}
          <button 
            className='start-btn'
            onClick={handleStart}
            disabled={isMeasuring}          
          >
            <img src="/play.png" alt="play-icon" />
          </button>

          <button 
            className='stop-btn'
            onClick={handleStop}
            disabled={!isConnected}
          >
            <img src="/stop.png" alt="stop-icon" />
          </button>

          </div>

          <div className='input-label-corelation'>
            <label htmlFor="current-voltage-src">Typ źródła</label>
            <select 
              id="current-voltage-src"
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
            >
              <option value="voltage-src">Źródło napięciowe</option>
              <option value="current-src">Źródło prądowe</option>
            </select>
          </div>
        </div>

        {/* Alert */}
        {showAlert && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: 'white',
            padding: '15px',
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center'
          }}>
            <p style={{ 
              margin: 0, 
              fontWeight: 'bold', 
              fontSize: '20px',
              textShadow: '0 1px 2px rgba(0,0,0,0.8)'
            }}>
              {alertMessage}
            </p>
          </div>
        )}

        <div className='input-container'>
          {sourceType === "voltage-src" && (
            <>
              {/* Voltage source options*/}
              <div className='input-label-corelation nw'>
                <label htmlFor="current-limiter">Ograniczenie prądowe</label>
                <div>
                  <input
                    type="text" 
                    id='current-limiter' 
                    value={currentLimit}
                    onChange={(e) => setCurrentLimit(e.target.value)}
                  />
                  <select name="units" id="current-limiter-units">
                    <option value="μA">μA</option>
                    <option value="mA">mA</option>
                    <option value="A">A</option>
                    <option value="kA">kA</option>
                  </select>
                </div>
              </div>

              <div className='input-label-corelation ne'>
                <label htmlFor="U-max">U_max</label>
                <input 
                  type="text" 
                  id='U-max'
                  value={voltageMax}
                  onChange={(e) => setVoltageMax(e.target.value)}
                />
              </div>
              
              <div className='input-label-corelation se'>
                <label htmlFor="U-min">U_min</label>
                <input 
                  type="text"
                  id='U-min'
                  value={voltageMin}
                  onChange={(e) => setVoltageMin(e.target.value)}
                />
              </div>
            </>
          )}
          {sourceType === "current-src" && (
            <>
              {/* Current source options */}
              <div className='input-label-corelation nw'>
                <label htmlFor="voltage-limiter">Ograniczenie napięciowe</label>
                <div>
                  <input 
                    type="text" 
                    id='voltage-limiter' 
                    value={voltageLimit}
                    onChange={(e) => setVoltageLimit(e.target.value)}
                  />
                  <select name="units" id="voltage-limiter-units">
                    <option value="μV">μV</option>
                    <option value="mV">mV</option>
                    <option value="V">V</option>
                    <option value="kV">kV</option>
                  </select>
                </div>
              </div>

              <div className='input-label-corelation ne'>
                <label htmlFor="I-max">I_max</label>
                <input
                  type="text"
                  id='I-max'
                  value={currentMax}
                  onChange={(e) => setCurrentMax(e.target.value)}
                />
              </div>

              <div className='input-label-corelation se'>
                <label htmlFor="I-min">I_min</label>
                <input 
                  type="text" 
                  id='I-min'
                  value={currentMin}
                  onChange={(e) => setCurrentMin(e.target.value)}
                />
              </div>
            </>
          )}
              <div className='input-label-corelation sw'>
                <label htmlFor="how-many-measurements">Ilość punktów pomiarowych</label>
                <input 
                  type="text" 
                  id='how-many-measurements'
                  value={iterations}
                  onChange={handleIterationsChange}
                />
              </div>
          
        </div>

        {/* Presets */}
        <fieldset className='presets'>
          <legend>Presety</legend>
          <button 
            className='save-preset-btn' 
            onClick={handleSaveData}
            disabled={!data || data.length === 0}
          >
            Save data
          </button>
          <div className='input-label-corelation'>
            <label htmlFor="choose-presets">COM</label>
            <button 
              className='load-preset-btn'
              onClick={refreshSerialPorts}
            >
              Refresh Ports
            </button>
            <select 
              name="choose-presets"
              id="choose-presets"
              value={serialPorts.find(p => extractPortNumber(p.path) === port)?.path || ''}
              onChange={handlePortChange}
            >
              {serialPorts.length > 0 ? (
                serialPorts.map((portInfo, index) => (
                  <option key={index} value={portInfo.path}>
                    {portInfo.path}
                  </option>
                ))
              ) : (
                <option value="">No available ports</option>
              )}
            </select>
          </div>
        </fieldset>

      {/* Graph options */}
      <fieldset className='graph-options'>
        <legend>Wykres</legend>
        <div className='graph-options-div'>
          {/* X Axis */}
          <fieldset className='x-axis'>
            <legend>Oś X</legend>
            <div className='x-axis-options'>
              <div className='input-label-corelation'>
                <label htmlFor="axis-type">Typ osi</label>
                <select 
                name="axis-type" 
                id="x-type-select"
                value={xScaleType}
                onChange={(e) => setXScaleType(e.target.value as "linear" | "log")}
                >
                  <option value="linear">Liniowa</option>
                  <option value="log">Logarytmiczna</option>
                </select>
              </div>
              <div className='input-label-corelation'>
                <label htmlFor="i-u-select">Wielkość mierzona</label>
                <select name="i-u-select"
                value={measuredValueX} 
                onChange={handleChangeX}>
                  <option value="I">I</option>
                  <option value="U">U</option>
                </select>
              </div>
              <div></div>
              {measuredValueX === "I" && (
              <>
                <select name="axis-unit">
                <option value="μA">μA</option>
                      <option value="mA">mA</option>
                      <option value="A">A</option>
                      <option value="kA">kA</option>
                </select>
              </>
              )}
              {measuredValueX === "U" && (
              <>
                <select name="axis-unit">
                <option value="μV">μV</option>
                      <option value="mV">mV</option>
                      <option value="V">V</option>
                      <option value="kV">kV</option>
                </select>
              </>
              )}
            </div>
          </fieldset>
          {/* Y Axis  */}
          <fieldset className='y-axis'>
            <legend>Oś Y</legend>
            <div className='y-axis-options'>
              <div className='input-label-corelation'>
                <label htmlFor="axis-type">Typ osi</label>
                <select 
                name="axis-type" 
                id="y-type-select"
                value={yScaleType}
                onChange={(e) => setYScaleType(e.target.value as "linear" | "log")}
                >
                  <option value="linear">Liniowa</option>
                  <option value="log">Logarytmiczna</option>
                </select>
              </div>
              <div className='input-label-corelation'>
                <label htmlFor="">Wielkość mierzona</label>
                <select name="i-u-select" 
                value={measuredValueY} 
                onChange={handleChangeY}>
                  <option value="I">I</option>
                  <option value="U">U</option>
                </select>
              </div>
              <div></div>
              {measuredValueY === "U" && (
                <>
                  <select name="axis-unit">
                  <option value="μV">μV</option>
                        <option value="mV">mV</option>
                        <option value="V">V</option>
                        <option value="kV">kV</option>
                  </select>
                </>
              )}
              {measuredValueY === "I" && (
                <>
                  <select name="axis-unit">
                  <option value="μA">μA</option>
                        <option value="mA">mA</option>
                        <option value="A">A</option>
                        <option value="kA">kA</option>
                  </select>
                </>
              )}
            </div>
          </fieldset>
          {/* Options */}
          <fieldset className='axes-options'>
            <legend>Opcje</legend>
            <div className='axes-options-div'>
              <input type="text" id='series-name' placeholder='Nazwa serii'/>
              <button className='new-series-btn'>Nowa Seria</button>
              <button className='delete-series-btn'>Usuń Serię</button>
            </div>
          </fieldset>
          <fieldset className='series'>
            <legend>Serie</legend>
            <div className='input-label-corelation' style={{ marginTop: '5px' }}>
            </div>
          </fieldset>
        </div>
      </fieldset>
    </div>
  );
};

export default Toolbar;
