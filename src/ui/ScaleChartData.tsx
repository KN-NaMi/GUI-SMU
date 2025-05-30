export interface DataPoint {
  step: number;
  current: number;
  voltage: number;
}

export const ScaleFactors = {
  current: {
      'nA': 1e9,
      'uA': 1e6,   
      'mA': 1e3,   
      'A': 1,      
      'kA': 1e-3,
  },
  voltage: {
      'nV': 1e9,   
      'uV': 1e6,   
      'mV': 1e3,   
      'V': 1,      
      'kV': 1e-3, 
  }
};

export type CurrentUnit = keyof typeof ScaleFactors.current;
export type VoltageUnit = keyof typeof ScaleFactors.voltage;

export function scaleChartData(
  originalData: DataPoint[],
  currentUnit: CurrentUnit,
  voltageUnit: VoltageUnit
): DataPoint[] {
  const currentMultiplier = ScaleFactors.current[currentUnit] || 1;
  const voltageMultiplier = ScaleFactors.voltage[voltageUnit] || 1;

  const scaledData: DataPoint[] = originalData.map(point => ({
    ...point, 
    current: point.current * currentMultiplier,
    voltage: point.voltage * voltageMultiplier,
  }));

  return scaledData;
}