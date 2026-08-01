// Everything that has to happen before Main can exist.
//
// The tab groups, the build labels and the field writer are all wired before any
// engine object is constructed, and the sky image is awaited because
// BackgroundRenderer takes a decoded HTMLImageElement rather than a URL. Keeping
// that sequence here is what lets src/index.ts be one line of ignition.
//
// The canvas is resolved exactly once, in this class, and handed on. Main used
// to repeat the same querySelector and the same instanceof guard with its own
// throw, so a missing canvas produced two different error messages depending on
// which check ran first.

import BackgroundRenderer from "@rendering/BackgroundRenderer";
import FieldWriter from "@ui/FieldWriter";
import TabGroup from "@ui/TabGroup";
import { BUILD_LABEL_DESKTOP, BUILD_LABEL_MOBILE } from "@ui/buildInfo";
import skyUrl from "@img/sky.avif";

// What boot hands to Main. Three inputs, so a named interface rather than three
// positional arguments (R4).
export interface BootContext {
  canvas: HTMLCanvasElement;
  backgroundRenderer: BackgroundRenderer;
  fields: FieldWriter;
}

class Bootstrapper {
  public async run(): Promise<BootContext> {
    this.setupTabGroups();

    // Created here rather than on Main: the build labels are written before Main
    // exists, and every collaborator that writes a field is handed this same
    // instance.
    const fields = new FieldWriter();

    // Written from one source rather than typed into both branches' markup.
    fields.write("buildDesktop", BUILD_LABEL_DESKTOP);
    fields.write("buildMobile", BUILD_LABEL_MOBILE);

    const skyImage = await this.loadImageAsset(skyUrl);
    const canvas = this.resolveCanvas();

    const backgroundRenderer = new BackgroundRenderer({
      width: canvas.width,
      height: canvas.height,
      skyImage,
    });

    return { canvas, backgroundRenderer, fields };
  }

  // The desktop inspector and the mobile tab bar are two independent groups over
  // one DOM tree: each writes its own attribute on #app and CSS does the rest, so
  // crossing the breakpoint never re-renders or re-binds anything.
  private setupTabGroups() {
    const app = document.getElementById("app");

    if (!app) {
      return;
    }

    const inspectorTabs = document.getElementById("inspectorTabs");

    if (inspectorTabs) {
      new TabGroup({
        tablist: inspectorTabs,
        root: app,
        attribute: "data-tab",
        initial: "shape",
      });
    }

    const mobileTabs = document.getElementById("mobileTabs");

    if (mobileTabs) {
      new TabGroup({
        tablist: mobileTabs,
        root: app,
        attribute: "data-mtab",
        initial: "shape",
      });
    }
  }

  private resolveCanvas(): HTMLCanvasElement {
    const canvas = document.querySelector("canvas");

    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error("Canvas element not found.");
    }

    return canvas;
  }

  private loadImageAsset(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = src;
    });
  }
}

export default Bootstrapper;
