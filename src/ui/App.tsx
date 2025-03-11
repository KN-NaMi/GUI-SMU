import './App.css'
import React from "react";

interface ToolbarProps {}

const Toolbar: React.FC<ToolbarProps> = () => {
  return (
    <div className='toolbar'>

      <div className='start-stop-buttons'>

        <button className='start-btn'>
          <img src="/play.png" alt="play-icon" />
        </button>

        <button className='stop-btn'>
          <img src="/stop.png" alt="stop-icon" />
        </button>

      </div>

      <div className='COM-select'>
        <label htmlFor="COM1">COM 1</label>
        <select id="COM1">
          <option value="-">-</option>
          <option value="Voltomierz">Voltomierz</option>
          <option value="Amperomierz">Amperomierz</option>
        </select>

        <label htmlFor="COM2">COM 2</label>
        <select id="COM2">
          <option value="-">-</option>
          <option value="Voltomierz">Voltomierz</option>
          <option value="Amperomierz">Amperomierz</option>
        </select>
      </div>

      <div className='input-container'>
        <div className='input-label-corelation'>
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

        <div className='input-label-corelation'>
          <label htmlFor="U-max">U_max</label>
          <input type="text" id='U-max'/>
        </div>
        
        <div className='input-label-corelation'>
          <label htmlFor="how-many-measurements">Ilość punktów pomiarowych</label>
          <input type="text" id='how-many-measurements'/>
        </div>

        <div className='input-label-corelation'>
          <label htmlFor="U-min">U_min</label>
          <input type="text" id='U-min'/>
        </div>
        
      </div>

    </div>
  );
};

export default Toolbar;
