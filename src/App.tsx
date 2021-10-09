import React from 'react';
import './css/main.css';
import Controls from "./components/Controls";
import JSONDataService from "./services/JSONDataService";
import { DataType } from "./services/DataType";
import useRaf from "@rooks/use-raf";
import { Stage, Container, Sprite } from '@inlet/react-pixi'


const App = () => {
  const data: DataType = JSONDataService('./data/data.json');
  const stageProps = {
    height: 1024,
    width: 640,
    options: {
      backgroundAlpha: 0,
      antialias: true,
    },
  }

  return (
    <div id="wrapper">
      <div id="canvasWrapper">
        <Stage
          {...stageProps}
        >
          <Sprite
            image="https://s3-us-west-2.amazonaws.com/s.cdpn.io/693612/coin.png"
          />
        </Stage>
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

