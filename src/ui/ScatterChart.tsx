import * as d3 from "d3";
import { useEffect, useRef } from "react";
import { useScale } from '../electron/useScale';
import { ChartAxisKey } from './Toolbar';
import "./ScatterChart.css";
import { CurrentUnit, VoltageUnit } from './ScaleChartData';

export interface DataPoint {
  step: number;
  current: number;
  voltage: number;
}

interface ScatterChartProps {
  data?: DataPoint[];
  xScaleType: "linear" | "log";
  yScaleType: "linear" | "log";
  xAxisDataKey: ChartAxisKey;
  yAxisDataKey: ChartAxisKey;
  selectedCurrentUnit: CurrentUnit;
  selectedVoltageUnit: VoltageUnit;
}

const ScatterChart = ({ 
  data = [],
  xScaleType = "linear",
  yScaleType = "linear",
  xAxisDataKey,
  yAxisDataKey,
  selectedCurrentUnit,
  selectedVoltageUnit,
}: ScatterChartProps) => {

  const svgRef = useRef<SVGSVGElement>(null);
  const scale = useScale();

  useEffect(() => {
    if (!svgRef.current) return;
    const chartData = data.length > 0 ? data : [];
  
    const width = 1900 * scale;
    const height = 790 * scale;
    const margin = { top: 30, right: 40, bottom: 60, left: 80 };
    const symlogConstant = 1;

    const axisLabels: Record<ChartAxisKey, string> = {
      voltage: `Voltage [${selectedVoltageUnit}]`,
      current: `Current [${selectedCurrentUnit}]`,
      step: "Step",
    };

    const createScale = (
      type: "linear" | "log",
      domain: [number, number],
      range: [number, number]
    ) => {
      if (type === "log") {
        return d3.scaleSymlog()
          .domain(domain)
          .range(range)
          .constant(symlogConstant);
      }
      return d3.scaleLinear()
        .domain(domain)
        .range(range);
    };

    const generateTicks = (type: "linear" | "log" ,min: number, max: number) => {
      if (type === "linear") {
        return {
          main: d3.ticks(min, max, 10),
          minor: []
        };
      }

      let mainTicks: number[] = [];
      let minorTicks: number[] = [];

      const maxAbsVal = Math.max(Math.abs(min), Math.abs(max));
      const expRangeStart = Math.floor(Math.log10(Math.max(symlogConstant, maxAbsVal / 1000)));
      const expRangeEnd = Math.ceil(Math.log10(Math.max(symlogConstant, maxAbsVal * 1000)));

      for (let i = expRangeStart; i <= expRangeEnd; i++) {
        const pow10 = Math.pow(10, i);

        if (pow10 >= min && pow10 <= max) {
            mainTicks.push(pow10);
        }

        if (-pow10 >= min && -pow10 <= max && pow10 !== 0) {
          mainTicks.push(-pow10);
        }

        for (let j = 2; j < 10; j++) {
          const minorValue = j * Math.pow(10, i);
          if (minorValue >= min && minorValue <= max) {
              minorTicks.push(minorValue);
          }
          if (-minorValue >= min && -minorValue <= max) {
              minorTicks.push(-minorValue);
          }
        }
      }
      
      if (min <= 0 && max >= 0) {
        mainTicks.push(0);
      }

      mainTicks = Array.from(new Set(mainTicks)).sort((a, b) => a - b);
      minorTicks = Array.from(new Set(minorTicks)).sort((a, b) => a - b);

      mainTicks = mainTicks.filter(t => t >= min && t <= max);
      minorTicks = minorTicks.filter(t => t >= min && t <= max);
      
      return {
        main: mainTicks,
        minor: minorTicks
      };
    };

    const formatTickLabel = (type: "linear" | "log", d: d3.NumberValue) => {
      const value = d.valueOf();
      
      if (type === "linear") {
        if (Math.abs(value) >= 1000 || (Math.abs(value) > 0 && Math.abs(value) < 0.001)) {
          return d3.format(".1e")(value);
        }
        return value === 0 ? "0" : d3.format(".2f")(value);
      }

      if (value === 0) return "0";
      if (value === -1) return "-1";
      if (value === 1) return "1";
      if (Math.abs(value) < symlogConstant) {
        return d3.format(".1f")(value);
      }
      
      const exp = Math.log10(Math.abs(value));
      const roundedExp = Math.round(exp);
      
      if (value < 0) {
        return roundedExp % 1 === 0 ? `-10^${Math.round(roundedExp)}` : "";
      }
      return roundedExp % 1 === 0 ? `10^${Math.round(roundedExp)}` : "";
    };

    const getMinMax = (data: DataPoint[], key: ChartAxisKey, scaleType: "linear" | "log"): [number, number] => {
      if (data.length === 0) {
        return [-10, 10];
      }
      
      const values = data.map(d => d[key]);
      const minData = d3.min(values) as number;
      const maxData = d3.max(values) as number;

      let min = minData;
      let max = maxData;

      if (minData === maxData) {
        min = minData - 1;
        max = maxData + 1;
      } else {
        if (scaleType === "linear") {
          const padding = (maxData - minData) * 0.1;
          min = minData - padding;
          max = maxData + padding;
        } else { 
          const absMaxData = Math.max(Math.abs(minData), Math.abs(maxData));
          const basePadding = absMaxData * 0.05;
          const constantPadding = symlogConstant * 0.5;

          if (minData < 0 && maxData > 0) {
            min = -absMaxData - basePadding - constantPadding;
            max = absMaxData + basePadding + constantPadding;
          } else if (minData >= 0) {
            min = Math.max(0, minData - basePadding);
            max = maxData + basePadding;
          } else {
            min = minData - basePadding;
            max = Math.min(0, maxData + basePadding);
          }

          if (minData >= 0 && min < 0) min = 0;
          if (maxData <= 0 && max > 0) max = 0;

          if (Math.abs(max - min) < symlogConstant * 2) {
                const center = (minData + maxData) / 2;
                min = center - symlogConstant * 1.5;
                max = center + symlogConstant * 1.5;
              
                if (minData < 0 && maxData > 0) {
                    min = Math.min(min, -symlogConstant * 2);
                    max = Math.max(max, symlogConstant * 2);
                } else if (minData >= 0 && min < 0) {
                    min = 0;
                } else if (maxData <= 0 && max > 0) {
                    max = 0;
                }
            }
        }
      }
      return [min, max];
    };

    const xDomain = getMinMax(chartData, xAxisDataKey, xScaleType);
    const yDomain = getMinMax(chartData, yAxisDataKey, yScaleType);

    const xScale = createScale(xScaleType, xDomain, [margin.left, width - margin.right]);
    const yScale = createScale(yScaleType, yDomain, [height - margin.bottom, margin.top]);

    const xTicks = generateTicks(xScaleType, xDomain[0], xDomain[1]);
    const yTicks = generateTicks(yScaleType, yDomain[0], yDomain[1]);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    const drawGrid = () => {
      svg.append("g")
        .attr("class", "main-grid")
        .attr("transform", `translate(${margin.left},0)`)
        .call(
          d3.axisLeft(yScale)
            .tickValues(yTicks.main)
            .tickSize(-(width - margin.left - margin.right))
            .tickFormat(() => "")
        )
        .selectAll("line")
        .attr("stroke", "#E2E8F0") 
        .attr("stroke-dasharray", "4 4");

      svg.append("g")
      .attr("class", "main-grid")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(
        d3.axisBottom(xScale)
          .tickValues(xTicks.main)
          .tickSize(-(height - margin.top - margin.bottom))
          .tickFormat(() => "")
      )
      .selectAll("line")
      .attr("stroke", "#E2E8F0")
      .attr("stroke-dasharray", "4 4");

      if (xScaleType === "log" || yScaleType === "log"){
        svg.append("g")
          .attr("class", "minor-grid")
          .attr("transform", `translate(${margin.left},0)`)
          .call(
            d3.axisLeft(yScale)
              .tickValues(yTicks.minor)
              .tickSize(-(width - margin.left - margin.right))
              .tickFormat(() => "")
          )
          .selectAll("line")
          .attr("stroke", "#F1F5F9")
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "2 2");

        svg.append("g")
          .attr("class", "minor-grid")
          .attr("transform", `translate(0,${height - margin.bottom})`)
          .call(
            d3.axisBottom(xScale)
              .tickValues(xTicks.minor)
              .tickSize(-(height - margin.top - margin.bottom))
              .tickFormat(() => "")
          )
          .selectAll("line")
          .attr("stroke", "#F1F5F9")
          .attr("stroke-width", 1)
          .attr("stroke-dasharray", "2 2");
      }
    };

    const drawAxes = () => {
      svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(
        d3.axisBottom(xScale)
          .tickValues(xTicks.main)
          .tickFormat(d => formatTickLabel(xScaleType, d))
      )
      .selectAll("text")
      .attr("font-size", `${12 * scale}px`)
      .attr("fill", "#64748B");

      svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(
        d3.axisLeft(yScale)
          .tickValues(yTicks.main)
          .tickFormat(d => formatTickLabel(yScaleType, d))
      )
      .selectAll("text")
      .attr("font-size", `${12 * scale}px`)
      .attr("fill", "#64748B");

      svg.selectAll(".domain").attr("stroke", "#94A3B8");
      svg.selectAll(".tick line").attr("stroke", "#94A3B8");
    
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height - 15)
      .attr("text-anchor", "middle")
      .attr("font-size", `${15 * scale}px`)
      .attr("font-weight", "600")
      .attr("fill", "#2C3E50")
      .text(axisLabels[xAxisDataKey]);
      
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", 25)
      .attr("text-anchor", "middle")
      .attr("font-size", `${15 * scale}px`)
      .attr("font-weight", "600")
      .attr("fill", "#2C3E50")
      .text(axisLabels[yAxisDataKey]);
    };

    const drawPoints = () => {
      if (chartData.length > 0) {
        svg.append("g")
          .selectAll("circle")
          .data(chartData)
          .enter().append("circle")
          .attr("cx", d => xScale(d[xAxisDataKey]))
          .attr("cy", d => yScale(d[yAxisDataKey]))
          .attr("r", 5 * scale)
          .attr("fill", "#1976D2")
          .attr("opacity", "0.8")
          .attr("stroke", "#0B1C33")
          .attr("stroke-width", "1px");
      }
    };

    drawGrid();
    drawAxes();
    drawPoints();

  }, [scale, data, xScaleType, yScaleType, xAxisDataKey, yAxisDataKey, selectedCurrentUnit, selectedVoltageUnit,]);
  
  return(
    <div className="scatter-chart-container" >
      <svg ref={svgRef} className="scatter-chart"></svg>
    </div>
  );
};

export default ScatterChart;