import React from 'react';
import './css/main.css';
import Controls from "./components/Controls";
import JSONDataService from "./services/JSONDataService";
import { DataType } from "./services/DataType";
import useRaf from "@rooks/use-raf";


const App = () => {
  const data: DataType = JSONDataService('./data/data.json');

  return (
    <div id="wrapper">
      <div id="canvasWrapper">
        <canvas id="canvasID" width="1024" height="640">canvas not available in this browser</canvas>
      </div>
      <div id="controls">
        <button id="playPause">pause</button>
        <div id="selectButton">
          {/*<select id="primitives">*/}
          {/*</select>*/}
        </div>
        <span className="fpsCounter">FPS : </span><span id="fpsCounterNb" className="fpsCounter" />
        <br/>
        <br/>
        <Controls />
      </div>
    </div>
  )
}

export default App;

