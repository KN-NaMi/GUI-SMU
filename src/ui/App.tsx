import Toolbar from "./Toolbar";
import './App.css'
import ScatterChart from "./ScatterChart";
import { useState } from "react";

const App: React.FC = () => {

    const [xScaleType, setXScaleType] = useState<"linear" | "log">("linear");
    const [yScaleType, setYScaleType] = useState<"linear" | "log">("linear");
    
    return (
        <div className="app-container">
            <Toolbar 
                xScaleType={xScaleType}
                yScaleType={yScaleType}
                setXScaleType={setXScaleType}
                setYScaleType={setYScaleType}
            />
            <div className="chart-container">
                <ScatterChart 
                    xScaleType={xScaleType}
                    yScaleType={yScaleType}
                />
            </div>
        </div>
    );
};
export default App;