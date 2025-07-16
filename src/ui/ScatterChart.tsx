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
    const margin = { top: 20, right: 20, bottom: 50, left: 70 };
    const symlogConstant = 1;

    // Mapping axis keys to display names
    const axisLabels: Record<ChartAxisKey, string> = {
      voltage: `Voltage [${selectedVoltageUnit}]`,
      current: `Current [${selectedCurrentUnit}]`,
      step: "Step",
    };

    // Creating a linear/symlog scale
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

    // Function that generates ticks based on the scale type
    const generateTicks = (type: "linear" | "log" ,min: number, max: number) => {
      // Linear
      if (type === "linear") {
        return {
          main: d3.ticks(min, max, 10),
          minor: []
        };
      }

      //SymLog
      let mainTicks: number[] = [];
      let minorTicks: number[] = [];

      const maxAbsVal = Math.max(Math.abs(min), Math.abs(max));
      const expRangeStart = Math.floor(Math.log10(Math.max(symlogConstant, maxAbsVal / 1000)));
      const expRangeEnd = Math.ceil(Math.log10(Math.max(symlogConstant, maxAbsVal * 1000)));

      // Ticks for negative numbers
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
      

      // Add zero if it's in range
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

    // Tick labels formatting
    const formatTickLabel = (type: "linear" | "log", d: d3.NumberValue) => {
      const value = d.valueOf();
      
      // Linear
      if (type === "linear") {
        if (Math.abs(value) >= 1000 || (Math.abs(value) > 0 && Math.abs(value) < 0.001)) { // Dodano warunek dla bardzo małych liczb
          return d3.format(".1e")(value);
        }

        return value === 0 ? "0" : d3.format(".2f")(value);
      }

      // SymLog
      if (value === 0) return "0";
      if (value === -1) return "-1";
      if (value === 1) return "1";
      if (Math.abs(value) < symlogConstant) {
        return d3.format(".1f")(value);
      }
      
      const exp = Math.log10(Math.abs(value));
      const roundedExp = Math.round(exp );
      
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

    // Creating scales
    const xDomain = getMinMax(chartData, xAxisDataKey, xScaleType);
    const yDomain = getMinMax(chartData, yAxisDataKey, yScaleType);

    const xScale = createScale(xScaleType, xDomain, [margin.left, width - margin.right]);
    const yScale = createScale(yScaleType, yDomain, [height - margin.bottom, margin.top]);

    // Generating ticks
    const xTicks = generateTicks(xScaleType, xDomain[0], xDomain[1]);
    const yTicks = generateTicks(yScaleType, yDomain[0], yDomain[1]);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("width", width).attr("height", height);

    // Drawing grid
    const drawGrid = () => {

      // Main grid
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
        .attr("stroke", "#a0a0a0") 
        .attr("stroke-dasharray", "3 3");

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
      .attr("stroke", "#a0a0a0")
      .attr("stroke-dasharray", "3 3");

      // Additional minor grid for symlog scale
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
          .attr("stroke", "#565656")
          .attr("stroke-width", 0.5)
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
          .attr("stroke", "#565656")
          .attr("stroke-width", 0.5)
          .attr("stroke-dasharray", "2 2");
      }
    };

    // Drawing Axes
    const drawAxes = () => {
      // Oś X
      svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(
        d3.axisBottom(xScale)
          .tickValues(xTicks.main)
          .tickFormat(d => formatTickLabel(xScaleType, d))
      )
      .selectAll("text")
      .attr("font-size", `${12 * scale}px`);

      // Oś Y
      svg.append("g")
      .attr("transform", `translate(${margin.left},0)`)
      .call(
        d3.axisLeft(yScale)
          .tickValues(yTicks.main)
          .tickFormat(d => formatTickLabel(yScaleType, d))
      )
      .selectAll("text")
      .attr("font-size", `${12 * scale}px`);
    
    svg.append("text")
      .attr("x", width / 2)
      .attr("y", height - 10)
      .attr("text-anchor", "middle")
      .attr("font-size", `${18 * scale}px`)
      .attr("fill", "black")
      .text(axisLabels[xAxisDataKey]);
      
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .attr("font-size", `${18 * scale}px`)
      .attr("fill", "black")
      .text(axisLabels[yAxisDataKey]);
    };

    // Drawing points
    const drawPoints = () => {
      if (chartData.length > 0) {
        svg.append("g")
          .selectAll("circle")
          .data(chartData)
          .enter().append("circle")
          .attr("cx", d => xScale(d[xAxisDataKey]))
          .attr("cy", d => yScale(d[yAxisDataKey]))
          .attr("r", 5 * scale)
          .attr("fill", "steelblue");
      }
    };

    drawGrid();
    drawAxes();
    drawPoints();
    //svg.selectAll(".domain").remove();

  }, [scale, data, xScaleType, yScaleType, xAxisDataKey, yAxisDataKey, selectedCurrentUnit, selectedVoltageUnit,]);
  
  return(
    <div className="scatter-chart-container" >
      <svg ref={svgRef} className="scatter-chart"></svg>
    </div>
  );
};

export default ScatterChart;