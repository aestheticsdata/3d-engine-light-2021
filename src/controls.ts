class Controls {
  public attachListener(domID: string, callback: (value: number) => void) {
    const element = document.querySelector<HTMLInputElement>(domID);
    if (!element) {
      return;
    }

    const eventName = element.type === "range" ? "input" : "change";
    element.addEventListener(eventName, (e) => {
      callback(parseInt((e.currentTarget as HTMLInputElement).value, 10));
    });
  }

  public getNumericValue(domID: string): number | null {
    const element = document.querySelector<HTMLInputElement>(domID);
    if (!element) {
      return null;
    }

    return parseInt(element.value, 10);
  }

  public setNumericValue(domID: string, value: number) {
    const element = document.querySelector<HTMLInputElement>(domID);
    if (!element) {
      return;
    }

    element.value = String(value);
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
