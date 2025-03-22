// import React, { useEffect, useState } from "react";
import Toolbar from "./Toolbar";
// import ScatterChartComponent from "./ScatterChart";
import './App.css'

const App: React.FC = () => {

    // const [xScale, setXScale] = useState<"linear" | "log">("linear");
    // const [yScale, setYScale] = useState<"linear" | "log">("linear");
    

    return (
        <div className="app-container">
            {/* setXScale={setXScale} setYScale={setYScale}  to ma  być w toolbarze na dole*/}
            <Toolbar />
            <div className="chart-container">
                {/* <ScatterChartComponent xScale={xScale} yScale={yScale}/> */}
            </div>
        </div>
    );
};
export default App;