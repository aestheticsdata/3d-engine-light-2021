import React from 'react';

const Controls = () => {
  return (
    <>
      <span className="sliderText">focal</span><input id="focalSlider" type="range" min="170" max="500" value="300"/>
      <span className="sliderText">z offset</span><input id="zOffsetSlider" type="range" min="-50" max="500" value="0"/>
      <span className="sliderText">pitch</span><input id="pitchSlider" type="range" min="0" max="800" value="400"/>
      <span className="sliderText">yaw</span><input id="yawSlider" type="range" min="0" max="800" value="400"/>
      <span className="sliderText">roll</span><input id="rollSlider" type="range" min="-1000" max="1200" value="200"/>
    </>
  )
}

export default Controls;
