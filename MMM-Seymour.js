/* global Module, Log */

Module.register("MMM-Seymour", {
  defaults: {
    theme: "default",
    selectorSize: "medium",
    showLabels: true,
    enableKeyboard: true,
    enableTouch: true,
    showTouchLauncher: true,
    autoDismiss: false,
    autoDismissDelay: 5000,
    wled: {
      enabled: true,
      baseUrl: "http://wled-seymour.local",
      presets: {
        open: 1,
        idle: 2,
        attention: 3
      }
    },
    channels: []
  },

  getStyles() {
    return ["MMM-Seymour.css"];
  },

  getTemplate() {
    return "templates/selector.njk";
  },

  getTemplateData() {
    const channels = Array.isArray(this.config.channels) ? this.config.channels : [];
    const theme = typeof this.config.theme === "string" ? this.config.theme : "default";
    const themeBase = `modules/MMM-Seymour/assets/themes/${theme}`;

    return {
      channels: channels.map((channel) => ({
        ...channel,
        thumbnailUrl: `${themeBase}/${channel.thumbnail || "placeholder.png"}`
      })),
      activeIndex: this.activeIndex,
      isOpen: this.isOpen,
      showLabels: this.config.showLabels,
      selectorSize: this.config.selectorSize,
      enableTouch: this.config.enableTouch,
      showTouchLauncher: this.config.showTouchLauncher
    };
  },

  start() {
    if (!Array.isArray(this.config.channels)) this.config.channels = [];

    this.activeIndex = 0;
    this.isOpen = false;
    this.currentPage = null;
    this.maxPages = null;
    this.attentionActive = false;
    this.attentionSources = new Set();
    this.dismissTimer = null;
    this.closeTimer = null;

    if (this.config.enableKeyboard) {
      this._boundKeyHandler = (event) => this.handleKeyEvent(event);
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

    this.clearAutoDismissTimer();
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  },

  // MMM-pages may suspend modules that are not configured as fixed.
  suspend() {},

  notificationReceived(notification, payload, sender) {
    if (notification === "DOM_OBJECTS_CREATED") {
      this.bindTouchControls();
      return;
    }

    if (notification === "MAX_PAGES_CHANGED") {
      if (Number.isInteger(payload) && payload >= 0) this.maxPages = payload;
      return;
    }

    if (notification === "NEW_PAGE" || notification === "PAGE_NUMBER_IS") {
      if (Number.isInteger(payload) && payload >= 0) this.currentPage = payload;
      return;
    }

    const actions = {
      SEYMOUR_PRESS: "PRESS",
      SEYMOUR_ROTATE_LEFT: "ROTATE_LEFT",
      SEYMOUR_ROTATE_RIGHT: "ROTATE_RIGHT"
    };

    if (actions[notification]) {
      this.handleAction(actions[notification]);
      return;
    }

    if (notification === "ATTENTION_ON") this.attentionOn(this.getAttentionSource(payload, sender));
    if (notification === "ATTENTION_OFF") this.attentionOff(this.getAttentionSource(payload, sender));
  },

  handleAction(action) {
    if (action === "PRESS") {
      if (this.isOpen) this.activateChannel();
      else this.openSelector();
      return;
    }

    if (!this.isOpen || !this.config.channels.length) return;

    if (action === "ROTATE_LEFT") {
      this.activeIndex =
        (this.activeIndex - 1 + this.config.channels.length) % this.config.channels.length;
    } else if (action === "ROTATE_RIGHT") {
      this.activeIndex = (this.activeIndex + 1) % this.config.channels.length;
    } else {
      return;
    }

    this.refreshDom(0);
    this.startAutoDismissTimer();
  },

  handleKeyEvent(event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;

    const target = event.target;
    if (
      target &&
      (target.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName))
    ) {
      return;
    }

    const actionByKey = {
      Enter: "PRESS",
      ArrowLeft: "ROTATE_LEFT",
      ArrowRight: "ROTATE_RIGHT"
    };

    if (event.key === "Enter" && event.repeat) {
      if (this.isOpen) event.preventDefault();
      return;
    }

    if (event.key === "Escape") {
      if (this.isOpen) {
        this.closeSelector();
        event.preventDefault();
      }
      return;
    }

    const action = actionByKey[event.key];
    if (!action) return;

    const wasOpen = this.isOpen;
    this.handleAction(action);
    if (wasOpen || this.isOpen) event.preventDefault();
  },

  openSelector() {
    if (!this.config.channels.length) return;

    const currentIndex =
      this.currentPage === null
        ? -1
        : this.config.channels.findIndex(
            (channel) => this.getChannelPage(channel) === this.currentPage
          );

    if (currentIndex !== -1) this.activeIndex = currentIndex;
    else if (this.activeIndex >= this.config.channels.length) this.activeIndex = 0;

    this.isOpen = true;
    this.refreshDom(150);
    this.applyWledState();
    this.startAutoDismissTimer();
  },

  closeSelector() {
    this.isOpen = false;
    this.clearAutoDismissTimer();
    this.refreshDom(150);
    this.applyWledState();
  },

  refreshDom(animationSpeed) {
    this.updateDom(animationSpeed, () => {
      this.bindTouchControls();
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

  bindTouchControls() {
    if (this.config.enableTouch === false) return;

    const wrapper = document.getElementById(this.identifier);
    if (!wrapper || wrapper.dataset.seymourTouchBound === "true") return;

    wrapper.dataset.seymourTouchBound = "true";
    wrapper.addEventListener("click", (event) => {
      const target = event.target;
      if (!target || typeof target.closest !== "function") return;

      const launcher = target.closest("[data-seymour-action='open']");
      if (launcher) {
        this.openSelector();
        return;
      }

      const dismiss = target.closest("[data-seymour-action='dismiss']");
      if (dismiss) {
        this.closeSelector();
        return;
      }

      const channel = target.closest("[data-seymour-index]");
      if (!channel || !this.isOpen) return;

      const index = Number(channel.dataset.seymourIndex);
      if (!Number.isInteger(index) || index < 0 || index >= this.config.channels.length) return;

      this.activeIndex = index;
      this.activateChannel();
    });
  },

  startAutoDismissTimer() {
    if (!this.config.autoDismiss || !this.isOpen) return;

    this.clearAutoDismissTimer();
    const configuredDelay = Number(this.config.autoDismissDelay);
    const delay = Number.isFinite(configuredDelay) && configuredDelay > 0 ? configuredDelay : 5000;

    this.dismissTimer = setTimeout(() => {
      this.dismissTimer = null;
      if (this.isOpen) this.closeSelector();
    }, delay);
  },

  clearAutoDismissTimer() {
    if (!this.dismissTimer) return;
    clearTimeout(this.dismissTimer);
    this.dismissTimer = null;
  },

  getChannelPage(channel) {
    if (!channel || !Number.isInteger(channel.page) || channel.page < 0) return null;
    if (this.maxPages !== null && channel.page >= this.maxPages) return null;
    return channel.page;
  },

  activateChannel() {
    const channel = this.config.channels[this.activeIndex];
    const pageIndex = this.getChannelPage(channel);

    if (pageIndex === null) {
      console.error("[MMM-Seymour] Invalid channel.page:", channel && channel.page, channel);
      return;
    }

    this.sendNotification("PAGE_CHANGED", pageIndex);

    if (this.closeTimer) clearTimeout(this.closeTimer);
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null;
      this.closeSelector();
    }, 0);
  },

  getAttentionSource(payload, sender) {
    if (payload && typeof payload === "object" && typeof payload.source === "string") {
      return payload.source;
    }
    if (sender && typeof sender.identifier === "string") return sender.identifier;
    if (sender && typeof sender.name === "string") return sender.name;
    return "legacy";
  },

  attentionOn(source = "legacy") {
    this.attentionSources.add(source);
    this.attentionActive = this.attentionSources.size > 0;
    this.applyWledState();
  },

  attentionOff(source = "legacy") {
    this.attentionSources.delete(source);
    this.attentionActive = this.attentionSources.size > 0;
    this.applyWledState();
  },

  applyWledState() {
    const wled = this.config.wled || {};
    if (wled.enabled === false || typeof fetch !== "function") return;

    const defaults = this.defaults.wled;
    const baseUrl =
      typeof wled.baseUrl === "string" && wled.baseUrl
        ? wled.baseUrl.replace(/\/$/, "")
        : defaults.baseUrl;
    const presets = { ...defaults.presets, ...(wled.presets || {}) };
    const state = this.isOpen ? "open" : this.attentionActive ? "attention" : "idle";
    const preset = presets[state];

    if (!Number.isInteger(preset) || preset < 0) return;

    fetch(`${baseUrl}/win&PL=${preset}`).catch((error) => {
      console.error(`[MMM-Seymour] WLED ${state} error:`, error);
    });
  }
});
