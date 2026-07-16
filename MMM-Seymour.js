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
    if (!Array.isArray(this.config.channels)) this.config.channels = [];

    this.activeIndex = 0;
    this.isOpen = false;
    this.currentPage = null;
    this.maxPages = null;
    this._closeTimer = null;

    if (this.config.enableKeyboard) {
      this._boundKeyHandler = (e) => this.handleKeyEvent(e);
      document.addEventListener("keydown", this._boundKeyHandler);
    }

    this.sendNotification("QUERY_PAGE_NUMBER");

    Log.info("MMM-Seymour started");
  },

  stop() {
    if (this._boundKeyHandler) {
      document.removeEventListener("keydown", this._boundKeyHandler);
      this._boundKeyHandler = null;
    }

    if (this._closeTimer) {
      clearTimeout(this._closeTimer);
      this._closeTimer = null;
    }
  },

  // Keep keyboard controls available if another integration suspends the module.
  suspend() {},

  notificationReceived(notification, payload) {
    if (notification === "MAX_PAGES_CHANGED") {
      if (Number.isInteger(payload) && payload >= 0) this.maxPages = payload;
      return;
    }

    if (notification === "NEW_PAGE" || notification === "PAGE_NUMBER_IS") {
      if (Number.isInteger(payload) && payload >= 0) this.currentPage = payload;
    }
  },

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

    if (key === "Enter" && e.repeat) {
      if (this.isOpen) e.preventDefault();
      return;
    }

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
      this.refreshDom(0);
      e.preventDefault();
      return;
    }

    if (key === "ArrowRight") {
      this.activeIndex =
        (this.activeIndex + 1) % this.config.channels.length;
      this.refreshDom(0);
      e.preventDefault();
      return;
    }
  },

  openSelector() {
    if (!this.config.channels.length) return;

    const currentIndex =
      this.currentPage === null
        ? -1
        : this.config.channels.findIndex(
            (channel) => this.getChannelPage(channel) === this.currentPage
          );

    if (currentIndex !== -1) {
      this.activeIndex = currentIndex;
    } else if (this.activeIndex >= this.config.channels.length) {
      this.activeIndex = 0;
    }

    this.isOpen = true;
    this.refreshDom(150);
  },

  closeSelector() {
    this.isOpen = false;
    this.refreshDom(150);
  },

  refreshDom(animationSpeed) {
    this.updateDom(animationSpeed, () => {
      if (!this.isOpen) return;

      const wrapper = document.getElementById(this.identifier);
      const activeItem = wrapper && wrapper.querySelector(".seymour-item.active");
      if (activeItem) {
        activeItem.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center"
        });
      }
    });
  },

  getChannelPage(channel) {
    if (!channel) return null;

    const pageIndex = channel.page;
    if (!Number.isInteger(pageIndex) || pageIndex < 0) return null;
    if (this.maxPages !== null && pageIndex >= this.maxPages) return null;

    return pageIndex;
  },

  activateChannel() {
    const channel = this.config.channels[this.activeIndex];
    if (!channel) return;

    const pageIndex = this.getChannelPage(channel);

    if (pageIndex === null) {
      console.error("[MMM-Seymour] Invalid channel.page:", channel.page, channel);
      return;
    }

    console.log("[MMM-Seymour] PAGE_CHANGED ->", pageIndex, "channel:", channel);

    this.sendNotification("PAGE_CHANGED", pageIndex);

    // Close selector on next tick so PAGE_CHANGED is not affected by our updateDom
    if (this._closeTimer) clearTimeout(this._closeTimer);
    this._closeTimer = setTimeout(() => {
      this._closeTimer = null;
      this.closeSelector();
    }, 0);
  }
});
