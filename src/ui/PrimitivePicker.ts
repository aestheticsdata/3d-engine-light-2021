// The primitive <select>.
//
// It replaces a method called `createSelectButton` that created nothing and
// touched no button: it appended <option> nodes to an existing <select>, and it
// was the only one of its four siblings to hardcode its selector instead of
// taking one.

export interface PrimitivePickerOptions {
  selector: string;
}

class PrimitivePicker {
  private readonly select: HTMLSelectElement | null;
  private notify: (primitive: string) => void;
  private listening: boolean;

  constructor(options: PrimitivePickerOptions) {
    this.select = document.querySelector<HTMLSelectElement>(options.selector);
    this.notify = () => {};
    this.listening = false;
  }

  // replaceChildren, not append: the old version built each option by
  // interpolating the name into a markup string and inserting it, so a second
  // call doubled the list and a name carrying markup would have been parsed as
  // markup. `new Option` takes the name as text and cannot do either.
  //
  // The change listener is registered once even when populate runs again,
  // because a second registration would fire the callback twice per pick.
  public populate(names: string[], onChange: (primitive: string) => void) {
    this.notify = onChange;

    const select = this.select;

    if (!select) {
      return;
    }

    select.replaceChildren();
    names.forEach((name) => select.add(new Option(name, name)));

    if (this.listening) {
      return;
    }

    select.addEventListener("change", this.onSelectionChange);
    this.listening = true;
  }

  // An arrow property: it is handed to addEventListener and would lose its
  // `this` as a plain method.
  private onSelectionChange = (event: Event) => {
    event.preventDefault();
    this.notify((event.currentTarget as HTMLSelectElement).value);
  };
}

export default PrimitivePicker;
