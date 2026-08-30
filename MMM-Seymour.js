/* global Module, Log */

Module.register("MMM-Seymour", {
  requiresVersion: "2.25.0",

  defaults: {
    theme: "default",
    selectorSize: "medium",
    showLabels: true,
    enableKeyboard: true,
    pageChangeNotification: "PAGE_CHANGED",
    enableTouch: true,
    showTouchLauncher: true,
    autoDismiss: false,
    autoDismissDelay: 5000,
    idleReturn: {
      enabled: false,
      page: 0,
      delay: 300000
    },
    interaction: {
      enabled: true,
      doublePressDelay: 300,
      timeout: 10000,
      label: "CONTROL MODE"
    },
    systemPanel: {
      enabled: true,
      triplePressDelay: 650,
      autoDismissDelay: 20000,
      title: "System",
      showDiagnostics: true,
      actions: [
        { id: "volumeDown", label: "Volume down", notification: "SEYMOUR_SYSTEM_VOLUME_DOWN" },
        { id: "volumeUp", label: "Volume up", notification: "SEYMOUR_SYSTEM_VOLUME_UP" },
        { id: "quiet", label: "Quiet mode", notification: "SEYMOUR_SYSTEM_QUIET_TOGGLE" },
        { id: "display", label: "Display sleep", notification: "SEYMOUR_SYSTEM_DISPLAY_SLEEP" },
        { id: "restart", label: "Restart MagicMirror", notification: "SEYMOUR_SYSTEM_RESTART_MM", confirm: true },
        { id: "reboot", label: "Reboot Seymour", notification: "SEYMOUR_SYSTEM_REBOOT", confirm: true },
        { id: "shutdown", label: "Shut down", notification: "SEYMOUR_SYSTEM_SHUTDOWN", confirm: true }
      ]
    },
    timer: {
      page: null,
      warningSeconds: 10,
      focusOnWarning: true,
      focusOnFinish: true,
      attentionOnFinish: true
    },
    remoteControl: {
      enabled: true
    },
    selectorLifecycle: {
      open: [],
      close: []
    },
    wled: {
      enabled: false,
      baseUrl: "http://wled-seymour.local",
      heartbeatInterval: 60000,
      presets: {
        open: 1,
        idle: 2,
        attention: 3,
        timerWarning: null,
        timerFinished: null,
        control: null,
        system: null,
        focusing: null,
        breakActive: null,
        breakFinished: null
      }
    },
    channels: []
  },

  getStyles() {
    return ["MMM-Seymour.css"];
  },

  getTranslations() {
    return { en: "translations/en.json" };
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
      interactionActive: this.interactionActive,
      interactionLabel: this.config.interaction && this.config.interaction.label !== "CONTROL MODE"
        ? this.config.interaction.label
        : this.translate("CONTROL_MODE"),
      showLabels: this.config.showLabels,
      systemOpen: this.systemOpen,
      systemTitle: this.config.systemPanel && this.config.systemPanel.title !== "System"
        ? this.config.systemPanel.title
        : this.translate("SYSTEM"),
      systemActions: this.getSystemActions().map((action, index) => ({
        ...action,
        active: index === this.systemIndex,
        confirming: this.systemConfirmAction === action.id
      })),
      systemInfo: this.getSystemInfoTemplateData(),
      selectorSize: this.config.selectorSize,
      enableTouch: this.config.enableTouch,
      showTouchLauncher: this.config.showTouchLauncher,
      labels: {
        openChannels: this.translate("OPEN_CHANNELS"),
        systemInformation: this.translate("SYSTEM_INFORMATION"),
        status: this.translate("STATUS"),
        loading: this.translate("LOADING"),
        host: this.translate("HOST"),
        network: this.translate("NETWORK"),
        uptime: this.translate("UPTIME"),
        memory: this.translate("MEMORY"),
        cpuLoad: this.translate("CPU_LOAD"),
        temperature: this.translate("TEMPERATURE"),
        software: this.translate("SOFTWARE"),
        systemActions: this.translate("SYSTEM_ACTIONS"),
        confirm: this.translate("CONFIRM"),
        systemHint: this.translate("SYSTEM_HINT"),
        channels: this.translate("CHANNELS"),
        availableChannels: this.translate("AVAILABLE_CHANNELS"),
        unnamedChannel: this.translate("UNNAMED_CHANNEL")
      }
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
    this.idleReturnTimer = null;
    this.closeTimer = null;
    this.timerFocusTimer = null;
    this.timerWarningFocused = false;
    this.timerWledState = null;
    this.focusBreakWledState = null;
    this.interactionActive = false;
    this.interactionPage = null;
    this.interactionTimer = null;
    this.pendingPressTimer = null;
    this.pressCount = 0;
    this.systemOpen = false;
    this.systemIndex = 0;
    this.systemConfirmAction = null;
    this.systemDismissTimer = null;
    this.systemInfo = null;
    this.domFocusIndex = -1;
    this.domFocusedElement = null;
    this.domFocusObserver = null;
    this.wledHeartbeatTimer = null;
    this.wledConnected = null;

    if (this.config.enableKeyboard) {
      this._boundKeyHandler = (event) => {
        this.noteUserActivity();
        this.handleKeyEvent(event);
      };
      document.addEventListener("keydown", this._boundKeyHandler);
    }

    this._boundIdleActivityHandler = () => this.noteUserActivity();
    document.addEventListener("pointerdown", this._boundIdleActivityHandler, { passive: true });

    this.sendNotification("QUERY_PAGE_NUMBER");
    this.registerRemoteControlApi();
    this.startWledHeartbeat();
    Log.info("MMM-Seymour started");
  },

  stop() {
    if (this._boundKeyHandler) {
      document.removeEventListener("keydown", this._boundKeyHandler);
      this._boundKeyHandler = null;
    }
    if (this._boundIdleActivityHandler) {
      document.removeEventListener("pointerdown", this._boundIdleActivityHandler);
      this._boundIdleActivityHandler = null;
    }

    this.clearAutoDismissTimer();
    this.clearIdleReturnTimer();
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
    if (this.timerFocusTimer) {
      clearTimeout(this.timerFocusTimer);
      this.timerFocusTimer = null;
    }
    this.clearPendingPress();
    this.clearSystemDismissTimer();
    this.clearInteractionTimer();
    this.clearDomFocus();
    this.stopWledHeartbeat();
  },

  // MMM-pages may suspend modules that are not configured as fixed.
  suspend() {},

  notificationReceived(notification, payload, sender) {
    if (notification === "DOM_OBJECTS_CREATED") {
      this.bindTouchControls();
      return;
    }

    if (notification === "MODULE_DOM_UPDATED") {
      this.bindTouchControls();
      if (this.isOpen) {
        this.centerActiveItem(document.getElementById(this.identifier));
      }
      return;
    }

    if (notification === "MAX_PAGES_CHANGED") {
      if (Number.isInteger(payload) && payload >= 0) this.maxPages = payload;
      return;
    }

    if (notification === "NEW_PAGE" || notification === "PAGE_NUMBER_IS") {
      if (Number.isInteger(payload) && payload >= 0) {
        if (this.currentPage !== null && payload !== this.currentPage) {
          this.exitInteraction({ notify: true, refresh: false });
        }
        this.currentPage = payload;
        this.startIdleReturnTimer();
      }
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

    if (notification === "SEYMOUR_OPEN") {
      this.openSelector();
      return;
    }

    if (notification === "SEYMOUR_CLOSE") {
      this.closeSelector();
      return;
    }

    if (notification === "SEYMOUR_SELECT") {
      this.selectRemoteChannel(payload);
      return;
    }

    if (notification === "SEYMOUR_SYSTEM_OPEN") {
      this.openSystemPanel();
      return;
    }

    if (notification === "SEYMOUR_SYSTEM_CLOSE") {
      this.closeSystemPanel();
      return;
    }

    if (notification.startsWith("KITCHEN_TIMER_")) {
      this.handleTimerNotification(notification, payload);
      return;
    }

    if (this.isFocusBreakNotification(notification)) {
      this.handleFocusBreakNotification(notification, payload);
      return;
    }

    if (notification === "ATTENTION_ON") this.attentionOn(this.getAttentionSource(payload, sender));
    if (notification === "ATTENTION_OFF") this.attentionOff(this.getAttentionSource(payload, sender));
  },

  socketNotificationReceived(notification, payload) {
    if (notification !== "SEYMOUR_SYSTEM_INFO") return;
    this.systemInfo = payload && typeof payload === "object" ? payload : null;
    if (this.systemOpen) this.refreshDom(0);
  },

  registerRemoteControlApi() {
    if (this.config.remoteControl && this.config.remoteControl.enabled === false) return;

    this.sendNotification("REGISTER_API", {
      module: this.name,
      path: "seymour",
      actions: {
        open: {
          method: "GET",
          notification: "SEYMOUR_OPEN",
          prettyName: "Open Channel Selector"
        },
        close: {
          method: "GET",
          notification: "SEYMOUR_CLOSE",
          prettyName: "Close Channel Selector"
        },
        previous: {
          method: "GET",
          notification: "SEYMOUR_ROTATE_LEFT",
          prettyName: "Previous Channel"
        },
        next: {
          method: "GET",
          notification: "SEYMOUR_ROTATE_RIGHT",
          prettyName: "Next Channel"
        },
        activate: {
          method: "GET",
          notification: "SEYMOUR_PRESS",
          prettyName: "Open or Activate Channel"
        },
        select: {
          method: "POST",
          notification: "SEYMOUR_SELECT",
          prettyName: "Select Channel by Page"
        },
        system: {
          method: "GET",
          notification: "SEYMOUR_SYSTEM_OPEN",
          prettyName: "Open System Panel"
        }
      }
    });
  },

  selectRemoteChannel(payload) {
    const candidate =
      payload && typeof payload === "object"
        ? payload.page !== undefined
          ? payload.page
          : payload.param
        : payload;
    const page =
      typeof candidate === "string" && candidate.trim() !== "" ? Number(candidate) : candidate;

    if (!Number.isInteger(page) || page < 0) {
      console.error("[MMM-Seymour] Invalid remote page:", candidate);
      return;
    }

    const index = this.config.channels.findIndex(
      (channel) => this.getChannelPage(channel) === page
    );
    if (index === -1) {
      console.error("[MMM-Seymour] Remote page is not configured as a channel:", page);
      return;
    }

    this.activeIndex = index;
    this.activateChannel();
  },

  handleAction(action) {
    this.noteUserActivity();
    if (this.systemOpen) {
      if (action === "PRESS") {
        this.queueSystemPress();
        return true;
      }
      if (action === "ROTATE_LEFT") return this.moveSystemSelection(-1);
      if (action === "ROTATE_RIGHT") return this.moveSystemSelection(1);
      return false;
    }

    if (action === "PRESS") {
      this.queuePress();
      return true;
    }

    if (this.isOpen && this.config.channels.length) {
      if (action === "ROTATE_LEFT") {
        this.activeIndex =
          (this.activeIndex - 1 + this.config.channels.length) % this.config.channels.length;
      } else if (action === "ROTATE_RIGHT") {
        this.activeIndex = (this.activeIndex + 1) % this.config.channels.length;
      } else {
        return false;
      }

      this.refreshDom(0);
      this.startAutoDismissTimer();
      return true;
    }

    const controls = this.getCurrentChannelControls();
    if (!controls) return false;

    if (this.interactionActive && controls.mode === "focus") {
      if (action === "ROTATE_LEFT") return this.moveDomFocus(-1, controls);
      if (action === "ROTATE_RIGHT") return this.moveDomFocus(1, controls);
      return false;
    }

    const notification = this.interactionActive
      ? action === "ROTATE_LEFT"
        ? controls.rotateLeft
        : action === "ROTATE_RIGHT"
          ? controls.rotateRight
          : null
      : action === "ROTATE_LEFT"
        ? controls.directRotateLeft
        : action === "ROTATE_RIGHT"
          ? controls.directRotateRight
          : null;

    if (typeof notification !== "string" || !notification) return false;
    this.sendNotification(notification);
    if (this.interactionActive) this.startInteractionTimer();
    return true;
  },

  getCurrentChannel() {
    if (!Number.isInteger(this.currentPage) || this.currentPage < 0) return null;
    return this.config.channels.find(
      (channel) => this.getChannelPage(channel) === this.currentPage
    ) || null;
  },

  getCurrentChannelControls() {
    const interaction = this.config.interaction || {};
    if (interaction.enabled === false) return null;
    const channel = this.getCurrentChannel();
    if (!channel || !channel.controls || typeof channel.controls !== "object") return null;
    return channel.controls;
  },

  queuePress() {
    this.pressCount += 1;
    if (this.pressCount >= 3 && this.systemPanelEnabled()) {
      this.clearPendingPress();
      this.pressCount = 0;
      this.openSystemPanel();
      return;
    }
    if (this.pendingPressTimer) clearTimeout(this.pendingPressTimer);
    const configuredDelay = Number((this.config.systemPanel || {}).triplePressDelay);
    const delay = Number.isFinite(configuredDelay) && configuredDelay >= 0 ? configuredDelay : 650;
    this.pendingPressTimer = setTimeout(() => {
      this.pendingPressTimer = null;
      const count = this.pressCount;
      this.pressCount = 0;
      if (count >= 2) this.handleDoublePress();
      else this.handleSinglePress();
    }, delay);
  },

  handleSinglePress() {
    if (this.isOpen) return this.activateChannel();
    const controls = this.getCurrentChannelControls();
    if (this.interactionActive && controls) {
      if (controls.mode === "focus") this.activateDomFocus(controls);
      else if (typeof controls.press === "string" && controls.press) this.sendNotification(controls.press);
      this.startInteractionTimer();
      return;
    }
    this.openSelector();
  },

  handleDoublePress() {
    const controls = this.getCurrentChannelControls();
    if (!controls) {
      this.openSelector();
      return;
    }
    if (this.interactionActive) this.exitInteraction({ controls });
    else this.enterInteraction(controls);
  },

  queueSystemPress() {
    this.pressCount += 1;
    if (this.pressCount >= 3) {
      this.clearPendingPress();
      this.closeSystemPanel();
      return;
    }
    if (this.pendingPressTimer) clearTimeout(this.pendingPressTimer);
    const configuredDelay = Number((this.config.systemPanel || {}).triplePressDelay);
    const delay = Number.isFinite(configuredDelay) && configuredDelay >= 0 ? configuredDelay : 650;
    this.pendingPressTimer = setTimeout(() => {
      this.pendingPressTimer = null;
      const count = this.pressCount;
      this.pressCount = 0;
      if (count === 1) this.activateSystemAction();
    }, delay);
  },

  clearPendingPress() {
    if (this.pendingPressTimer) clearTimeout(this.pendingPressTimer);
    this.pendingPressTimer = null;
    this.pressCount = 0;
  },

  enterInteraction(controls = this.getCurrentChannelControls()) {
    if (!controls) return;
    this.clearIdleReturnTimer();
    this.interactionActive = true;
    this.interactionPage = this.currentPage;
    if (typeof controls.enter === "string" && controls.enter) {
      this.sendNotification(controls.enter);
    }
    if (controls.mode === "focus") this.initializeDomFocus(controls);
    this.refreshDom(0);
    this.applyWledState();
    this.startInteractionTimer();
  },

  exitInteraction(options = {}) {
    this.clearPendingPress();
    if (!this.interactionActive) return;
    const controls = options.controls || this.getCurrentChannelControls();
    this.interactionActive = false;
    this.interactionPage = null;
    this.clearInteractionTimer();
    this.clearDomFocus();
    if (options.notify !== false && controls && typeof controls.exit === "string" && controls.exit) {
      this.sendNotification(controls.exit);
    }
    if (options.refresh !== false) this.refreshDom(0);
    this.applyWledState();
    this.startIdleReturnTimer();
  },

  startInteractionTimer() {
    this.clearInteractionTimer();
    if (!this.interactionActive) return;
    const configuredTimeout = Number((this.config.interaction || {}).timeout);
    if (!Number.isFinite(configuredTimeout) || configuredTimeout <= 0) return;
    this.interactionTimer = setTimeout(() => {
      this.interactionTimer = null;
      this.exitInteraction();
    }, configuredTimeout);
  },

  clearInteractionTimer() {
    if (!this.interactionTimer) return;
    clearTimeout(this.interactionTimer);
    this.interactionTimer = null;
  },

  systemPanelEnabled() {
    return !this.config.systemPanel || this.config.systemPanel.enabled !== false;
  },

  getSystemActions() {
    const actions = this.config.systemPanel && this.config.systemPanel.actions;
    return Array.isArray(actions)
      ? actions.filter((action) => action && typeof action.notification === "string" && action.notification)
        .map((action) => ({
          ...action,
          label: this.translate({
            "Volume down": "VOLUME_DOWN",
            "Volume up": "VOLUME_UP",
            "Quiet mode": "QUIET_MODE",
            "Display sleep": "DISPLAY_SLEEP",
            "Restart MagicMirror": "RESTART_MAGICMIRROR",
            "Reboot Seymour": "REBOOT_SEYMOUR",
            "Shut down": "SHUT_DOWN"
          }[action.label] || action.label)
        }))
      : [];
  },

  getSystemInfoTemplateData() {
    if ((this.config.systemPanel || {}).showDiagnostics === false) return null;
    const info = this.systemInfo;
    if (!info) return { loading: true };
    const addresses = Array.isArray(info.addresses) ? info.addresses : [];
    const primaryAddress = addresses.find((address) => address.includes(".")) || addresses[0];
    return {
      loading: false,
      hostname: info.hostname || this.translate("UNKNOWN"),
      primaryAddress: primaryAddress || this.translate("UNAVAILABLE"),
      secondaryAddresses: addresses.filter((address) => address !== primaryAddress).join(" · "),
      uptime: this.formatSystemUptime(info.uptimeSeconds),
      memory: this.formatSystemMemory(info.memory),
      cpuLoad:
        Number.isFinite(info.cpuLoadPercent) ? `${Math.round(info.cpuLoadPercent)}%` : this.translate("UNAVAILABLE"),
      temperature:
        Number.isFinite(info.temperatureC) ? `${Math.round(info.temperatureC)}°C` : this.translate("UNAVAILABLE"),
      magicMirrorVersion: info.magicMirrorVersion || null,
      nodeVersion: info.nodeVersion || null
    };
  },

  formatSystemUptime(seconds) {
    const totalMinutes = Math.max(0, Math.floor(Number(seconds) / 60));
    if (!Number.isFinite(totalMinutes)) return this.translate("UNAVAILABLE");
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days) return `${days}d ${hours}h`;
    if (hours) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  },

  formatSystemMemory(memory) {
    if (!memory || !Number.isFinite(memory.usedBytes) || !Number.isFinite(memory.totalBytes)) {
      return this.translate("UNAVAILABLE");
    }
    const gibibyte = 1024 ** 3;
    return `${(memory.usedBytes / gibibyte).toFixed(1)} / ${(memory.totalBytes / gibibyte).toFixed(1)} GB`;
  },

  openSystemPanel() {
    if (!this.systemPanelEnabled() || !this.getSystemActions().length) return false;
    this.clearIdleReturnTimer();
    this.clearPendingPress();
    if (this.isOpen) this.closeSelector();
    this.exitInteraction({ notify: true, refresh: false });
    this.systemOpen = true;
    this.clearIdleReturnTimer();
    this.systemIndex = Math.min(this.systemIndex, this.getSystemActions().length - 1);
    this.systemConfirmAction = null;
    this.sendNotification("SEYMOUR_SYSTEM_OPENED", { page: this.currentPage });
    if ((this.config.systemPanel || {}).showDiagnostics !== false) {
      this.sendSocketNotification("SEYMOUR_GET_SYSTEM_INFO");
    }
    this.refreshDom(150);
    this.applyWledState();
    this.startSystemDismissTimer();
    return true;
  },

  closeSystemPanel() {
    if (!this.systemOpen) return false;
    this.systemOpen = false;
    this.systemConfirmAction = null;
    this.clearSystemDismissTimer();
    this.sendNotification("SEYMOUR_SYSTEM_CLOSED", { page: this.currentPage });
    this.refreshDom(150);
    this.applyWledState();
    this.startIdleReturnTimer();
    return true;
  },

  moveSystemSelection(delta) {
    const actions = this.getSystemActions();
    if (!actions.length) return false;
    this.systemIndex = (this.systemIndex + delta + actions.length) % actions.length;
    this.systemConfirmAction = null;
    this.refreshDom(0);
    this.startSystemDismissTimer();
    return true;
  },

  activateSystemAction(index = this.systemIndex) {
    const actions = this.getSystemActions();
    const action = actions[index];
    if (!action) return false;
    this.systemIndex = index;
    if (action.confirm === true && this.systemConfirmAction !== action.id) {
      this.systemConfirmAction = action.id;
      this.refreshDom(0);
      this.startSystemDismissTimer();
      return true;
    }
    this.systemConfirmAction = null;
    this.sendNotification(action.notification, action.payload);
    this.sendNotification("SEYMOUR_SYSTEM_ACTION", { id: action.id, notification: action.notification });
    if (action.close !== false) this.closeSystemPanel();
    else {
      this.refreshDom(0);
      this.startSystemDismissTimer();
    }
    return true;
  },

  startSystemDismissTimer() {
    this.clearSystemDismissTimer();
    if (!this.systemOpen) return;
    const configuredDelay = Number((this.config.systemPanel || {}).autoDismissDelay);
    if (!Number.isFinite(configuredDelay) || configuredDelay <= 0) return;
    this.systemDismissTimer = setTimeout(() => {
      this.systemDismissTimer = null;
      this.closeSystemPanel();
    }, configuredDelay);
  },

  clearSystemDismissTimer() {
    if (this.systemDismissTimer) clearTimeout(this.systemDismissTimer);
    this.systemDismissTimer = null;
  },

  getDomFocusElements(controls = {}) {
    if (typeof document === "undefined" || typeof document.querySelectorAll !== "function") {
      return [];
    }

    const selector =
      typeof controls.selector === "string" && controls.selector.trim()
        ? controls.selector
        : [
            "button",
            "a[href]",
            "input:not([type='hidden'])",
            "select",
            "textarea",
            "[tabindex]:not([tabindex='-1'])"
          ].join(",");

    return Array.from(document.querySelectorAll(selector)).filter((element) => {
      if (!element || typeof element !== "object") return false;
      if (typeof element.closest === "function" && element.closest(".seymour-root")) return false;
      if (element.disabled || element.getAttribute?.("aria-disabled") === "true") return false;
      if (element.getAttribute?.("aria-hidden") === "true") return false;
      if (typeof element.getClientRects === "function" && element.getClientRects().length === 0) {
        return false;
      }
      return true;
    });
  },

  initializeDomFocus(controls) {
    const elements = this.getDomFocusElements(controls);
    this.domFocusIndex = elements.length ? 0 : -1;
    this.domFocusedElement = elements[0] || null;
    this.focusDomElement(this.domFocusedElement);
    this.startDomFocusObserver(controls);
  },

  moveDomFocus(delta, controls) {
    const elements = this.getDomFocusElements(controls);
    if (!elements.length) return false;

    const elementIndex = this.domFocusedElement
      ? elements.indexOf(this.domFocusedElement)
      : -1;
    const currentIndex = elementIndex >= 0
      ? elementIndex
      : Math.min(this.domFocusIndex, elements.length - 1);
    const baseIndex = currentIndex >= 0 ? currentIndex : delta > 0 ? -1 : 0;
    this.domFocusIndex = (baseIndex + delta + elements.length) % elements.length;
    this.domFocusedElement = elements[this.domFocusIndex];
    this.focusDomElement(this.domFocusedElement);
    this.startInteractionTimer();
    return true;
  },

  focusDomElement(element) {
    if (!element || typeof element.focus !== "function") return;
    try {
      element.focus({ preventScroll: true });
    } catch (_error) {
      element.focus();
    }
    if (typeof element.scrollIntoView === "function") {
      element.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  },

  activateDomFocus(controls) {
    const elements = this.getDomFocusElements(controls);
    const liveIndex = elements.indexOf(this.domFocusedElement);
    const fallbackIndex =
      this.domFocusIndex >= 0 ? Math.min(this.domFocusIndex, elements.length - 1) : 0;
    const element = liveIndex >= 0 ? this.domFocusedElement : elements[fallbackIndex];
    if (!element) return false;
    this.domFocusedElement = element;
    this.domFocusIndex = elements.indexOf(element);
    this.focusDomElement(element);
    if (typeof element.click === "function") element.click();
    return true;
  },

  clearDomFocus() {
    if (this.domFocusObserver) {
      this.domFocusObserver.disconnect();
      this.domFocusObserver = null;
    }
    if (this.domFocusedElement && typeof this.domFocusedElement.blur === "function") {
      this.domFocusedElement.blur();
    }
    this.domFocusedElement = null;
    this.domFocusIndex = -1;
  },

  startDomFocusObserver(controls) {
    if (
      typeof MutationObserver === "undefined" ||
      typeof document === "undefined" ||
      !document.body
    ) {
      return;
    }
    if (this.domFocusObserver) this.domFocusObserver.disconnect();
    this.domFocusObserver = new MutationObserver(() => {
      if (!this.interactionActive) return;
      const elements = this.getDomFocusElements(controls);
      if (!elements.length || this.domFocusIndex < 0) return;
      this.domFocusIndex = Math.min(this.domFocusIndex, elements.length - 1);
      const replacement = elements[this.domFocusIndex];
      if (replacement === this.domFocusedElement) return;
      this.domFocusedElement = replacement;
      this.focusDomElement(replacement);
    });
    this.domFocusObserver.observe(document.body, { childList: true, subtree: true });
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
      if (this.systemOpen) {
        this.closeSystemPanel();
        event.preventDefault();
      } else if (this.isOpen) {
        this.closeSelector();
        event.preventDefault();
      }
      return;
    }

    const action = actionByKey[event.key];
    if (!action) return;

    const wasOpen = this.isOpen;
    const handled = this.handleAction(action);
    if (wasOpen || this.isOpen || handled) event.preventDefault();
  },

  openSelector() {
    if (!this.config.channels.length) return;
    this.clearIdleReturnTimer();
    if (this.systemOpen) this.closeSystemPanel();
    if (this.isOpen) {
      this.startAutoDismissTimer();
      return;
    }
    this.exitInteraction();

    const currentIndex =
      this.currentPage === null
        ? -1
        : this.config.channels.findIndex(
            (channel) => this.getChannelPage(channel) === this.currentPage
          );

    if (currentIndex !== -1) this.activeIndex = currentIndex;
    else if (this.activeIndex >= this.config.channels.length) this.activeIndex = 0;

    this.isOpen = true;
    this.clearIdleReturnTimer();
    this.sendNotification("SEYMOUR_SELECTOR_OPENED", { page: this.currentPage });
    this.dispatchSelectorLifecycle("open");
    this.refreshDom(150);
    this.applyWledState();
    this.startAutoDismissTimer();
  },

  closeSelector() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.sendNotification("SEYMOUR_SELECTOR_CLOSED", { page: this.currentPage });
    this.dispatchSelectorLifecycle("close");
    this.clearAutoDismissTimer();
    this.refreshDom(150);
    this.applyWledState();
    this.startIdleReturnTimer();
  },

  dispatchSelectorLifecycle(state) {
    const lifecycle = this.config.selectorLifecycle || {};
    const actions = Array.isArray(lifecycle[state]) ? lifecycle[state] : [];

    actions.forEach((action) => {
      if (!action || typeof action.notification !== "string" || !action.notification) return;
      if (
        action.page !== undefined &&
        (!Number.isInteger(action.page) || action.page !== this.currentPage)
      ) {
        return;
      }
      this.sendNotification(action.notification, action.payload);
    });
  },

  refreshDom(animationSpeed) {
    this.updateDom(animationSpeed);
  },

  handleTimerNotification(notification, payload = {}) {
    const timerConfig = this.config.timer || {};

    if (notification === "KITCHEN_TIMER_STARTED") {
      this.timerWarningFocused = false;
      this.timerWledState = null;
      this.attentionOff("kitchen-timer");
      return;
    }

    if (notification === "KITCHEN_TIMER_TICK") {
      const warningSeconds = Number(timerConfig.warningSeconds);
      const remainingSeconds = Number(payload.remainingSeconds);
      const warningActive =
        Number.isFinite(warningSeconds) &&
        warningSeconds > 0 &&
        Number.isFinite(remainingSeconds) &&
        remainingSeconds > 0 &&
        remainingSeconds <= warningSeconds;

      if (warningActive && this.timerWledState !== "timerWarning") {
        this.timerWledState = "timerWarning";
        this.applyWledState();
      } else if (!warningActive && this.timerWledState === "timerWarning") {
        this.timerWledState = null;
        this.applyWledState();
      }

      if (
        timerConfig.focusOnWarning !== false &&
        !this.timerWarningFocused &&
        warningActive
      ) {
        this.timerWarningFocused = true;
        this.focusTimerPage();
      }
      return;
    }

    if (notification === "KITCHEN_TIMER_FINISHED") {
      this.timerWledState = "timerFinished";
      if (timerConfig.focusOnFinish !== false) this.focusTimerPage();
      if (timerConfig.attentionOnFinish !== false) this.attentionOn("kitchen-timer");
      else this.applyWledState();
      return;
    }

    if (
      notification === "KITCHEN_TIMER_RESET" ||
      notification === "KITCHEN_TIMER_DISMISSED"
    ) {
      this.timerWarningFocused = false;
      this.timerWledState = null;
      this.attentionOff("kitchen-timer");
    }
  },

  isFocusBreakNotification(notification) {
    return [
      "FOCUS_BREAK_READY",
      "FOCUS_STARTED",
      "FOCUS_PAUSED",
      "FOCUS_RESUMED",
      "FOCUS_COMPLETED",
      "BREAK_STARTED",
      "BREAK_PAUSED",
      "BREAK_RESUMED",
      "BREAK_COMPLETED",
      "FOCUS_BREAK_RESET",
      "FOCUS_BREAK_PROGRESS"
    ].includes(notification);
  },

  handleFocusBreakNotification(notification) {
    if (notification === "FOCUS_STARTED" || notification === "FOCUS_RESUMED") {
      this.focusBreakWledState = "focusing";
      this.applyWledState();
      return;
    }

    if (notification === "BREAK_STARTED" || notification === "BREAK_RESUMED") {
      this.focusBreakWledState = "breakActive";
      this.applyWledState();
      return;
    }

    if (notification === "BREAK_COMPLETED") {
      this.focusBreakWledState = "breakFinished";
      this.applyWledState();
      return;
    }

    if (notification === "FOCUS_BREAK_READY" || notification === "FOCUS_BREAK_RESET") {
      this.focusBreakWledState = null;
      this.applyWledState();
    }
  },

  focusTimerPage() {
    const timerPage = Number(this.config.timer && this.config.timer.page);
    if (!Number.isInteger(timerPage) || timerPage < 0 || timerPage === this.currentPage) return;
    if (this.timerFocusTimer) clearTimeout(this.timerFocusTimer);
    this.timerFocusTimer = setTimeout(() => {
      this.timerFocusTimer = null;
      Log.info(`[MMM-Seymour] Focusing timer page ${timerPage}`);
      this.sendNotification(this.config.pageChangeNotification, timerPage);
    }, 0);
  },

  centerActiveItem(wrapper) {
    if (!wrapper) return;

    const selector = wrapper.querySelector(".seymour-selector");
    const activeItem = wrapper.querySelector(".seymour-item.active");
    if (!selector || !activeItem) return;

    const targetLeft = Math.max(
      0,
      activeItem.offsetLeft - (selector.clientWidth - activeItem.offsetWidth) / 2
    );

    if (typeof selector.scrollTo === "function") {
      selector.scrollTo({ left: targetLeft, behavior: "smooth" });
      return;
    }

    activeItem.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
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

      const systemDismiss = target.closest("[data-seymour-action='system-dismiss']");
      if (systemDismiss) {
        this.closeSystemPanel();
        return;
      }

      const systemAction = target.closest("[data-seymour-system-index]");
      if (systemAction && this.systemOpen) {
        const index = Number(systemAction.dataset.seymourSystemIndex);
        if (Number.isInteger(index) && index >= 0 && index < this.getSystemActions().length) {
          this.activateSystemAction(index);
        }
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

  noteUserActivity() {
    this.startIdleReturnTimer();
  },

  getIdleReturnPage() {
    const idleReturn = this.config.idleReturn || {};
    const page = Number(idleReturn.page);
    if (!Number.isInteger(page) || page < 0) return null;
    const channel = this.config.channels.find(
      (candidate) => this.getChannelPage(candidate) === page
    );
    return channel ? page : null;
  },

  isIdleReturnBlocked() {
    if (this.isOpen || this.systemOpen || this.interactionActive) return true;
    const channel = this.getCurrentChannel();
    return !!(channel && channel.idleReturn === false);
  },

  startIdleReturnTimer() {
    this.clearIdleReturnTimer();
    const idleReturn = this.config.idleReturn || {};
    if (idleReturn.enabled !== true) return;

    const returnPage = this.getIdleReturnPage();
    if (returnPage === null || this.currentPage === returnPage || this.isIdleReturnBlocked()) return;

    const configuredDelay = Number(idleReturn.delay);
    if (!Number.isFinite(configuredDelay) || configuredDelay <= 0) return;

    this.idleReturnTimer = setTimeout(() => {
      this.idleReturnTimer = null;
      this.returnToIdlePage();
    }, configuredDelay);
  },

  clearIdleReturnTimer() {
    if (this.idleReturnTimer) clearTimeout(this.idleReturnTimer);
    this.idleReturnTimer = null;
  },

  returnToIdlePage() {
    const returnPage = this.getIdleReturnPage();
    if (returnPage === null || this.currentPage === returnPage || this.isIdleReturnBlocked()) {
      return false;
    }

    const index = this.config.channels.findIndex(
      (channel) => this.getChannelPage(channel) === returnPage
    );
    this.activeIndex = index;
    this.sendNotification(this.config.pageChangeNotification, returnPage);
    this.sendNotification("SEYMOUR_IDLE_RETURNED", {
      from: this.currentPage,
      page: returnPage
    });
    this.currentPage = returnPage;
    return true;
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

    this.sendNotification(this.config.pageChangeNotification, pageIndex);
    this.exitInteraction({ notify: true, refresh: false });
    this.currentPage = pageIndex;

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

  startWledHeartbeat() {
    const wled = this.config.wled || {};
    if (wled.enabled !== true) return;

    const configuredInterval = Number(wled.heartbeatInterval);
    if (configuredInterval === 0) {
      this.applyWledState();
      return;
    }
    const interval =
      Number.isFinite(configuredInterval) && configuredInterval > 0
        ? configuredInterval
        : this.defaults.wled.heartbeatInterval;

    this.applyWledState();
    if (!Number.isFinite(interval) || interval <= 0) return;

    this.stopWledHeartbeat();
    this.wledHeartbeatTimer = setInterval(() => this.applyWledState(), interval);
  },

  stopWledHeartbeat() {
    if (!this.wledHeartbeatTimer) return;
    clearInterval(this.wledHeartbeatTimer);
    this.wledHeartbeatTimer = null;
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
    const preferredState = this.isOpen
      ? "open"
      : this.systemOpen
        ? "system"
        : this.timerWledState === "timerFinished"
          ? "timerFinished"
          : this.focusBreakWledState === "breakFinished"
            ? "breakFinished"
          : this.attentionActive
            ? "attention"
            : this.timerWledState === "timerWarning"
              ? "timerWarning"
              : this.focusBreakWledState === "breakActive"
                ? "breakActive"
                : this.interactionActive
                  ? "control"
                  : this.focusBreakWledState === "focusing"
                    ? "focusing"
                    : "idle";
    const fallbackState =
      ["timerFinished", "breakFinished"].includes(preferredState)
        ? "attention"
        : ["timerWarning", "control", "system", "focusing", "breakActive"].includes(preferredState)
          ? "idle"
          : preferredState;
    const state = Number.isInteger(presets[preferredState]) ? preferredState : fallbackState;
    const preset = presets[state];

    if (!Number.isInteger(preset) || preset < 0) return;

    fetch(`${baseUrl}/win&PL=${preset}`)
      .then((response) => {
        if (response && response.ok === false) {
          throw new Error(`HTTP ${response.status}`);
        }
        if (this.wledConnected === false) {
          Log.info(`[MMM-Seymour] WLED connection restored at ${baseUrl}`);
        }
        this.wledConnected = true;
      })
      .catch((error) => {
        if (this.wledConnected !== false) {
          console.error(`[MMM-Seymour] WLED ${state} error:`, error);
        }
        this.wledConnected = false;
      });
  }
});
