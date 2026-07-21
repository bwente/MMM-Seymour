/* global Module, Log */

Module.register("MMM-Seymour", {
  defaults: {
    theme: "default",
    selectorSize: "medium",
    showLabels: true,
    enableKeyboard: true,

    autoDismiss: false,
    autoDismissDelay: 5000,

    channels: []
  },

  getStyles() {
    return ["MMM-Seymour.css"];
  },

  getTemplate() {
    return "templates/selector.njk";
  },

  getTemplateData() {
    const themeBase = `/modules/MMM-Seymour/assets/themes/${this.config.theme}`;

    return {
      channels: this.config.channels.map((channel) => ({
        ...channel,
        thumbnailUrl: `${themeBase}/${channel.thumbnail}`
      })),
      activeIndex: this.activeIndex,
      isOpen: this.isOpen,
      showLabels: this.config.showLabels,
      selectorSize: this.config.selectorSize
    };
  },

  start() {
    this.activeIndex = 0;
    this.isOpen = false;
    this.currentPage = 0;
    this.dismissTimer = null;

    if (this.config.enableKeyboard) {
      this._boundKeyHandler = (e) => this.handleKeyEvent(e);
      document.addEventListener("keydown", this._boundKeyHandler);
    }

    Log.info("MMM-Seymour started");
  },

  suspend() {},

  /* -------------------------
   * Auto-dismiss helpers
   * ------------------------- */

  startAutoDismissTimer() {
    if (!this.config.autoDismiss) return;

    this.clearAutoDismissTimer();

    this.dismissTimer = setTimeout(() => {
      if (this.isOpen) {
        this.closeSelector();
      }
    }, this.config.autoDismissDelay);
  },

  clearAutoDismissTimer() {
    if (this.dismissTimer) {
      clearTimeout(this.dismissTimer);
      this.dismissTimer = null;
    }
  },

  /* -------------------------
   * Notifications
   * ------------------------- */

  notificationReceived(notification) {
    switch (notification) {
      case "SEYMOUR_PRESS":
        this.handleAction("PRESS");
        break;

      case "SEYMOUR_ROTATE_LEFT":
        this.handleAction("ROTATE_LEFT");
        break;

      case "SEYMOUR_ROTATE_RIGHT":
        this.handleAction("ROTATE_RIGHT");
        break;

      case "ATTENTION_ON":
        this.attentionOn();
        break;

      case "ATTENTION_OFF":
        this.attentionOff();
        break;
    }
  },

  /* -------------------------
   * Unified action handler
   * ------------------------- */

  handleAction(action) {
    if (action === "PRESS") {
      if (!this.isOpen) {
        this.openSelector();
      } else {
        this.activateChannel();
      }
      return;
    }

    if (!this.isOpen) return;

    if (action === "ROTATE_LEFT") {
      this.activeIndex =
        (this.activeIndex - 1 + this.config.channels.length) %
        this.config.channels.length;
      this.updateDom(0);
      this.startAutoDismissTimer();
      return;
    }

    if (action === "ROTATE_RIGHT") {
      this.activeIndex =
        (this.activeIndex + 1) % this.config.channels.length;
      this.updateDom(0);
      this.startAutoDismissTimer();
      return;
    }
  },

  /* -------------------------
   * Keyboard input
   * ------------------------- */

  handleKeyEvent(e) {
    const key = e.key;

    if (key === "Enter") {
      this.handleAction("PRESS");
      return;
    }

    if (key === "Escape") {
      if (this.isOpen) this.closeSelector();
      return;
    }

    if (key === "ArrowLeft") {
      this.handleAction("ROTATE_LEFT");
      return;
    }

    if (key === "ArrowRight") {
      this.handleAction("ROTATE_RIGHT");
      return;
    }
  },

  /* -------------------------
   * Selector control
   * ------------------------- */

  openSelector() {
    const wledIP = "http://wled-seymour.local";
    fetch(`${wledIP}/win&PL=1`).catch(err =>
      console.error("WLED Error:", err)
    );

    const idx = this.config.channels.findIndex(
      (c) => Number(c.page) === this.currentPage
    );

    if (idx !== -1) {
      this.activeIndex = idx;
    }

    this.isOpen = true;
    this.updateDom(150);
    this.startAutoDismissTimer();
  },

  closeSelector() {
    const wledIP = "http://wled-seymour.local";
    fetch(`${wledIP}/win&PL=2`).catch(err =>
      console.error("WLED Error:", err)
    );

    this.isOpen = false;
    this.clearAutoDismissTimer();
    this.updateDom(150);
  },

  /* -------------------------
   * Attention LED control
   * ------------------------- */

  attentionOn() {
    const wledIP = "http://wled-seymour.local";
    fetch(`${wledIP}/win&PL=3`).catch(err =>
      console.error("WLED Error:", err)
    );
  },

  attentionOff() {
    const wledIP = "http://wled-seymour.local";
    fetch(`${wledIP}/win&PL=2`).catch(err =>
      console.error("WLED Error:", err)
    );
  },

  activateChannel() {
    const channel = this.config.channels[this.activeIndex];
    if (!channel) return;

    const pageIndex = Number(channel.page);
    if (!Number.isFinite(pageIndex)) {
      console.error("[MMM-Seymour] Invalid channel.page:", channel.page, channel);
      return;
    }

    this.sendNotification("PAGE_CHANGED", Math.trunc(pageIndex));

    setTimeout(() => {
      this.closeSelector();
    }, 0);
  }
});
