import Mesh from "./primitives/Mesh";

class Controls {
  pitch: number;
  yaw: number;
  roll: number;
  mesh: Mesh;

  constructor(mesh: Mesh, pitch: number, yaw: number, roll: number) {
    this.pitch = pitch;
    this.yaw = yaw;
    this.roll = roll;
    this.mesh = mesh;

    document.querySelector('#focalSlider').addEventListener('change', (e: MouseEvent) => {
      console.log('focal', (e.currentTarget as HTMLInputElement).value);
      this.mesh.changeFocal(parseInt((e.currentTarget as HTMLInputElement).value));
    });

    document.querySelector('#zOffsetSlider').addEventListener('change', (e) => {
      console.log('offset Z', e.currentTarget.value);
      this.mesh.changeOffsetZ(parseInt((e.currentTarget as HTMLInputElement).value));
    })

    document.querySelector('#pitchSlider').addEventListener('change', (e) => {
      console.log('pitch', e.currentTarget.value);
      this.pitch = parseInt((e.currentTarget as HTMLInputElement).value);
    })

    document.querySelector('#yawSlider').addEventListener('change', (e) => {
      console.log('yaw', e.currentTarget.value);
      this.yaw = parseInt((e.currentTarget as HTMLInputElement).value);
    })

    document.querySelector('#rollSlider').addEventListener('change', (e) => {
      console.log('roll', e.currentTarget.value);
      this.roll = parseInt((e.currentTarget as HTMLInputElement).value);
    })
  }
}

export default Controls;

