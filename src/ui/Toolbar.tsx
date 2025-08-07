import { useScale } from '../electron/useScale';
import './Toolbar.css'
import { useState, useCallback, useEffect } from "react";
import { flushSync } from 'react-dom';
import { DataPoint } from './ScatterChart';
import { CurrentUnit, VoltageUnit } from './ScaleChartData'
import { Button, Select, NumberInput, Menu, Checkbox, Tabs, TextInput } from '@mantine/core';
import { IconPlayerPlayFilled, IconPlayerStopFilled, IconDeviceFloppy, IconRefresh, IconSettings, IconCamera } from '@tabler/icons-react';

export type ChartAxisKey = 'current' | 'voltage' | 'step';

interface ToolbarProps {
  xScaleType: "linear" | "log";
  yScaleType: "linear" | "log";
  setXScaleType: (type: "linear" | "log") => void;
  setYScaleType: (type: "linear" | "log") => void;
  onCurrentUnitChange: (unit: CurrentUnit) => void;
  onVoltageUnitChange: (unit: VoltageUnit) => void;
  selectedCurrentUnit: CurrentUnit;
  selectedVoltageUnit: VoltageUnit;
  onAxesChange: (xAxisKey: ChartAxisKey, yAxisKey: ChartAxisKey) => void;
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
    case "nA": 
    case "nV":
      return numValue / 1000000000;;
    case "uA":
    case "uV":
      return numValue / 1000000;
    case "mA":
    case "mV":
      return numValue / 1000;
    case "A":
    case "V":
      return numValue;
    default:
      return 0;
    
  }
};

// Function to extract port number from port path
const extractPortNumber = (portPath: string): string => {
  const match = portPath.match(/COM(\d+)/i);
  if (match && match[1]) {
    return match[1];
  }

  // Linux:
  if (portPath.startsWith('/dev/')) {
    return portPath;
  }

  return portPath;
};

