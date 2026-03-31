import { useState, useCallback } from "react";
import * as d3 from "d3";
import { ChartStats } from "./ScatterChart";
import "./ChartPanel.css";

export type ZoomMode = "none" | "zoom" | "pan";

interface SeriesConfig {
  id: string;
  label: string;
  color: string;
  visible: boolean;
}

interface ChartPanelProps {
  stats: ChartStats | null;
  series?: SeriesConfig[];
  onToggleSeries?: (id: string) => void;
  zoomMode: ZoomMode;
  onZoomModeChange: (mode: ZoomMode) => void;
  zoomBehaviorRef: React.MutableRefObject<d3.ZoomBehavior<SVGSVGElement, unknown> | null>;
  svgRef: React.MutableRefObject<SVGSVGElement | null>;
}

const fmt = (v: number): string => {
  if (v === undefined || v === null || isNaN(v)) return "—";
  const abs = Math.abs(v);
  if (abs === 0) return "0";
  if (abs >= 1000 || (abs > 0 && abs < 0.001)) return v.toExponential(3);
  return v.toPrecision(5);
};

const extractUnit = (label: string) => label.match(/\[(.+?)\]/)?.[1] ?? "";

const StatCard = ({ label, value, unit }: { label: string; value: number; unit: string }) => (
  <div className="stat-card">
    <span className="stat-label">{label}</span>
    <span className="stat-value">{fmt(value)}</span>
    <span className="stat-unit">{unit}</span>
  </div>
);

const ChartPanel = ({
  stats,
  series = [],
  onToggleSeries,
  zoomMode,
  onZoomModeChange,
  zoomBehaviorRef,
  svgRef,
}: ChartPanelProps) => {
  const [activeTab, setActiveTab] = useState<"stats" | "legend" | "controls">("stats");

  const handleReset = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current)
      .transition().duration(400)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
  }, [svgRef, zoomBehaviorRef]);

  const activeSeries: SeriesConfig[] = series.length > 0 ? series : [
    { id: "main", label: "Measurement", color: "#1976D2", visible: true },
  ];

  return (
    <div className="chart-panel">
      <div className="panel-tabs">
        <button className={`panel-tab ${activeTab === "stats" ? "active" : ""}`} onClick={() => setActiveTab("stats")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
          </svg>
          Statistics
        </button>
        <button className={`panel-tab ${activeTab === "legend" ? "active" : ""}`} onClick={() => setActiveTab("legend")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
          Legend
        </button>
        <button className={`panel-tab ${activeTab === "controls" ? "active" : ""}`} onClick={() => setActiveTab("controls")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          Controls
        </button>

        {stats && (
          <span className="panel-count">{stats.count} pt{stats.count !== 1 ? "s" : ""}</span>
        )}
      </div>

      {activeTab === "stats" && (
        <div className="panel-content stats-content">
          {!stats ? (
            <div className="panel-empty">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 3v18h18"/><path d="M18 9l-5 5-2-2-5 5"/>
              </svg>
              <span>No data yet — run a measurement to see statistics</span>
            </div>
          ) : (
            <>
              <div className="stat-axis-group">
                <div className="stat-axis-label">
                  <div className="stat-axis-dot x-dot" />
                  {stats.x.label}
                </div>
                <div className="stat-cards-row">
                  <StatCard label="Min"  value={stats.x.min}  unit={extractUnit(stats.x.label)} />
                  <StatCard label="Max"  value={stats.x.max}  unit={extractUnit(stats.x.label)} />
                  <StatCard label="Mean" value={stats.x.mean} unit={extractUnit(stats.x.label)} />
                  <StatCard label="RMS"  value={stats.x.rms}  unit={extractUnit(stats.x.label)} />
                </div>
              </div>
              <div className="stat-divider" />
              <div className="stat-axis-group">
                <div className="stat-axis-label">
                  <div className="stat-axis-dot y-dot" />
                  {stats.y.label}
                </div>
                <div className="stat-cards-row">
                  <StatCard label="Min"  value={stats.y.min}  unit={extractUnit(stats.y.label)} />
                  <StatCard label="Max"  value={stats.y.max}  unit={extractUnit(stats.y.label)} />
                  <StatCard label="Mean" value={stats.y.mean} unit={extractUnit(stats.y.label)} />
                  <StatCard label="RMS"  value={stats.y.rms}  unit={extractUnit(stats.y.label)} />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === "legend" && (
        <div className="panel-content legend-content">
          <div className="legend-list">
            {activeSeries.map(s => (
              <button
                key={s.id}
                className={`legend-item ${!s.visible ? "hidden" : ""}`}
                onClick={() => onToggleSeries?.(s.id)}
                title={s.visible ? "Click to hide" : "Click to show"}
              >
                <span className="legend-swatch" style={{ background: s.color }} />
                <span className="legend-name">{s.label}</span>
                <span className="legend-eye">
                  {s.visible ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  )}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTab === "controls" && (
        <div className="panel-content controls-content">
          <div className="controls-group">
            <span className="controls-label">Navigation mode</span>
            <div className="controls-buttons">
              <button
                className={`ctrl-btn ${zoomMode === "zoom" ? "active" : ""}`}
                onClick={() => onZoomModeChange(zoomMode === "zoom" ? "none" : "zoom")}
                title="Scroll wheel to zoom"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
                </svg>
                Zoom
              </button>
              <button
                className={`ctrl-btn ${zoomMode === "pan" ? "active" : ""}`}
                onClick={() => onZoomModeChange(zoomMode === "pan" ? "none" : "pan")}
                title="Click and drag to pan"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>
                </svg>
                Pan
              </button>
              <button
                className="ctrl-btn ctrl-btn-reset"
                onClick={handleReset}
                title="Reset to original view"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
                Reset view
              </button>
            </div>
            {zoomMode !== "none" && (
              <p className="controls-hint">
                {zoomMode === "zoom"
                  ? "Scroll on the chart to zoom in/out"
                  : "Click and drag on the chart to pan"}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartPanel;
export type { SeriesConfig };