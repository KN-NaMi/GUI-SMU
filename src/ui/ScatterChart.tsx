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
  onStatsChange?: (stats: ChartStats | null) => void;
  zoomMode?: "none" | "zoom" | "pan";
  onZoomRefReady?: (zoom: d3.ZoomBehavior<SVGSVGElement, unknown>, svg: SVGSVGElement) => void;
  isDarkMode?: boolean;
}

export interface ChartStats {
  x: { min: number; max: number; mean: number; rms: number; label: string };
  y: { min: number; max: number; mean: number; rms: number; label: string };
  count: number;
}

const ScatterChart = ({
  data = [],
  xScaleType = "linear",
  yScaleType = "linear",
  xAxisDataKey,
  yAxisDataKey,
  selectedCurrentUnit,
  selectedVoltageUnit,
  onStatsChange,
  zoomMode = "none",
  onZoomRefReady,
  isDarkMode = false,
}: ScatterChartProps) => {

  const svgRef = useRef<SVGSVGElement>(null);
  const scale = useScale();
  const zoomModeRef = useRef<"none" | "zoom" | "pan">("none");

  useEffect(() => {
    zoomModeRef.current = zoomMode;
    if (!svgRef.current) return;
    d3.select(svgRef.current).style(
      "cursor",
      zoomMode === "pan" ? "grab" : zoomMode === "zoom" ? "crosshair" : "default"
    );
  }, [zoomMode]);

  useEffect(() => {
    if (!svgRef.current) return;
    const chartData = data.length > 0 ? data : [];

    const width = 1500 * scale;  
    const height = 650 * scale; 
    const margin = { top: 30, right: 40, bottom: 75, left: 80 };
    const symlogConstant = 1;

    const axisLabels: Record<ChartAxisKey, string> = {
      voltage: `Voltage [${selectedVoltageUnit}]`,
      current: `Current [${selectedCurrentUnit}]`,
      step: "Step",
    };

    if (chartData.length > 0) {
      const xVals = chartData.map(d => d[xAxisDataKey]);
      const yVals = chartData.map(d => d[yAxisDataKey]);
      const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
      const rms  = (a: number[]) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
      onStatsChange?.({
        x: { min: d3.min(xVals)!, max: d3.max(xVals)!, mean: mean(xVals), rms: rms(xVals), label: axisLabels[xAxisDataKey] },
        y: { min: d3.min(yVals)!, max: d3.max(yVals)!, mean: mean(yVals), rms: rms(yVals), label: axisLabels[yAxisDataKey] },
        count: chartData.length,
      });
    } else {
      onStatsChange?.(null);
    }

    const createScale = (type: "linear" | "log", domain: [number, number], range: [number, number]) =>
      type === "log"
        ? d3.scaleSymlog().domain(domain).range(range).constant(symlogConstant)
        : d3.scaleLinear().domain(domain).range(range);

    const generateTicks = (type: "linear" | "log", min: number, max: number) => {
      if (type === "linear") return { main: d3.ticks(min, max, 10), minor: [] as number[] };
      let main: number[] = [], minor: number[] = [];
      const maxAbs = Math.max(Math.abs(min), Math.abs(max));
      const e0 = Math.floor(Math.log10(Math.max(symlogConstant, maxAbs / 1000)));
      const e1 = Math.ceil(Math.log10(Math.max(symlogConstant, maxAbs * 1000)));
      for (let i = e0; i <= e1; i++) {
        const p = Math.pow(10, i);
        if (p >= min && p <= max) main.push(p);
        if (-p >= min && -p <= max && p !== 0) main.push(-p);
        for (let j = 2; j < 10; j++) {
          const mv = j * p;
          if (mv >= min && mv <= max) minor.push(mv);
          if (-mv >= min && -mv <= max) minor.push(-mv);
        }
      }
      if (min <= 0 && max >= 0) main.push(0);
      const clean = (arr: number[]) => Array.from(new Set(arr)).sort((a, b) => a - b).filter(t => t >= min && t <= max);
      return { main: clean(main), minor: clean(minor) };
    };

    const fmtTick = (type: "linear" | "log", d: d3.NumberValue) => {
      const v = d.valueOf();
      if (type === "linear") {
        if (Math.abs(v) >= 1000 || (Math.abs(v) > 0 && Math.abs(v) < 0.001)) return d3.format(".1e")(v);
        return v === 0 ? "0" : d3.format(".2f")(v);
      }
      if (v === 0) return "0"; if (v === -1) return "-1"; if (v === 1) return "1";
      if (Math.abs(v) < symlogConstant) return d3.format(".1f")(v);
      const re = Math.round(Math.log10(Math.abs(v)));
      return v < 0 ? (re % 1 === 0 ? `-10^${re}` : "") : (re % 1 === 0 ? `10^${re}` : "");
    };

    const getMinMax = (data: DataPoint[], key: ChartAxisKey, type: "linear" | "log"): [number, number] => {
      if (!data.length) return [-10, 10];
      const vals = data.map(d => d[key]);
      const mn = d3.min(vals)!, mx = d3.max(vals)!;
      let min = mn, max = mx;
      if (mn === mx) { min = mn - 1; max = mx + 1; }
      else if (type === "linear") { const p = (mx - mn) * 0.1; min = mn - p; max = mx + p; }
      else {
        const abs = Math.max(Math.abs(mn), Math.abs(mx));
        const bp = abs * 0.05, cp = symlogConstant * 0.5;
        if (mn < 0 && mx > 0)  { min = -abs - bp - cp; max = abs + bp + cp; }
        else if (mn >= 0)       { min = Math.max(0, mn - bp); max = mx + bp; }
        else                    { min = mn - bp; max = Math.min(0, mx + bp); }
        if (mn >= 0 && min < 0) min = 0;
        if (mx <= 0 && max > 0) max = 0;
        if (Math.abs(max - min) < symlogConstant * 2) {
          const c = (mn + mx) / 2;
          min = c - symlogConstant * 1.5; max = c + symlogConstant * 1.5;
          if (mn < 0 && mx > 0) { min = Math.min(min, -symlogConstant * 2); max = Math.max(max, symlogConstant * 2); }
          else if (mn >= 0 && min < 0) min = 0;
          else if (mx <= 0 && max > 0) max = 0;
        }
      }
      return [min, max];
    };

    const xDomain = getMinMax(chartData, xAxisDataKey, xScaleType);
    const yDomain = getMinMax(chartData, yAxisDataKey, yScaleType);
    const xScale  = createScale(xScaleType, xDomain, [margin.left, width - margin.right]);
    const yScale  = createScale(yScaleType, yDomain, [height - margin.bottom, margin.top]);

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    
    svg.attr("viewBox", `0 0 ${width} ${height}`)
       .attr("width", "100%")
       .attr("height", "100%")
       .attr("preserveAspectRatio", "xMidYMid meet");

    svg.append("defs").append("clipPath").attr("id", "plot-clip")
      .append("rect")
      .attr("x", margin.left).attr("y", margin.top)
      .attr("width", width - margin.left - margin.right)
      .attr("height", height - margin.top - margin.bottom);

    const gridG   = svg.append("g");
    const axisG   = svg.append("g");
    const pointsG = svg.append("g").attr("clip-path", "url(#plot-clip)");

    const drawGrid = (xs: any, ys: any) => {
      gridG.selectAll("*").remove();
      const xT = generateTicks(xScaleType, xs.domain()[0], xs.domain()[1]);
      const yT = generateTicks(yScaleType, ys.domain()[0], ys.domain()[1]);
      gridG.append("g").attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(ys).tickValues(yT.main).tickSize(-(width - margin.left - margin.right)).tickFormat(() => ""))
        .selectAll("line").attr("stroke", isDarkMode ? "#334155" : "#E2E8F0").attr("stroke-dasharray", "4 4");
      gridG.append("g").attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(xs).tickValues(xT.main).tickSize(-(height - margin.top - margin.bottom)).tickFormat(() => ""))
        .selectAll("line").attr("stroke", isDarkMode ? "#334155" : "#E2E8F0").attr("stroke-dasharray", "4 4");
      if (xScaleType === "log" || yScaleType === "log") {
        gridG.append("g").attr("transform", `translate(${margin.left},0)`)
          .call(d3.axisLeft(ys).tickValues(yT.minor).tickSize(-(width - margin.left - margin.right)).tickFormat(() => ""))
          .selectAll("line").attr("stroke", isDarkMode ? "#1e293b" : "#F1F5F9").attr("stroke-width", 1).attr("stroke-dasharray", "2 2");
        gridG.append("g").attr("transform", `translate(0,${height - margin.bottom})`)
          .call(d3.axisBottom(xs).tickValues(xT.minor).tickSize(-(height - margin.top - margin.bottom)).tickFormat(() => ""))
          .selectAll("line").attr("stroke", isDarkMode ? "#1e293b" : "#F1F5F9").attr("stroke-width", 1).attr("stroke-dasharray", "2 2");
      }
    };

    const drawAxes = (xs: any, ys: any) => {
      axisG.selectAll("*").remove();
      const xT = generateTicks(xScaleType, xs.domain()[0], xs.domain()[1]);
      const yT = generateTicks(yScaleType, ys.domain()[0], ys.domain()[1]);
      axisG.append("g").attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(xs).tickValues(xT.main).tickFormat((d: any) => fmtTick(xScaleType, d)))
        .selectAll("text").attr("font-size", `${12 * scale}px`).attr("fill", isDarkMode ? "#94A3B8" : "#64748B");
      axisG.append("g").attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(ys).tickValues(yT.main).tickFormat((d: any) => fmtTick(yScaleType, d)))
        .selectAll("text").attr("font-size", `${12 * scale}px`).attr("fill", isDarkMode ? "#94A3B8" : "#64748B");
      
      axisG.selectAll(".domain").attr("stroke", isDarkMode ? "#475569" : "#94A3B8");
      axisG.selectAll(".tick line").attr("stroke", isDarkMode ? "#475569" : "#94A3B8");
      
      axisG.append("text").attr("x", width / 2).attr("y", height - 35)
        .attr("text-anchor", "middle").attr("font-size", `${15 * scale}px`).attr("font-weight", "600").attr("fill", isDarkMode ? "#E2E8F0" : "#2C3E50")
        .text(axisLabels[xAxisDataKey]);
      axisG.append("text").attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", 25)
        .attr("text-anchor", "middle").attr("font-size", `${15 * scale}px`).attr("font-weight", "600").attr("fill", isDarkMode ? "#E2E8F0" : "#2C3E50")
        .text(axisLabels[yAxisDataKey]);
    };

    const drawPoints = (xs: any, ys: any) => {
      pointsG.selectAll("*").remove();
      if (chartData.length > 0) {
        pointsG.selectAll("circle").data(chartData).enter().append("circle")
          .attr("cx", (d: DataPoint) => xs(d[xAxisDataKey]))
          .attr("cy", (d: DataPoint) => ys(d[yAxisDataKey]))
          .attr("r", 5 * scale)
          .attr("fill", "#4e46e5").attr("opacity", "0.8")
          .attr("stroke", isDarkMode ? "#312e81" : "#0B1C33").attr("stroke-width", "1px");
      }
    };

    drawGrid(xScale, yScale);
    drawAxes(xScale, yScale);
    drawPoints(xScale, yScale);

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 50])
      .translateExtent([
        [margin.left - 2000, margin.top - 2000],
        [width - margin.right + 2000, height - margin.bottom + 2000],
      ])
      .filter((event: any) => {
        const mode = zoomModeRef.current;
        if (event.type === "wheel")      return mode === "zoom";
        if (event.type === "mousedown")  return mode === "pan";
        if (event.type === "touchstart") return mode !== "none";
        return false;
      })
      .on("zoom", (event) => {
        const t = event.transform;
        const nx = t.rescaleX(xScale as any);
        const ny = t.rescaleY(yScale as any);
        drawGrid(nx, ny);
        drawAxes(nx, ny);
        drawPoints(nx, ny);
      });

    (svg as any).call(zoom);
    onZoomRefReady?.(zoom, svgRef.current!);

  }, [scale, data, xScaleType, yScaleType, xAxisDataKey, yAxisDataKey, selectedCurrentUnit, selectedVoltageUnit, isDarkMode]);

  return (
    <div className="scatter-chart-container">
      <svg ref={svgRef} className="scatter-chart" />
    </div>
  );
};

export default ScatterChart;