const Toolbar = ({
  xScaleType, 
  yScaleType, 
  setXScaleType, 
  setYScaleType,
  onCurrentUnitChange,
  onVoltageUnitChange,
  selectedCurrentUnit,
  selectedVoltageUnit,
  onAxesChange,
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
  const [measuredValueX, setMeasuredValueX] = useState<"I" | "U">("U");
  const [measuredValueY, setMeasuredValueY] = useState<"I" | "U">("I");
  const [iterations, setIterations] = useState<string>("");
  const [bothWays, setBothWays] = useState<boolean>(false);
  const [fourWire, setFourWire] = useState<boolean>(false);
  const [delay, setDelay] = useState<string>("");
  const [port, setPort] = useState<string>("");
  const [serialPorts, setSerialPorts] = useState<SerialPortInfo[]>([]);
  

   // Form field states for measurement parameters
  const [currentLimit, setCurrentLimit] = useState<string>("");
  const [voltageMax, setVoltageMax] = useState<string>(""); 
  const [voltageMin, setVoltageMin] = useState<string>("");
  const [voltageLimit, setVoltageLimit] = useState<string>("");
  const [currentMax, setCurrentMax] = useState<string>("");
  const [currentMin, setCurrentMin] = useState<string>("");

  const [uMinSafety, setUminSafety] = useState<string>("");
  const [uMaxSafety, setUmaxSafety] = useState<string>("");
  const [iMinSafety, setIminSafety] = useState<string>("");
  const [iMaxSafety, setImaxSafety] = useState<string>("");


  // State for alerts/popups
  const [showAlert, setShowAlert] = useState<boolean>(false);
  const [alertMessage, setAlertMessage] = useState<string>("");

  // Load port list on initial component mount
  useEffect(() => {
    refreshSerialPorts();
    onAxesChange(mapIUToDataKey(measuredValueX), mapIUToDataKey(measuredValueY));
  }, []);

  const mapIUToDataKey = (value: "I" | "U"): ChartAxisKey => {
    return value === "I" ? "current" : "voltage";
  };

  const handleChangeX = (value: string | null) => {
    if (!value) return;
    const newValue = value as "I" | "U";
    const newYValue = newValue === "I" ? "U" : "I";
    setMeasuredValueX(newValue);
    setMeasuredValueY(newYValue);
    onAxesChange(mapIUToDataKey(newValue), mapIUToDataKey(newYValue));
  };

  const handleChangeY = (value: string | null) => {
    if (!value) return;
    const newValue = value as "I" | "U";
    const newXValue = newValue === "I" ? "U" : "I";
    setMeasuredValueY(newValue);
    setMeasuredValueX(newXValue);
    onAxesChange(mapIUToDataKey(newXValue), mapIUToDataKey(newValue));
  };

  const handleCurrentChange = (value: string | null) => {
    if (!value) return;
    onCurrentUnitChange(value as CurrentUnit);
  };

  const handleVoltageChange = (value: string | null) => {
    if (!value) return;
    onVoltageUnitChange(value as VoltageUnit);
  };

  const handlePortChange = (selectedPath: string | null) => {
    if (!selectedPath) return;
    const portNum = extractPortNumber(selectedPath);
    setPort(portNum);
  };

  // Function to check if all values are valid (non-zero, non-negative)
  const checkValues = (isVoltSrc: boolean): boolean => {
    flushSync(() => {});

    const iterationsValue = parseInt(iterations);
    if (isNaN(iterationsValue) || iterations.trim() === "") {
      return false;
    }

    if (isVoltSrc) {
      const currLimit = convertValue(currentLimit, "current-limiter-units");
      const vMax = parseFloat(voltageMax);
      const vMin = parseFloat(voltageMin);

      const zabMinValue = parseFloat(uMinSafety);
      const zabMaxValue = parseFloat(uMaxSafety);
      const isUminSafetyEmpty = uMinSafety.trim() === "";
      const isUmaxSafetyEmpty = uMaxSafety.trim() === "";

      if (isUminSafetyEmpty && isUmaxSafetyEmpty) {
      }
      else if (!isUminSafetyEmpty && isUmaxSafetyEmpty) {
        if (!isNaN(zabMinValue) && !isNaN(vMin)) {
          if (vMin < zabMinValue) { 
            return false;
          }
        }
      }
      else if (isUminSafetyEmpty && !isUmaxSafetyEmpty) {
        if (!isNaN(zabMaxValue) && !isNaN(vMax)) {
          if (vMax > zabMaxValue) { 
            return false;
          }
        }
      }
      else if (!isUminSafetyEmpty && !isUmaxSafetyEmpty) {
        if (!isNaN(zabMinValue) && !isNaN(vMin)) {
          if (vMin < zabMinValue) { 
            return false;
          }
        }
        if (!isNaN(zabMaxValue) && !isNaN(vMax)) {
          if (vMax > zabMaxValue) { 
            return false;
          }
        }
      }
      
      return (
        currLimit !== 0 && 
        !isNaN(vMax) && voltageMax.trim() !== "" && 
        !isNaN(vMin) && voltageMin.trim() !== ""
      );
    } else {
      const vLimit = convertValue(voltageLimit, "voltage-limiter-units");
      const iMax = parseFloat(currentMax);
      const iMin = parseFloat(currentMin);

      const zabMinValue = parseFloat(iMinSafety);
      const zabMaxValue = parseFloat(iMaxSafety);
      const isUminSafetyEmpty = uMinSafety.trim() === "";
      const isUmaxSafetyEmpty = uMaxSafety.trim() === "";

      if (isUminSafetyEmpty && isUmaxSafetyEmpty) {
      }
      else if (!isUminSafetyEmpty && isUmaxSafetyEmpty) {
        if (!isNaN(zabMinValue) && !isNaN(iMin)) {
          if (iMin < zabMinValue) {
            return false;
          }
        }
      }
      else if (isUminSafetyEmpty && !isUmaxSafetyEmpty) {
        if (!isNaN(zabMaxValue) && !isNaN(iMax)) {
          if (iMax > zabMaxValue) {
            return false;
          }
        }
      }
      else if (!isUminSafetyEmpty && !isUmaxSafetyEmpty) {
        if (!isNaN(zabMinValue) && !isNaN(iMin)) {
          if (iMin < zabMinValue) {
            return false;
          }
        }
        if (!isNaN(zabMaxValue) && !isNaN(iMax)) {
          if (iMax > zabMaxValue) {
            return false;
          }
        }
      }
      
      return (
        vLimit !== 0 && 
        !isNaN(iMax) && currentMax.trim() !== "" && 
        !isNaN(iMin) && currentMin.trim() !== ""
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

      console.log("window.platform:", window.platform);
      console.log("formatPortDisplay function:", window.platform?.formatPortDisplay);
      
      if (simplePorts.length > 0) {
        const testPath = simplePorts[0].path;
        console.log("Test format:", window.platform?.formatPortDisplay?.(testPath));
      }
      
      if (!simplePorts || simplePorts.length === 0) {
        console.log("No COM ports found");
        setSerialPorts([]);
        return;
      }
      
      console.log("Received ports:", simplePorts);
      setSerialPorts(simplePorts);
      
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
        delay: delay && delay.trim() !== "" ? parseFloat(delay) : undefined,
        isBothWays: bothWays ? true : undefined,
        is4Wire: fourWire ? true : undefined,
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
  }, [isMeasuring, isConnected, iterations, delay, bothWays, fourWire, sourceType, currentLimit, voltageMax, voltageMin, voltageLimit, currentMax, currentMin, connect, startMeasurement, port]);
  
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
      <div className='first-column' style={{ minWidth: '150px' }}>
        <div className='start-stop-buttons' style={{ gap: '5px' }}>
          {/* start and stop buttons */}
          <Button 
            onClick={handleStart}
            disabled={isMeasuring}
            variant="filled"
            color="green"
            size="md"
            style={{ 
              width: '40px', 
              height: '40px', 
              padding: 0,
              borderRadius: '8px'
            }}
          >
            <IconPlayerPlayFilled size={18} />
          </Button>

          <Button
            onClick={handleStop}
            // disabled={!isConnected}
            variant="filled"
            color="red"
            size="md"
            style={{ 
              width: '40px', 
              height: '40px', 
              padding: 0,
              borderRadius: '8px'
            }}
          >
            <IconPlayerStopFilled size={18} />
          </Button>
        </div>

        {/* Source type select */}
        <div className='input-label-corelation'>
          <Select 
            label="Source type:"
            value={sourceType}
            onChange={(value) => setSourceType(value || "voltage-src")}
            data={[
              { value: 'voltage-src', label: 'Voltage source' },
              { value: 'current-src', label: 'Current source' }
            ]}
            size="sm"
            style={{ width: '145px' }}
          />
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

      {/* Measurement options */}
      <div className='input-container' style={{ display: 'block', width: '100%' }}>
        {sourceType === "voltage-src" && (
          <>
            {/* Measurement options */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '15px', width: '100%' }}>
              <NumberInput
                label="U_min"
                placeholder="V"
                value={voltageMin}
                onChange={(value) => setVoltageMin(value?.toString() || "")}
                size="sm"
                hideControls
                clampBehavior="none"
                allowLeadingZeros={true}
                trimLeadingZeroesOnBlur={false}
              />
              
              <NumberInput
                label="U_max"
                placeholder="V"
                value={voltageMax}
                onChange={(value) => setVoltageMax(value?.toString() || "")}
                size="sm"
                hideControls
                clampBehavior="none"
                allowLeadingZeros={true}
                trimLeadingZeroesOnBlur={false}
              />

              <NumberInput
                label="Iterations:"
                value={iterations}
                onChange={(value) => setIterations(value?.toString() || "")}
                min={1}
                size="sm"
                hideControls
              />
            </div> 

            {/* Measurements settings*/}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '8px', width: '100%' }}>
              <div style={{ display: 'flex', gap: '5px', alignItems: 'end' }}>
                <NumberInput
                  label="Current limit"
                  value={currentLimit}
                  onChange={(value) => setCurrentLimit(value?.toString() || "")}
                  size="sm"
                  style={{ width: '120px' }}
                  hideControls
                  clampBehavior="none"
                />
                <Select
                  id="current-limiter-units"
                  data={[
                    { value: 'uA', label: 'μA' },
                    { value: 'mA', label: 'mA' },
                    { value: 'A',  label: 'A' },
                  ]}
                  size="sm"
                  style={{ width: '75px' }}
                  defaultValue="mA"
                  styles={{
                    input: { width: '100%', minWidth: '10px' },
                    root: { width: '10px' }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  style={{ 
                    width: '35px', 
                    height: '35px', 
                    padding: 0,
                    borderRadius: '6px',
                    marginLeft: '35px'
                  }}
                  onClick={async () => {
                    try {
                        await window.camera.openWindow();
                        console.log("Camera window opened");
                      } catch (error) {
                        console.error("Error opening camera window:", error);
                      }
                    }}
                >
                  <IconCamera size={16} />
                </Button>
              </div>
            </div>
          </>
        )}

        {sourceType === "current-src" && (
          <>
            {/* Measurement options */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '15px', width: '100%' }}>
              
              <NumberInput
                label="I_min"
                placeholder="A"
                value={currentMin}
                onChange={(value) => setCurrentMin(value?.toString() || "")}
                size="sm"
                hideControls
                clampBehavior="none"
                allowLeadingZeros={true}
                trimLeadingZeroesOnBlur={false}
              />
              
              <NumberInput
                label="I_max"
                placeholder="A"
                value={currentMax}
                onChange={(value) => setCurrentMax(value?.toString() || "")}
                size="sm"
                hideControls
                clampBehavior="none"
                allowLeadingZeros={true}
                trimLeadingZeroesOnBlur={false}
              />

              <NumberInput
                label="Iterations:"
                value={iterations}
                onChange={(value) => setIterations(value?.toString() || "")}
                min={1}
                size="sm"
                hideControls
              />
            </div> 

            {/* Measurements settings*/}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '8px', width: '100%' }}>
              <div style={{ display: 'flex', gap: '5px', alignItems: 'end' }}>
                <NumberInput
                  label="Voltage limit"
                  value={voltageLimit}
                  onChange={(value) => setVoltageLimit(value?.toString() || "")}
                  size="sm"
                  style={{ width: '120px' }}
                  hideControls
                  clampBehavior="none"
                />
                <Select
                  id="voltage-limiter-units"
                  data={[
                    { value: 'uV', label: 'μV' },
                    { value: 'mV', label: 'mV' },
                    { value: 'V', label: 'V' },
                  ]}
                  size="sm"
                  style={{ width: '75px' }}
                  defaultValue="mV"
                  styles={{
                    input: { width: '100%', minWidth: '10px' },
                    root: { width: '10px' }
                  }}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Save data and ports*/}
      <div style={{ marginBottom: '15px', marginTop: '23px' }}>
        <Button 
          onClick={handleSaveData}
          // disabled={!data || data.length === 0}
          variant="filled"
          size="sm"
          rightSection={<IconDeviceFloppy size={16} />}
          style={{
            height: '35px',
            borderRadius: '8px',
            marginBottom: '10px',
            width: '100%'
          }}
        >
          Save data
        </Button>

        <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
          <Select
            data={serialPorts.map(port => ({ value: port.path, label: port.path }))}
            value={serialPorts.find(p => extractPortNumber(p.path) === port)?.path || null}
            onChange={handlePortChange}
            placeholder="No available ports"
            size="xs"
            style={{ flex: 1, minWidth: '100px' }}
          />

          <Button 
            onClick={refreshSerialPorts}
            variant="outline"
            size="xs"
            style={{ padding: '0 10px', height: '30px' }}
          >
            <IconRefresh size={12} />
          </Button>
        </div>

        <Menu shadow="md" width={200}>
          <Menu.Target>
            <Button 
              variant="outline" 
              size="xs"
              style={{ width: '100%', marginTop: '8px' }}
              rightSection={<IconSettings size={15} />}
            >
              Others
            </Button>
          </Menu.Target>

          <Menu.Dropdown>
            <div style={{ padding: '10px' }}>

              <Checkbox
                checked={fourWire}
                onChange={(e) => setFourWire(e.currentTarget.checked)}
                label="4Wire"
                size="xs"
                style={{ marginBottom: '5px' }}
              />

              <Checkbox
                checked={bothWays}
                onChange={(e) => setBothWays(e.currentTarget.checked)}
                label="Both ways"
                size="xs"
                style={{ marginBottom: '5px' }}
              />
              
              <div style={{ marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', color: 'black', minWidth: '40px' }}>
                  {sourceType === "voltage-src" ? "U_safety [V]:" : "I_safety [A]:"}
                </span>

                <div style={{ display: 'flex', gap: '5px' }}>
                  <NumberInput
                    placeholder="from:"
                    value={sourceType === "voltage-src" ? uMinSafety : iMinSafety}
                    onChange={(value) => sourceType === "voltage-src" ? setUminSafety(value?.toString() || "") : setIminSafety(value?.toString() || "")}
                    size="xs"
                    hideControls
                    style={{ flex: 1 }}
                  />

                  <NumberInput
                    placeholder="to:"
                    value={sourceType === "voltage-src" ? uMaxSafety : iMaxSafety}
                    onChange={(value) => sourceType === "voltage-src" ? setUmaxSafety(value?.toString() || "") : setImaxSafety(value?.toString() || "")}
                    size="xs"
                    hideControls
                    style={{ flex: 1 }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '3px', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '12px', color: 'black', minWidth: '40px' }}>Delay:</span>
                
                <NumberInput
                  placeholder="ms"
                  value={delay}
                  onChange={(value) => setDelay(value?.toString() || "")}
                  size="xs"
                  hideControls
                  style={{ flex: 1 }}
                />
                
              </div>
            </div>
          </Menu.Dropdown>
        </Menu>
      </div>
      
      {/* Graph options */}
      <Tabs defaultValue="axes" style={{ marginTop: '0px' }}>
        <Tabs.List>
          <Tabs.Tab 
            value="axes"
            style={{ color: 'white' }}
          >
            Axis Settings
          </Tabs.Tab>
          <Tabs.Tab 
            value="series"
            style={{ color: 'white' }}
          >
            Plot Series
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="axes" pt="xs">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2px 1fr', gap: '8px', maxWidth: '700px' }}>
            {/* Axis X */}
            <div>
              <h4 style={{ color: 'white', margin: '0 0 8px 0', fontSize: '12px' }}>Axis X:</h4>

              <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                <Select
                  value={xScaleType}
                  onChange={(value) => setXScaleType(value as "linear" | "log")}
                  data={[
                    { value: 'linear', label: 'Linear' },
                    { value: 'log', label: 'Logarithmic' }
                  ]}
                  size="xs"
                  style={{ width: '150px' }}
                />

                <Menu shadow="md" width={200}>
                  <Menu.Target>
                    <Button 
                      variant="outline" 
                      size="xs"
                      style={{ width: '150px' }}
                    >
                      Range
                    </Button>
                  </Menu.Target>

                  <Menu.Dropdown>
                    <div style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '12px', color: 'black', minWidth: '30px' }}>From:</span>
                        <NumberInput
                          placeholder="0"
                          size="xs"
                          hideControls
                          style={{ flex: 1 }}
                        />
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '15px' }}>
                        <span style={{ fontSize: '12px', color: 'black', minWidth: '30px' }}>To:</span>
                        <NumberInput
                          placeholder="100"
                          size="xs"
                          hideControls
                          style={{ flex: 1 }}
                        />
                      </div>
                      
                      <Button 
                        variant="filled" 
                        size="xs" 
                        style={{ width: '100%' }}
                      >
                        Apply
                      </Button>
                    </div>
                  </Menu.Dropdown>
                </Menu>
              </div>

              <div style={{ display: 'flex', gap: '4px' }}>
                <Select
                  value={measuredValueX}
                  onChange={handleChangeX}
                  data={[
                    { value: 'U', label: 'U' },
                    { value: 'I', label: 'I' }
                  ]}
                  size="xs"
                  style={{ width: '150px' }}
                />
                
                {measuredValueX === "I" && (
                  <Select
                    value={selectedCurrentUnit}
                    onChange={handleCurrentChange}
                    data={[
                      { value: 'nA', label: 'nA' },
                      { value: 'uA', label: 'μA' },
                      { value: 'mA', label: 'mA' },
                      { value: 'A', label: 'A' },
                    ]}
                    size="xs"
                    style={{ width: '150px' }}
                  />
                )}
                
                {measuredValueX === "U" && (
                  <Select
                    value={selectedVoltageUnit}
                    onChange={handleVoltageChange}
                    data={[
                      { value: 'nV', label: 'nV' },
                      { value: 'uV', label: 'μV' },
                      { value: 'mV', label: 'mV' },
                      { value: 'V', label: 'V' },
                    ]}
                    size="xs"
                    style={{ width: '150px' }}
                  />
                )}
              </div>
            </div>

            {/* Separator */}
            <div style={{ backgroundColor: 'rgba(255,255,255,0.3)', width: '2px' }}></div>

            {/* Axis Y */}
            <div>
              <h4 style={{ color: 'white', margin: '0 0 8px 0', fontSize: '12px' }}>Axis Y:</h4>
              
              <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                <Select
                  value={yScaleType}
                  onChange={(value) => setYScaleType(value as "linear" | "log")}
                  data={[
                    { value: 'linear', label: 'Linear' },
                    { value: 'log', label: 'Logarithmic' }
                  ]}
                  size="xs"
                  style={{ width: '150px' }}
                />

                <Menu shadow="md" width={200}>
                  <Menu.Target>
                    <Button 
                      variant="outline" 
                      size="xs"
                      style={{ width: '150px' }}
                    >
                      Range
                    </Button>
                  </Menu.Target>

                  <Menu.Dropdown>
                    <div style={{ padding: '10px' }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                        <span style={{ fontSize: '12px', color: 'black', minWidth: '30px' }}>From:</span>
                        <NumberInput
                          placeholder="0"
                          size="xs"
                          hideControls
                          style={{ flex: 1 }}
                        />
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '15px' }}>
                        <span style={{ fontSize: '12px', color: 'black', minWidth: '30px' }}>To:</span>
                        <NumberInput
                          placeholder="100"
                          size="xs"
                          hideControls
                          style={{ flex: 1 }}
                        />
                      </div>
                      
                      <Button 
                        variant="filled" 
                        size="xs" 
                        style={{ width: '100%' }}
                      >
                        Apply
                      </Button>
                    </div>
                  </Menu.Dropdown>
                </Menu>
              </div>

              <div style={{ display: 'flex', gap: '4px' }}>
                <Select
                  value={measuredValueY}
                  onChange={handleChangeY}
                  data={[
                    { value: 'U', label: 'U' },
                    { value: 'I', label: 'I' }
                  ]}
                  size="xs"
                  style={{ width: '150px' }}
                />

                {measuredValueY === "U" && (
                  <Select
                    value={selectedVoltageUnit}
                    onChange={handleVoltageChange}
                    data={[
                      { value: 'nV', label: 'nV' },
                      { value: 'uV', label: 'μV' },
                      { value: 'mV', label: 'mV' },
                      { value: 'V', label: 'V' },
                    ]}
                    size="xs"
                    style={{ width: '150px' }}
                  />
                )}
                
                {measuredValueY === "I" && (
                  <Select
                    value={selectedCurrentUnit}
                    onChange={handleCurrentChange}
                    data={[
                      { value: 'nA', label: 'nA' },
                      { value: 'uA', label: 'μA' },
                      { value: 'mA', label: 'mA' },
                      { value: 'A', label: 'A' },
                    ]}
                    size="xs"
                    style={{ width: '150px' }}
                  />
                )}
              </div>
            </div>
          </div>
        </Tabs.Panel>

        <Tabs.Panel value="series" pt="xs">
          <div style={{ maxWidth: '300px' }}>
            <TextInput
              label="Series name"
              placeholder="Enter series name"
              size="xs"
              style={{ marginBottom: '10px' }}
            />
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="outline" size="xs" style={{ flex: 1 }}>
                New Series
              </Button>
              <Button variant="outline" color="red" size="xs" style={{ flex: 1 }}>
                Delete Series
              </Button>
            </div>
          </div>
        </Tabs.Panel>
      </Tabs>
    </div>
  );
};

export default Toolbar;