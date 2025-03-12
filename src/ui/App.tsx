import './App.css'
import React, { useState } from "react";

interface ToolbarProps {}

const Toolbar: React.FC<ToolbarProps> = () => {

  const [sourceType, setSourceType] = useState<string>("voltage-src");

  return (
    <div className='toolbar'>
      
      <div className='first-column'>
        <div className='start-stop-buttons'>
          {/* przyciski start i stop */}
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
            {/* Źródło napięciowe */}
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
            {/* Źródło prądowe */}
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

      <fieldset className='graph-options'>
        <legend>Wykres</legend>

      </fieldset>

    </div>
  );
};

export default Toolbar;
