import Mesh from "./primitives/Mesh";

class Controls {
  attachListener(domID: string, callback, mesh?: Mesh) {
    document.querySelector(domID).addEventListener('change', (e) => {
      mesh ?
        mesh[callback](parseInt((e.currentTarget as HTMLInputElement).value))
        :
        callback(parseInt((e.currentTarget as HTMLInputElement).value));
    })
  }

  createSelectButton(primitiveName, putObjectToScene) {
    // https://stackoverflow.com/a/49461484/5671836
    const primitives = document.querySelector('#primitives');
    primitiveName.forEach(primitive => {
      const option = '<option name="'+primitive+'">'+primitive+'</option>';
      primitives.insertAdjacentHTML('beforeend', option);
    });
    primitives.addEventListener('change', function (e) {
      e.preventDefault();
      putObjectToScene((e.currentTarget as HTMLSelectElement).value);
    });
  };
}

export default Controls;

