import * as d3 from "d3";
import { useEffect, useRef } from "react";
import { useScale } from '../electron/useScale';
import "./ScatterChart.css";

export interface DataPoint {
  step: number;
  current: number;
  voltage: number;
}

interface ScatterChartProps {
  data?: DataPoint[];
  xScaleType: "linear" | "log";
  yScaleType: "linear" | "log";
}

const ScatterChart = ({ 
  data = [],
  xScaleType = "linear",
  yScaleType = "linear" 
}: ScatterChartProps) => {

  const svgRef = useRef<SVGSVGElement>(null);
  const scale = useScale();

  useEffect(() => {
    if (!svgRef.current) return;
    const chartData = data.length > 0 ? data : [];
  
    const width = 1900 * scale;
    const height = 790 * scale;
    const margin = { top: 20, right: 20, bottom: 50, left: 60 };
    const symlogConstant = 1;

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
      const absMax = Math.max(Math.abs(min), Math.abs(max));
      const upper = Math.ceil(Math.log10(absMax));
      const lower = -upper;

      let mainTicks = [];
      let minorTicks = [];

      // Ticks for negative numbers
      for (let i = lower; i <= 0; i++) {
        const value = -Math.pow(10, -i);
        mainTicks.push(value);

        if (i < 0) {
          for (let j = 2; j < 10; j++) {
            minorTicks.push(-j * Math.pow(10, -i - 1));
          }
        }
      }

      // Add zero if it's in range
      if (min <= 0 && max >= 0) {
        mainTicks.push(0);
      }

      // Ticks for positive numbers
      for (let i = 0; i <= upper; i++) {
        mainTicks.push(Math.pow(10, i));
        
        if (i > 0) {
          for (let j = 2; j < 10; j++) {
            minorTicks.push(j * Math.pow(10, i - 1));
          }
        }
      }
      
      return {
        main: mainTicks.filter(t => t >= min && t <= max),
        minor: minorTicks.filter(t => t >= min && t <= max)
      };
    };

    // Tick labels formatting
    const formatTickLabel = (type: "linear" | "log", d: d3.NumberValue) => {
      const value = d.valueOf();
      
      // Linear
      if (type === "linear") {
        return value === 0 ? "0" : d3.format(".1f")(value);
      }

      // SymLog
      if (value === 0) return "0";
      if (value === 1) return "1";
      if (value === -1) return "-1";
      
      const exp = Math.log10(Math.abs(value));
      const roundedExp = Math.round(exp * 1e12) / 1e12;
      
      if (value < 0) {
        return roundedExp % 1 === 0 ? `-10^${roundedExp}` : "";
      }
      return roundedExp % 1 === 0 ? `10^${roundedExp}` : "";
    };

    const getMinMax = (data: DataPoint[], accessor: (d: DataPoint) => number): [number, number] => {
      if (data.length === 0) {
        return [-10, 10];
      }
      
      const values = data.map(accessor);
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      const padding = (max - min) * 0.1;
      
      if (min === max) {
        return [min - 1, max + 1];
      }
      
      return [min - padding, max + padding];
    };

    // Creating scales
    const xDomain = getMinMax(chartData, d => d.voltage);
    const yDomain = getMinMax(chartData, d => d.current);

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
      if (xScaleType === "log"){
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
      .attr("fill", "white")
      .text("Voltage [V]");
      
    svg.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", 15)
      .attr("text-anchor", "middle")
      .attr("font-size", `${18 * scale}px`)
      .attr("fill", "white")
      .text("Current [A]");
    };

    // Drawing points
    const drawPoints = () => {
      if (chartData.length > 0) {
        svg.append("g")
          .selectAll("circle")
          .data(chartData)
          .enter().append("circle")
          .attr("cx", d => xScale(d.voltage))
          .attr("cy", d => yScale(d.current))
          .attr("r", 5 * scale)
          .attr("fill", "steelblue");
        
        const line = d3.line<DataPoint>()
          .x(d => xScale(d.voltage))
          .y(d => yScale(d.current));
        
        svg.append("path")
          .datum(chartData)
          .attr("fill", "none")
          .attr("stroke", "steelblue")
          .attr("stroke-width", 2 * scale)
          .attr("d", line);
      }
    };

    drawGrid();
    drawAxes();
    drawPoints();
    svg.selectAll(".domain").remove();

  }, [scale, data, xScaleType, yScaleType]);
  
  return(
    <div className="scatter-chart-container" >
      <svg ref={svgRef} className="scatter-chart"></svg>
    </div>
  );
};

export default ScatterChart;