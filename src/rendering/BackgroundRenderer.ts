class BackgroundRenderer {
  private readonly width: number;
  private readonly height: number;
  private readonly skyImage: HTMLImageElement | null;

  constructor(options: {
    width: number;
    height: number;
    skyImage?: HTMLImageElement | null;
  }) {
    this.width = options.width;
    this.height = options.height;
    this.skyImage = options.skyImage ?? null;
  }

  public render(context: CanvasRenderingContext2D) {
    context.save();
    context.clearRect(0, 0, this.width, this.height);

    this.renderSky(context);
    this.renderAtmosphere(context);
    this.renderFloor(context);
    this.renderVignette(context);

    context.restore();
  }

  private renderSky(context: CanvasRenderingContext2D) {
    const skyGradient = context.createLinearGradient(0, 0, 0, this.height);
    skyGradient.addColorStop(0, "#7db8ff");
    skyGradient.addColorStop(0.5, "#9bd3ff");
    skyGradient.addColorStop(0.82, "#f3d8e3");
    skyGradient.addColorStop(1, "#f1e8ee");
    context.fillStyle = skyGradient;
    context.fillRect(0, 0, this.width, this.height);

    if (!this.skyImage) {
      return;
    }

    const targetHeight = this.height * 0.62;
    const scale = Math.max(
      this.width / this.skyImage.width,
      targetHeight / this.skyImage.height,
    );
    const drawWidth = this.skyImage.width * scale;
    const drawHeight = this.skyImage.height * scale;
    const drawX = (this.width - drawWidth) / 2;
    const drawY = -drawHeight * 0.04;

    context.save();
    context.globalAlpha = 0.9;
    context.drawImage(this.skyImage, drawX, drawY, drawWidth, drawHeight);
    context.restore();
  }

  private renderAtmosphere(context: CanvasRenderingContext2D) {
    const horizonY = this.height * 0.56;

    const haze = context.createLinearGradient(0, horizonY - 40, 0, this.height);
    haze.addColorStop(0, "rgba(255,255,255,0)");
    haze.addColorStop(0.22, "rgba(255,235,245,0.58)");
    haze.addColorStop(0.5, "rgba(255,240,246,0.35)");
    haze.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = haze;
    context.fillRect(0, horizonY - 50, this.width, this.height - horizonY + 50);

    const horizonGlow = context.createLinearGradient(0, horizonY - 20, 0, horizonY + 20);
    horizonGlow.addColorStop(0, "rgba(255,255,255,0)");
    horizonGlow.addColorStop(0.5, "rgba(255,245,252,0.85)");
    horizonGlow.addColorStop(1, "rgba(255,255,255,0)");
    context.fillStyle = horizonGlow;
    context.fillRect(0, horizonY - 20, this.width, 40);
  }

  private renderFloor(context: CanvasRenderingContext2D) {
    const horizonY = this.height * 0.57;
    const centerX = this.width * 0.6;
    const focal = this.width * 0.95;
    const cameraHeight = 1.75;
    const cellWidth = 3.4;
    const cellDepth = 4.2;
    const nearZ =
      (cameraHeight * focal) / Math.max(1, this.height - horizonY) * 0.72;
    const farZ = 240;
    const halfColumns = 72;

    const projectGroundPoint = (x: number, z: number) => {
      return {
        x: centerX + (focal * x) / z,
        y: horizonY + (focal * cameraHeight) / z,
      };
    };

    const rowCount = Math.ceil((farZ - nearZ) / cellDepth);

    for (let row = rowCount - 1; row >= 0; row -= 1) {
      const zTop = nearZ + row * cellDepth;
      const zBottom = zTop + cellDepth;

      for (let col = -halfColumns; col < halfColumns; col += 1) {
        const xLeft = col * cellWidth;
        const xRight = (col + 1) * cellWidth;
        const topLeft = projectGroundPoint(xLeft, zTop);
        const topRight = projectGroundPoint(xRight, zTop);
        const bottomRight = projectGroundPoint(xRight, zBottom);
        const bottomLeft = projectGroundPoint(xLeft, zBottom);

        context.fillStyle =
          (row + col) % 2 === 0
            ? "rgba(244, 243, 238, 1)"
            : "rgba(122, 124, 128, 1)";
        context.beginPath();
        context.moveTo(topLeft.x, topLeft.y);
        context.lineTo(topRight.x, topRight.y);
        context.lineTo(bottomRight.x, bottomRight.y);
        context.lineTo(bottomLeft.x, bottomLeft.y);
        context.closePath();
        context.fill();
      }
    }

    const fadeStartY = horizonY + (this.height - horizonY) * 0.5;
    const transparencyMask = context.createLinearGradient(0, horizonY, 0, fadeStartY);
    transparencyMask.addColorStop(0, "rgba(0, 0, 0, 1)");
    transparencyMask.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.save();
    context.globalCompositeOperation = "destination-out";
    context.fillStyle = transparencyMask;
    context.fillRect(0, horizonY, this.width, fadeStartY - horizonY);
    context.restore();

    const floorFade = context.createLinearGradient(0, horizonY, 0, this.height);
    floorFade.addColorStop(0, "rgba(255, 225, 238, 0.22)");
    floorFade.addColorStop(0.18, "rgba(255, 255, 255, 0.06)");
    floorFade.addColorStop(1, "rgba(0, 0, 0, 0.02)");
    context.fillStyle = floorFade;
    context.fillRect(0, horizonY, this.width, this.height - horizonY + 4);
  }

  private renderVignette(context: CanvasRenderingContext2D) {
    const vignette = context.createRadialGradient(
      this.width * 0.5,
      this.height * 0.42,
      this.width * 0.25,
      this.width * 0.5,
      this.height * 0.42,
      this.width * 0.9,
    );
    vignette.addColorStop(0, "rgba(255,255,255,0)");
    vignette.addColorStop(1, "rgba(0,0,0,0.18)");
    context.fillStyle = vignette;
    context.fillRect(0, 0, this.width, this.height);
  }
}

export default BackgroundRenderer;
