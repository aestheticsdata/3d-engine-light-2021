interface FollowCursorTooltipOptions {
  target: HTMLInputElement;
  message: string;
  shouldShow: () => boolean;
  backgroundColor?: string;
  textColor?: string;
}

class FollowCursorTooltip {
  private readonly target: HTMLInputElement;
  private readonly shouldShow: () => boolean;
  private readonly tooltipNode: HTMLDivElement;

  constructor(options: FollowCursorTooltipOptions) {
    this.target = options.target;
    this.shouldShow = options.shouldShow;
    this.tooltipNode = document.createElement("div");
    this.tooltipNode.className = "hoverTooltip";
    this.tooltipNode.textContent = options.message;
    // Only set these when a caller actually asks for them. An inline style beats
    // the class rule, so defaulting here would pin the tooltip to white-on-black
    // and make .hoverTooltip in the stylesheet unreachable.
    if (options.backgroundColor !== undefined) {
      this.tooltipNode.style.backgroundColor = options.backgroundColor;
    }

    if (options.textColor !== undefined) {
      this.tooltipNode.style.color = options.textColor;
    }
    document.body.appendChild(this.tooltipNode);

    this.target.addEventListener("mouseleave", this.hide);
    this.target.addEventListener("blur", this.hide);
    this.target.addEventListener("mousemove", this.onMouseMove);
  }

  public hide = () => {
    this.tooltipNode.style.display = "none";
  };

  private onMouseMove = (event: MouseEvent) => {
    if (!this.shouldShow() || !this.isPointerNearThumb(event)) {
      this.hide();
      return;
    }

    this.tooltipNode.style.display = "block";
    this.positionTooltip(event);
  };

  private isPointerNearThumb(event: MouseEvent): boolean {
    const min = parseFloat(this.target.min || "0");
    const max = parseFloat(this.target.max || "100");
    const value = parseFloat(this.target.value || "0");

    if (max <= min) {
      return false;
    }

    const rect = this.target.getBoundingClientRect();
    const progress = (value - min) / (max - min);
    const thumbX = rect.left + rect.width * progress;
    const yInTrack = event.clientY >= rect.top - 6 && event.clientY <= rect.bottom + 6;
    const xNearThumb = Math.abs(event.clientX - thumbX) <= 14;

    return yInTrack && xNearThumb;
  }

  private positionTooltip(event: MouseEvent) {
    const gap = 10;
    const tooltipWidth = this.tooltipNode.offsetWidth;
    const tooltipHeight = this.tooltipNode.offsetHeight;
    const left = Math.max(8, event.clientX - tooltipWidth - gap);
    const top = Math.max(8, event.clientY - tooltipHeight / 2);

    this.tooltipNode.style.left = `${left}px`;
    this.tooltipNode.style.top = `${top}px`;
  }
}

export default FollowCursorTooltip;
