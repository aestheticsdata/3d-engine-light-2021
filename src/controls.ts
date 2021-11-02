import Mesh from "./primitives/Mesh";

class Controls {
  constructor(mesh: Mesh, changePitch, changeYaw, changeRoll) {
    this.attachListener('#focalSlider', 'changeFocal', mesh);
    this.attachListener('#zOffsetSlider', 'changeOffsetZ', mesh);
    this.attachListener('#pitchSlider', changePitch);
    this.attachListener('#yawSlider', changeYaw);
    this.attachListener('#rollSlider', changeRoll);
  }

  attachListener(domID, callback, mesh?) {
    document.querySelector(domID).addEventListener('change', (e) => {
      mesh ?
        mesh[callback](parseInt((e.currentTarget as HTMLInputElement).value))
        :
        callback(parseInt((e.currentTarget as HTMLInputElement).value));
    })
  }
}

export default Controls;

