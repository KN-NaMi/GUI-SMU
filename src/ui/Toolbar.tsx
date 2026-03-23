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

interface SerialPortInfo {
  path: string;
}

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

const extractPortNumber = (portPath: string): string => {
  const match = portPath.match(/COM(\d+)/i);
  if (match && match[1]) {
    return match[1];
  }

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

  const [sourceType, setSourceType] = useState<string>("voltage-src");
  const [measuredValueX, setMeasuredValueX] = useState<"I" | "U">("U");
  const [measuredValueY, setMeasuredValueY] = useState<"I" | "U">("I");
  const [iterations, setIterations] = useState<string>("");
  const [bothWays, setBothWays] = useState<boolean>(false);
  const [repeats, setRepeats] = useState<string>("");
  const [fourWire, setFourWire] = useState<boolean>(false);
  const [delay, setDelay] = useState<string>("");
  const [port, setPort] = useState<string>("");
  const [serialPorts, setSerialPorts] = useState<SerialPortInfo[]>([]);
  
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

  const [showAlert, setShowAlert] = useState<boolean>(false);
  const [alertMessage, setAlertMessage] = useState<string>("");

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

  const checkData = (isVoltSrc: boolean): boolean => {
    if (!checkValues(isVoltSrc)) {
      showAlertMessage("Error. Missing data.");
      return false;
    }
    return true;
  };

  const refreshSerialPorts = async () => {  
    try {
      const allPorts = await window.serialport.listPorts();
      const simplePorts = allPorts.map((port: { path: string }) => ({ path: port.path }));

      if (simplePorts.length > 0) {
        const testPath = simplePorts[0].path;
      }
      
      if (!simplePorts || simplePorts.length === 0) {
        setSerialPorts([]);
        return;
      }
      
      setSerialPorts(simplePorts);
      
      if (simplePorts.length > 0 && !port) {
        const portPath = simplePorts[0].path;
        const portNum = extractPortNumber(portPath);
        setPort(portNum);
      }
    } catch (error) {
      setSerialPorts([]);
    }
  };

  const handleSaveData = useCallback(async () => {
    if (!data || data.length === 0) {
      return;
    }

    try {
      await window.fileSystem.saveMeasurementData(data);
    } catch (error) {
    }
  }, [data]);

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
        repeats: repeats && repeats.trim() !== "" ? parseInt(repeats) : undefined,
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

      setTimeout(() => {
        startMeasurement(parseInt(iterations), port, config);
      }, 50);
    } catch (error) {
    }
  }, [isMeasuring, isConnected, iterations, delay, bothWays, repeats, fourWire, sourceType, currentLimit, voltageMax, voltageMin, voltageLimit, currentMax, currentMin, connect, startMeasurement, port]);
  
  const handleStop = useCallback(() => {
    if (!isConnected) return;
    stopMeasurement();
  }, [isConnected, stopMeasurement]);

  const showAlertMessage = (message: string) => {
    setAlertMessage(message);
    setShowAlert(true);
    
    setTimeout(() => {
      setShowAlert(false);
    }, 2000);
  };

  return (
    <>
      {showAlert && (
        <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)', color: 'white', padding: '15px',
            zIndex: 9999, display: 'flex', justifyContent: 'center', alignItems: 'center'
          }}>
          <p style={{ margin: 0, fontWeight: 'bold', fontSize: '20px' }}>{alertMessage}</p>
        </div>
      )}

      <div className="nami-card">
        <div className="nami-card-header">Connection Settings</div>
        <div className="nami-card-content">
          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
            <Select
              data={serialPorts.map(port => ({ value: port.path, label: port.path }))}
              value={serialPorts.find(p => extractPortNumber(p.path) === port)?.path || null}
              onChange={handlePortChange}
              placeholder="COM Port"
              size="sm"
              style={{ flex: 1 }}
            />
            <Button onClick={refreshSerialPorts} variant="outline" size="sm" style={{ padding: '0 10px' }} color="gray">
              <IconRefresh size={16} />
            </Button>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '5px' }}>
            <Button 
              onClick={handleStart} disabled={isMeasuring} variant="filled" color="green" size="md" 
              style={{ flex: 1, borderRadius: '8px' }} leftSection={<IconPlayerPlayFilled size={16} />}
            >
              Start
            </Button>
            <Button
              onClick={handleStop} variant="filled" color="red" size="md" 
              style={{ flex: 1, borderRadius: '8px' }} leftSection={<IconPlayerStopFilled size={16} />}
            >
              Stop
            </Button>
          </div>

          <Button 
            onClick={handleSaveData} variant="filled" size="sm" color="blue"
            leftSection={<IconDeviceFloppy size={16} />} style={{ borderRadius: '8px', marginTop: '5px' }}
          >
            Save Data
          </Button>
        </div>
      </div>

      <div className="nami-card">
        <div className="nami-card-header">Source Configuration</div>
        <div className="nami-card-content">
          <Select 
            label="Source type:"
            value={sourceType}
            onChange={(value) => setSourceType(value || "voltage-src")}
            data={[
              { value: 'voltage-src', label: 'Voltage source' },
              { value: 'current-src', label: 'Current source' }
            ]}
            size="sm"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <NumberInput
              label={sourceType === "voltage-src" ? "U_min (V)" : "I_min (A)"}
              value={sourceType === "voltage-src" ? voltageMin : currentMin}
              onChange={(value) => sourceType === "voltage-src" ? setVoltageMin(value?.toString() || "") : setCurrentMin(value?.toString() || "")}
              size="sm" hideControls clampBehavior="none" allowLeadingZeros={true} trimLeadingZeroesOnBlur={false}
            />
            <NumberInput
              label={sourceType === "voltage-src" ? "U_max (V)" : "I_max (A)"}
              value={sourceType === "voltage-src" ? voltageMax : currentMax}
              onChange={(value) => sourceType === "voltage-src" ? setVoltageMax(value?.toString() || "") : setCurrentMax(value?.toString() || "")}
              size="sm" hideControls clampBehavior="none" allowLeadingZeros={true} trimLeadingZeroesOnBlur={false}
            />
          </div>
          
          <NumberInput
            label="Iterations:" value={iterations} onChange={(value) => setIterations(value?.toString() || "")} min={1} size="sm" hideControls
          />
        </div>
      </div>

      <div className="nami-card">
        <div className="nami-card-header">Limits & Advanced</div>
        <div className="nami-card-content">
          <div style={{ display: 'flex', gap: '5px', alignItems: 'end' }}>
            <NumberInput
              label={sourceType === "voltage-src" ? "Current limit" : "Voltage limit"}
              value={sourceType === "voltage-src" ? currentLimit : voltageLimit}
              onChange={(value) => sourceType === "voltage-src" ? setCurrentLimit(value?.toString() || "") : setVoltageLimit(value?.toString() || "")}
              size="sm" hideControls clampBehavior="none" style={{ flex: 1 }}
            />
            <Select
              id={sourceType === "voltage-src" ? "current-limiter-units" : "voltage-limiter-units"}
              data={sourceType === "voltage-src" 
                ? [ { value: 'uA', label: 'μA' }, { value: 'mA', label: 'mA' }, { value: 'A', label: 'A' } ]
                : [ { value: 'uV', label: 'μV' }, { value: 'mV', label: 'mV' }, { value: 'V', label: 'V' } ]
              }
              defaultValue={sourceType === "voltage-src" ? "mA" : "mV"}
              size="sm" style={{ width: '80px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '5px' }}>
            <Checkbox checked={fourWire} onChange={(e) => setFourWire(e.currentTarget.checked)} label="4Wire" size="sm" />
            <Checkbox checked={bothWays} onChange={(e) => setBothWays(e.currentTarget.checked)} label="Both ways" size="sm" />
          </div>

          <Menu shadow="md" width={250} position="right-start">
            <Menu.Target>
              <Button variant="light" size="sm" color="gray" rightSection={<IconSettings size={15} />} fullWidth>
                More Settings
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <div style={{ padding: '10px' }}>
                <NumberInput label="Delay (ms):" value={delay} onChange={(value) => setDelay(value?.toString() || "")} size="xs" hideControls style={{ marginBottom: '10px' }} />
                <NumberInput label="Repeats:" value={repeats} onChange={(value) => setRepeats(value?.toString() || "")} size="xs" hideControls style={{ marginBottom: '10px' }} />
                <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{sourceType === "voltage-src" ? "U_safety [V]:" : "I_safety [A]:"}</span>
                <div style={{ display: 'flex', gap: '5px', marginTop: '5px' }}>
                  <NumberInput placeholder="min" value={sourceType === "voltage-src" ? uMinSafety : iMinSafety} onChange={(value) => sourceType === "voltage-src" ? setUminSafety(value?.toString() || "") : setIminSafety(value?.toString() || "")} size="xs" hideControls />
                  <NumberInput placeholder="max" value={sourceType === "voltage-src" ? uMaxSafety : iMaxSafety} onChange={(value) => sourceType === "voltage-src" ? setUmaxSafety(value?.toString() || "") : setImaxSafety(value?.toString() || "")} size="xs" hideControls />
                </div>
              </div>
            </Menu.Dropdown>
          </Menu>
          
          <Button variant="outline" size="sm" color="gray" leftSection={<IconCamera size={16} />} onClick={async () => {
              try { await window.camera.openWindow(); } catch (error) {}
          }}>Open Camera</Button>
        </div>
      </div>

      <div className="nami-card">
        <div className="nami-card-header">Chart Configuration</div>
        <div className="nami-card-content" style={{ padding: '5px 15px 15px 15px' }}>
          <Tabs defaultValue="axes" color="blue">
            <Tabs.List>
              <Tabs.Tab value="axes" style={{ flex: 1 }}>Axis Settings</Tabs.Tab>
              <Tabs.Tab value="series" style={{ flex: 1 }}>Plot Series</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="axes" pt="sm">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--nami-navy)' }}>AXIS X</h4>
                  <Select value={xScaleType} onChange={(value) => setXScaleType(value as "linear" | "log")} data={[ { value: 'linear', label: 'Linear' }, { value: 'log', label: 'Logarithmic' } ]} size="xs" style={{ marginBottom: '8px' }} />
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <Select value={measuredValueX} onChange={handleChangeX} data={[ { value: 'U', label: 'Voltage (U)' }, { value: 'I', label: 'Current (I)' } ]} size="xs" style={{ flex: 1 }} />
                    {measuredValueX === "I" && <Select value={selectedCurrentUnit} onChange={handleCurrentChange} data={[ { value: 'nA', label: 'nA' }, { value: 'uA', label: 'μA' }, { value: 'mA', label: 'mA' }, { value: 'A', label: 'A' } ]} size="xs" style={{ width: '70px' }} />}
                    {measuredValueX === "U" && <Select value={selectedVoltageUnit} onChange={handleVoltageChange} data={[ { value: 'nV', label: 'nV' }, { value: 'uV', label: 'μV' }, { value: 'mV', label: 'mV' }, { value: 'V', label: 'V' } ]} size="xs" style={{ width: '70px' }} />}
                  </div>
                </div>

                <div>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--nami-navy)' }}>AXIS Y</h4>
                  <Select value={yScaleType} onChange={(value) => setYScaleType(value as "linear" | "log")} data={[ { value: 'linear', label: 'Linear' }, { value: 'log', label: 'Logarithmic' } ]} size="xs" style={{ marginBottom: '8px' }} />
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <Select value={measuredValueY} onChange={handleChangeY} data={[ { value: 'U', label: 'Voltage (U)' }, { value: 'I', label: 'Current (I)' } ]} size="xs" style={{ flex: 1 }} />
                    {measuredValueY === "I" && <Select value={selectedCurrentUnit} onChange={handleCurrentChange} data={[ { value: 'nA', label: 'nA' }, { value: 'uA', label: 'μA' }, { value: 'mA', label: 'mA' }, { value: 'A', label: 'A' } ]} size="xs" style={{ width: '70px' }} />}
                    {measuredValueY === "U" && <Select value={selectedVoltageUnit} onChange={handleVoltageChange} data={[ { value: 'nV', label: 'nV' }, { value: 'uV', label: 'μV' }, { value: 'mV', label: 'mV' }, { value: 'V', label: 'V' } ]} size="xs" style={{ width: '70px' }} />}
                  </div>
                </div>
              </div>
            </Tabs.Panel>

            <Tabs.Panel value="series" pt="sm">
              <TextInput label="Series name" placeholder="Enter series name" size="xs" style={{ marginBottom: '10px' }} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="outline" size="xs" style={{ flex: 1 }} color="blue">New</Button>
                <Button variant="outline" color="red" size="xs" style={{ flex: 1 }}>Delete</Button>
              </div>
            </Tabs.Panel>
          </Tabs>
        </div>
      </div>
    </>
  );
};

export default Toolbar;