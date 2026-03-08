class Controls {
  public attachListener(domID: string, callback: (value: number) => void) {
    const element = document.querySelector<HTMLInputElement>(domID);
    if (!element) {
      return;
    }

    element.addEventListener("change", (e) => {
      callback(parseInt((e.currentTarget as HTMLInputElement).value, 10));
    });
  }

  public createSelectButton(
    primitiveNames: string[],
    putObjectToScene: (primitive: string) => void,
  ) {
    const primitives = document.querySelector<HTMLSelectElement>("#primitives");
    if (!primitives) {
      return;
    }

    primitiveNames.forEach((primitive) => {
      const option = `<option value="${primitive}">${primitive}</option>`;
      primitives.insertAdjacentHTML("beforeend", option);
    });

    primitives.addEventListener("change", (e) => {
      e.preventDefault();
      putObjectToScene((e.currentTarget as HTMLSelectElement).value);
    });
  }
}

export default Controls;
