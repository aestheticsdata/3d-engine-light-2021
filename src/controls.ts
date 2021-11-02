import Mesh from "./primitives/Mesh";

class Controls {
  mesh: Mesh;

  constructor(mesh: Mesh, changePitch, changeYaw, changeRoll) {
    this.mesh = mesh;

    document.querySelector('#focalSlider').addEventListener('change', (e) => {
      this.mesh.changeFocal(parseInt((e.currentTarget as HTMLInputElement).value));
    });

    document.querySelector('#zOffsetSlider').addEventListener('change', (e) => {
      this.mesh.changeOffsetZ(parseInt((e.currentTarget as HTMLInputElement).value));
    })

    document.querySelector('#pitchSlider').addEventListener('change', (e) => {
      changePitch(parseInt((e.currentTarget as HTMLInputElement).value));
    })

    document.querySelector('#yawSlider').addEventListener('change', (e) => {
      changeYaw(parseInt((e.currentTarget as HTMLInputElement).value));
    })

    document.querySelector('#rollSlider').addEventListener('change', (e) => {
      changeRoll(parseInt((e.currentTarget as HTMLInputElement).value));
    })
  }
}

export default Controls;

