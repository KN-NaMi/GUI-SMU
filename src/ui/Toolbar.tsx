import { useScale } from '../electron/useScale';
import './Toolbar.css'
import React, { useState } from "react";

interface ToolbarProps {
  xScaleType: "linear" | "log";
  yScaleType: "linear" | "log";
  setXScaleType: (type: "linear" | "log") => void;
  setYScaleType: (type: "linear" | "log") => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  xScaleType, 
  yScaleType, 
  setXScaleType, 
  setYScaleType 
}) => {

  const scale = useScale();

  const [sourceType, setSourceType] = useState<string>("voltage-src");
  const [measuredValueX, setMeasuredValueX] = useState<string>("I");
  const [measuredValueY, setMeasuredValueY] = useState<string>("U");

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
          <button className='start-btn'>
            <img src="/play.png" alt="play-icon" />
          </button>

            <button className='stop-btn'>
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

        <div className='input-container'>
          {sourceType === "voltage-src" && (
            <>
              {/* Voltage source options*/}
              <div className='input-label-corelation nw'>
                <label htmlFor="current-limiter">Ograniczenie prądowe</label>
                <div>
                  <input type="text" id='current-limiter' />
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
                <input type="text" id='U-max'/>
              </div>
              
              <div className='input-label-corelation se'>
                <label htmlFor="U-min">U_min</label>
                <input type="text" id='U-min'/>
              </div>
            </>
          )}
          {sourceType === "current-src" && (
            <>
              {/* Current source options */}
              <div className='input-label-corelation nw'>
                <label htmlFor="voltage-limiter">Ograniczenie napięciowe</label>
                <div>
                  <input type="text" id='voltage-limiter' />
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
                <input type="text" id='I-max'/>
              </div>

              <div className='input-label-corelation se'>
                <label htmlFor="I-min">I_min</label>
                <input type="text" id='I-min'/>
              </div>
            </>
          )}
              <div className='input-label-corelation sw'>
                <label htmlFor="how-many-measurements">Ilość punktów pomiarowych</label>
                <input type="text" id='how-many-measurements'/>
              </div>
          
        </div>

        {/* Presets */}
        <fieldset className='presets'>
          <legend>Presety</legend>
          <button className='save-preset-btn'>Zapisz preset</button>
          <button className='load-preset-btn'>Wczytaj preset</button>
          <div className='input-label-corelation'>
            <label htmlFor="choose-presets">Presety</label>
            <select name="choose-presets" id="choose-presets">

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
          </fieldset>
        </div>
      </fieldset>
    </div>
  );
};

export default Toolbar;
