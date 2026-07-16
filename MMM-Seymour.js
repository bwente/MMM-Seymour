/* global Module, Log */

Module.register("MMM-Seymour", {
  defaults: {
    selectorSize: "medium",
    showLabels: true,
    enableKeyboard: true,
    channels: []
  },

  getStyles() {
    return ["MMM-Seymour.css"];
  },

  getTemplate() {
    return "templates/selector.njk";
  },

  getTemplateData() {
    return {
      channels: this.config.channels,
      activeIndex: this.activeIndex,
      isOpen: this.isOpen,
      showLabels: this.config.showLabels,
      selectorSize: this.config.selectorSize
    };
  },

  start() {
    this.activeIndex = 0;
    this.isOpen = false;

    if (this.config.enableKeyboard) {
      this._boundKeyHandler = (e) => this.handleKeyEvent(e);
      document.addEventListener("keydown", this._boundKeyHandler);
    }

    Log.info("MMM-Seymour started");
  },

  stop() {
    if (this._boundKeyHandler) {
      document.removeEventListener("keydown", this._boundKeyHandler);
      this._boundKeyHandler = null;
    }
  },

  // Important: DO NOT remove the key listener on suspend.
  // MMM-pages may suspend modules that are not fixed.
  // If we remove the listener, Enter stops working.
  suspend() {},

  handleKeyEvent(e) {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;

    const target = e.target;
    if (
      target &&
      (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))
    ) {
      return;
    }

    const key = e.key;

    if (key === "Enter") {
      if (!this.isOpen) {
        if (!this.config.channels.length) return;
        this.openSelector();
      } else {
        this.activateChannel();
      }
      e.preventDefault();
      return;
    }

    if (key === "Escape") {
      if (this.isOpen) {
        this.closeSelector();
        e.preventDefault();
      }
      return;
    }

    if (!this.isOpen || !this.config.channels.length) return;

    if (key === "ArrowLeft") {
      this.activeIndex =
        (this.activeIndex - 1 + this.config.channels.length) %
        this.config.channels.length;
      this.updateDom(0);
      e.preventDefault();
      return;
    }

    if (key === "ArrowRight") {
      this.activeIndex =
        (this.activeIndex + 1) % this.config.channels.length;
      this.updateDom(0);
      e.preventDefault();
      return;
    }
  },

  openSelector() {
    if (!this.config.channels.length) return;
    if (this.activeIndex >= this.config.channels.length) this.activeIndex = 0;
    this.isOpen = true;
    this.updateDom(150);
  },

  closeSelector() {
    this.isOpen = false;
    this.updateDom(150);
  },

  activateChannel() {
    const channel = this.config.channels[this.activeIndex];
    if (!channel) return;

    const pageIndex = Number(channel.page);

    if (!Number.isFinite(pageIndex)) {
      console.error("[MMM-Seymour] Invalid channel.page:", channel.page, channel);
      return;
    }

    const intPage = Math.trunc(pageIndex);

    console.log("[MMM-Seymour] PAGE_CHANGED ->", intPage, "channel:", channel);

    this.sendNotification("PAGE_CHANGED", intPage);

    // Close selector on next tick so PAGE_CHANGED is not affected by our updateDom
    setTimeout(() => {
      this.closeSelector();
    }, 0);
  }
});
