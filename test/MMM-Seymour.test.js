const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");
const translations = require("../translations/en.json");

function translate(key, variables = {}) {
  return Object.entries(variables).reduce(
    (value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)),
    translations[key] || key
  );
}

let definition;
global.Module = {
  register(name, moduleDefinition) {
    assert.equal(name, "MMM-Seymour");
    definition = moduleDefinition;
  }
};
global.Log = { info() {} };
global.document = {
  addEventListener() {},
  removeEventListener() {},
  getElementById() {
    return null;
  }
};

require("../MMM-Seymour.js");

const stockConfig = require("../examples/stock-modules.config.js");

test("stock example can be loaded directly by the MagicMirror browser", () => {
  const source = fs.readFileSync(
    require.resolve("../examples/stock-modules.config.js"),
    "utf8"
  );
  const browserContext = {};

  vm.runInNewContext(source, browserContext);

  assert.equal(browserContext.config.modules.length > 0, true);
});

function instance(channels = []) {
  return {
    ...definition,
    config: { ...definition.defaults, channels, wled: { enabled: false } },
    activeIndex: 0,
    isOpen: false,
    currentPage: null,
    maxPages: null,
    attentionActive: false,
    attentionSources: new Set(),
    timerWledState: null,
    focusBreakWledState: null,
    dismissTimer: null,
    idleReturnTimer: null,
    closeTimer: null,
    _closeTimer: null,
    interactionActive: false,
    interactionPage: null,
    interactionTimer: null,
    pendingPressTimer: null,
    pressCount: 0,
    systemOpen: false,
    systemIndex: 0,
    systemConfirmAction: null,
    systemDismissTimer: null,
    systemInfo: null,
    domFocusIndex: -1,
    domFocusedElement: null,
    domFocusObserver: null,
    wledHeartbeatTimer: null,
    translate,
    updateDom() {},
    sendSocketNotification() {},
    sendNotification() {}
  };
}

function keyEvent(key) {
  return {
    key,
    target: null,
    defaultPrevented: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    repeat: false,
    preventDefault() {
      this.defaultPrevented = true;
    }
  };
}

test("does not open an empty selector", () => {
  const module = instance();
  module.handleKeyEvent(keyEvent("Enter"));
  assert.equal(module.isOpen, false);
});

test("provides the complete English translation entry point", () => {
  assert.equal(definition.getTranslations().en, "translations/en.json");
  for (const key of ["OPEN_CHANNELS", "SYSTEM_INFORMATION", "CHANNELS", "UNAVAILABLE"]) {
    assert.equal(typeof translations[key], "string");
    assert.notEqual(translations[key], "");
  }
});

test("keeps WLED opt-in for a standard MagicMirror installation", () => {
  assert.equal(definition.defaults.wled.enabled, false);
  assert.deepEqual(
    {
      timerWarning: definition.defaults.wled.presets.timerWarning,
      timerFinished: definition.defaults.wled.presets.timerFinished,
      control: definition.defaults.wled.presets.control
    },
    { timerWarning: null, timerFinished: null, control: null }
  );
});

test("stock example maps bundled modules to matching Seymour channels", () => {
  const seymour = stockConfig.modules.find(({ module }) => module === "MMM-Seymour");
  const pages = stockConfig.modules.find(({ module }) => module === "MMM-pages");

  assert.deepEqual(
    seymour.config.channels.map(({ label, page }) => ({ label, page })),
    [
      { label: "Clock", page: 0 },
      { label: "Calendar", page: 1 },
      { label: "Weather", page: 2 },
      { label: "News", page: 3 }
    ]
  );
  assert.deepEqual(pages.config.modules, [
    ["page-clock"],
    ["page-calendar"],
    ["page-weather"],
    ["page-news"]
  ]);
});

test("switches channel artwork when the configured theme changes", () => {
  const module = instance([{ label: "Clock", page: 0, thumbnail: "clock.png" }]);

  assert.equal(
    module.getTemplateData().channels[0].thumbnailUrl,
    "modules/MMM-Seymour/assets/themes/default/clock.png"
  );

  module.config.theme = "dark";
  assert.equal(
    module.getTemplateData().channels[0].thumbnailUrl,
    "modules/MMM-Seymour/assets/themes/dark/clock.png"
  );
});

test("uses each theme's placeholder for channels without artwork", () => {
  const module = instance([{ label: "Custom", page: 0 }]);
  module.config.theme = "dark";

  assert.equal(
    module.getTemplateData().channels[0].thumbnailUrl,
    "modules/MMM-Seymour/assets/themes/dark/placeholder.png"
  );
});

test("wraps selection in both directions", () => {
  const module = instance([{ page: 0 }, { page: 1 }]);
  module.isOpen = true;

  module.handleKeyEvent(keyEvent("ArrowLeft"));
  assert.equal(module.activeIndex, 1);

  module.handleKeyEvent(keyEvent("ArrowRight"));
  assert.equal(module.activeIndex, 0);
});

test("sends a valid integer page notification", () => {
  const module = instance([{ page: 2 }]);
  let notification;
  module.sendNotification = (name, payload) => {
    notification = { name, payload };
  };

  module.activateChannel();
  assert.deepEqual(notification, { name: "PAGE_CHANGED", payload: 2 });
  assert.equal(module.currentPage, 2);
});

test("makes the selected channel interactive without waiting for a page echo", () => {
  const module = instance([
    { page: 0 },
    {
      page: 7,
      controls: {
        mode: "focus",
        selector: ".seymour-timer button"
      }
    }
  ]);
  module.activeIndex = 1;

  module.activateChannel();

  assert.equal(module.currentPage, 7);
  assert.equal(module.getCurrentChannelControls().mode, "focus");
});

test("rejects non-integer, negative, and out-of-range pages", () => {
  for (const page of ["2", 2.8, -1, 3]) {
    const module = instance([{ page }]);
    module.maxPages = 3;
    let notificationSent = false;
    module.sendNotification = () => {
      notificationSent = true;
    };

    module.activateChannel();
    assert.equal(notificationSent, false, `page ${page} should be rejected`);
  }
});

test("start requests the current page", () => {
  const module = instance([{ page: 0 }]);
  const notifications = [];
  module.sendNotification = (name, payload) => {
    notifications.push({ name, payload });
  };

  module.start();

  assert.equal(notifications[0].name, "QUERY_PAGE_NUMBER");
  assert.equal(notifications[1].name, "REGISTER_API");
  assert.equal(notifications[1].payload.path, "seymour");
  assert.deepEqual(Object.keys(notifications[1].payload.actions), [
    "open",
    "close",
    "previous",
    "next",
    "activate",
    "select",
    "system"
  ]);
});

test("can disable MMM-Remote-Control API registration", () => {
  const module = instance([{ page: 0 }]);
  module.config.remoteControl = { enabled: false };
  const notifications = [];
  module.sendNotification = (name) => notifications.push(name);

  module.start();

  assert.deepEqual(notifications, ["QUERY_PAGE_NUMBER"]);
});

test("handles explicit MMM-Remote-Control selector actions", () => {
  const module = instance([{ page: 0 }, { page: 1 }]);

  module.notificationReceived("SEYMOUR_OPEN");
  assert.equal(module.isOpen, true);

  module.notificationReceived("SEYMOUR_ROTATE_RIGHT");
  assert.equal(module.activeIndex, 1);

  module.notificationReceived("SEYMOUR_CLOSE");
  assert.equal(module.isOpen, false);
});

test("triple press opens and closes the System overlay without changing channels", async () => {
  const module = instance([{ page: 0 }]);
  module.currentPage = 0;
  module.config.systemPanel = { ...definition.defaults.systemPanel, triplePressDelay: 5, autoDismissDelay: 0 };
  const notifications = [];
  module.sendNotification = (name, payload) => notifications.push({ name, payload });

  module.handleAction("PRESS");
  module.handleAction("PRESS");
  module.handleAction("PRESS");

  assert.equal(module.systemOpen, true);
  assert.equal(module.currentPage, 0);
  assert.equal(module.isOpen, false);
  assert.equal(notifications.at(-1).name, "SEYMOUR_SYSTEM_OPENED");

  module.handleAction("PRESS");
  module.handleAction("PRESS");
  module.handleAction("PRESS");

  assert.equal(module.systemOpen, false);
  assert.equal(notifications.at(-1).name, "SEYMOUR_SYSTEM_CLOSED");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(notifications.some(({ name }) => name.startsWith("SEYMOUR_SYSTEM_VOLUME")), false);
});

test("System rotation wraps and cancels a pending confirmation", () => {
  const module = instance([{ page: 0 }]);
  module.config.systemPanel = { ...definition.defaults.systemPanel, autoDismissDelay: 0 };
  module.systemOpen = true;
  module.systemIndex = 0;
  module.systemConfirmAction = "restart";

  module.handleAction("ROTATE_LEFT");
  assert.equal(module.systemIndex, definition.defaults.systemPanel.actions.length - 1);
  assert.equal(module.systemConfirmAction, null);

  module.handleAction("ROTATE_RIGHT");
  assert.equal(module.systemIndex, 0);
});

test("destructive System actions require confirmation and publish semantic notifications", () => {
  const module = instance([{ page: 0 }]);
  const notifications = [];
  module.systemOpen = true;
  module.config.systemPanel = { ...definition.defaults.systemPanel, autoDismissDelay: 0 };
  module.sendNotification = (name, payload) => notifications.push({ name, payload });
  const rebootIndex = module.getSystemActions().findIndex(({ id }) => id === "reboot");

  module.activateSystemAction(rebootIndex);
  assert.equal(module.systemOpen, true);
  assert.equal(module.systemConfirmAction, "reboot");
  assert.equal(notifications.length, 0);

  module.activateSystemAction(rebootIndex);
  assert.equal(module.systemOpen, false);
  assert.deepEqual(notifications.map(({ name }) => name), [
    "SEYMOUR_SYSTEM_REBOOT",
    "SEYMOUR_SYSTEM_ACTION",
    "SEYMOUR_SYSTEM_CLOSED"
  ]);
});

test("System overlay auto-closes after inactivity", async () => {
  const module = instance([{ page: 0 }]);
  module.config.systemPanel = { ...definition.defaults.systemPanel, autoDismissDelay: 5 };

  module.openSystemPanel();
  assert.equal(module.systemOpen, true);
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(module.systemOpen, false);
});

test("opening System requests fresh diagnostics and formats the response", () => {
  const module = instance([{ page: 0 }]);
  const socketNotifications = [];
  module.config.systemPanel = { ...definition.defaults.systemPanel, autoDismissDelay: 0 };
  module.sendSocketNotification = (name) => socketNotifications.push(name);

  module.openSystemPanel();
  module.socketNotificationReceived("SEYMOUR_SYSTEM_INFO", {
    hostname: "seymour",
    addresses: ["192.0.2.10", "2001:db8::10"],
    uptimeSeconds: 93784,
    memory: { usedBytes: 805306368, totalBytes: 2147483648 },
    cpuLoadPercent: 18.4,
    temperatureC: 51.6,
    magicMirrorVersion: "2.37.0",
    nodeVersion: "v22.21.1"
  });

  assert.deepEqual(socketNotifications, ["SEYMOUR_GET_SYSTEM_INFO"]);
  assert.deepEqual(module.getSystemInfoTemplateData(), {
    loading: false,
    hostname: "seymour",
    primaryAddress: "192.0.2.10",
    secondaryAddresses: "2001:db8::10",
    uptime: "1d 2h",
    memory: "0.8 / 2.0 GB",
    cpuLoad: "18%",
    temperature: "52°C",
    magicMirrorVersion: "2.37.0",
    nodeVersion: "v22.21.1"
  });
});

test("selects a configured page from MMM-Remote-Control", () => {
  const module = instance([{ page: 0 }, { page: 3 }]);
  let notification;
  module.sendNotification = (name, payload) => {
    notification = { name, payload };
  };

  module.notificationReceived("SEYMOUR_SELECT", { page: "3" });

  assert.equal(module.activeIndex, 1);
  assert.deepEqual(notification, { name: "PAGE_CHANGED", payload: 3 });
});

test("rejects an unconfigured remote page", () => {
  const module = instance([{ page: 0 }]);
  let notificationSent = false;
  module.sendNotification = () => {
    notificationSent = true;
  };

  module.notificationReceived("SEYMOUR_SELECT", { page: 4 });

  assert.equal(notificationSent, false);
});

test("opens with the current MMM-pages channel selected", () => {
  const module = instance([{ page: 0 }, { page: 2 }, { page: 4 }]);

  module.notificationReceived("NEW_PAGE", 2);
  module.openSelector();

  assert.equal(module.currentPage, 2);
  assert.equal(module.activeIndex, 1);
  assert.equal(module.isOpen, true);
});

test("publishes selector lifecycle events and page-filtered actions", () => {
  const module = instance([{ page: 0 }, { page: 6 }]);
  const notifications = [];
  module.currentPage = 6;
  module.config.selectorLifecycle = {
    open: [
      { page: 6, notification: "RTSP-STOP", payload: "all" },
      { page: 2, notification: "IGNORED" }
    ],
    close: [{ page: 6, notification: "RTSP-PLAY", payload: "all" }]
  };
  module.sendNotification = (name, payload) => notifications.push({ name, payload });

  module.openSelector();
  module.closeSelector();

  assert.deepEqual(notifications, [
    { name: "SEYMOUR_SELECTOR_OPENED", payload: { page: 6 } },
    { name: "RTSP-STOP", payload: "all" },
    { name: "SEYMOUR_SELECTOR_CLOSED", payload: { page: 6 } },
    { name: "RTSP-PLAY", payload: "all" }
  ]);
});

test("does not repeat selector lifecycle actions for unchanged state", () => {
  const module = instance([{ page: 0 }]);
  const notifications = [];
  module.currentPage = 0;
  module.config.selectorLifecycle = {
    open: [{ notification: "OPEN_ACTION" }],
    close: [{ notification: "CLOSE_ACTION" }]
  };
  module.sendNotification = (name) => notifications.push(name);

  module.openSelector();
  module.openSelector();
  module.closeSelector();
  module.closeSelector();

  assert.deepEqual(notifications, [
    "SEYMOUR_SELECTOR_OPENED",
    "OPEN_ACTION",
    "SEYMOUR_SELECTOR_CLOSED",
    "CLOSE_ACTION"
  ]);
});

test("uses PAGE_NUMBER_IS responses and records the page count", () => {
  const module = instance([{ page: 0 }]);

  module.notificationReceived("MAX_PAGES_CHANGED", 5);
  module.notificationReceived("PAGE_NUMBER_IS", 3);

  assert.equal(module.maxPages, 5);
  assert.equal(module.currentPage, 3);
});

test("ignores repeated Enter activation", () => {
  const module = instance([{ page: 0 }]);
  module.isOpen = true;
  let notifications = 0;
  module.sendNotification = () => {
    notifications += 1;
  };
  const event = keyEvent("Enter");
  event.repeat = true;

  module.handleKeyEvent(event);

  assert.equal(notifications, 0);
  assert.equal(event.defaultPrevented, true);
});

test("Escape closes an open selector", () => {
  const module = instance([{ page: 0 }]);
  module.isOpen = true;
  const event = keyEvent("Escape");

  module.handleKeyEvent(event);

  assert.equal(module.isOpen, false);
  assert.equal(event.defaultPrevented, true);
});

test("ignores modified shortcuts", () => {
  const module = instance([{ page: 0 }]);
  const event = keyEvent("Enter");
  event.ctrlKey = true;

  module.handleKeyEvent(event);

  assert.equal(module.isOpen, false);
  assert.equal(event.defaultPrevented, false);
});

test("maps GPIO notifications to selector actions", async () => {
  const module = instance([{ page: 0 }, { page: 1 }]);
  module.config.systemPanel = { ...definition.defaults.systemPanel, triplePressDelay: 5 };

  module.notificationReceived("SEYMOUR_PRESS");
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(module.isOpen, true);

  module.notificationReceived("SEYMOUR_ROTATE_RIGHT");
  assert.equal(module.activeIndex, 1);

  module.notificationReceived("SEYMOUR_ROTATE_LEFT");
  assert.equal(module.activeIndex, 0);
});

test("single press retains selector behavior on an interactive channel", async () => {
  const module = instance([
    {
      page: 2,
      controls: {
        rotateLeft: "MUSIC_CONTROL_LEFT",
        rotateRight: "MUSIC_CONTROL_RIGHT",
        press: "MUSIC_CONTROL_SELECT"
      }
    }
  ]);
  module.currentPage = 2;
  module.config.interaction = { enabled: true, doublePressDelay: 5, timeout: 0 };
  module.config.systemPanel = { ...definition.defaults.systemPanel, triplePressDelay: 5 };

  module.handleAction("PRESS");
  assert.equal(module.isOpen, false);

  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(module.isOpen, true);
  assert.equal(module.interactionActive, false);
});

test("double press enters generic channel interaction and routes deliberate controls", async () => {
  const module = instance([
    {
      page: 2,
      controls: {
        directRotateLeft: "MUSIC_VOLUME_DOWN",
        directRotateRight: "MUSIC_VOLUME_UP",
        rotateLeft: "MUSIC_CONTROL_LEFT",
        rotateRight: "MUSIC_CONTROL_RIGHT",
        press: "MUSIC_CONTROL_SELECT",
        enter: "MUSIC_CONTROL_ENTER",
        exit: "MUSIC_CONTROL_BACK"
      }
    }
  ]);
  module.currentPage = 2;
  module.config.interaction = { enabled: true, doublePressDelay: 5, timeout: 0 };
  module.config.systemPanel = { ...definition.defaults.systemPanel, triplePressDelay: 5 };
  const notifications = [];
  module.sendNotification = (name) => notifications.push(name);

  module.handleAction("ROTATE_RIGHT");
  assert.deepEqual(notifications, ["MUSIC_VOLUME_UP"]);

  module.handleAction("PRESS");
  module.handleAction("PRESS");
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(module.interactionActive, true);
  assert.deepEqual(notifications, ["MUSIC_VOLUME_UP", "MUSIC_CONTROL_ENTER"]);

  module.handleAction("ROTATE_RIGHT");
  module.handleAction("PRESS");
  await new Promise((resolve) => setTimeout(resolve, 15));

  assert.deepEqual(notifications, [
    "MUSIC_VOLUME_UP",
    "MUSIC_CONTROL_ENTER",
    "MUSIC_CONTROL_RIGHT",
    "MUSIC_CONTROL_SELECT"
  ]);

  module.handleAction("PRESS");
  module.handleAction("PRESS");
  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(module.interactionActive, false);
  assert.equal(notifications.at(-1), "MUSIC_CONTROL_BACK");
});

test("changing pages exits channel interaction", () => {
  const module = instance([
    {
      page: 2,
      controls: {
        press: "MUSIC_CONTROL_SELECT",
        exit: "MUSIC_CONTROL_BACK"
      }
    },
    { page: 3 }
  ]);
  module.currentPage = 2;
  module.config.interaction = { enabled: true, doublePressDelay: 5, timeout: 0 };
  const notifications = [];
  module.sendNotification = (name) => notifications.push(name);
  module.enterInteraction(module.config.channels[0].controls);

  module.notificationReceived("NEW_PAGE", 3);

  assert.equal(module.currentPage, 3);
  assert.equal(module.interactionActive, false);
  assert.equal(notifications.at(-1), "MUSIC_CONTROL_BACK");
});

test("changing pages cancels a pending interactive-channel press", async () => {
  const module = instance([
    {
      page: 2,
      controls: {
        press: "MUSIC_CONTROL_SELECT"
      }
    },
    { page: 3 }
  ]);
  module.currentPage = 2;
  module.config.interaction = { enabled: true, doublePressDelay: 5, timeout: 0 };

  module.handleAction("PRESS");
  module.notificationReceived("NEW_PAGE", 3);

  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(module.currentPage, 3);
  assert.equal(module.isOpen, false);
  assert.equal(module.pendingPressTimer, null);
});

test("interaction mode exits after inactivity", async () => {
  const module = instance([
    {
      page: 2,
      controls: {
        exit: "MUSIC_CONTROL_BACK"
      }
    }
  ]);
  module.currentPage = 2;
  module.config.interaction = { enabled: true, doublePressDelay: 5, timeout: 5 };
  const notifications = [];
  module.sendNotification = (name) => notifications.push(name);

  module.enterInteraction(module.config.channels[0].controls);
  assert.equal(module.interactionActive, true);

  await new Promise((resolve) => setTimeout(resolve, 15));
  assert.equal(module.interactionActive, false);
  assert.equal(notifications.at(-1), "MUSIC_CONTROL_BACK");
});

test("generic focus mode cycles and activates visible module controls", async () => {
  const module = instance([
    {
      page: 7,
      controls: {
        mode: "focus",
        selector: ".timer-control"
      }
    }
  ]);
  module.currentPage = 7;
  module.config.interaction = { enabled: true, doublePressDelay: 5, timeout: 0 };
  module.config.systemPanel = { ...definition.defaults.systemPanel, triplePressDelay: 5 };
  const events = [];
  const control = (name) => ({
    disabled: false,
    getAttribute: () => null,
    getClientRects: () => [{}],
    closest: () => null,
    focus: () => events.push(`focus:${name}`),
    blur: () => events.push(`blur:${name}`),
    click: () => events.push(`click:${name}`),
    scrollIntoView: () => {}
  });
  const controls = [control("one"), control("two"), control("three")];
  const originalQuerySelectorAll = global.document.querySelectorAll;
  global.document.querySelectorAll = (selector) => {
    assert.equal(selector, ".timer-control");
    return controls;
  };

  try {
    module.handleAction("PRESS");
    module.handleAction("PRESS");
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(module.interactionActive, true);
    assert.equal(module.domFocusedElement, controls[0]);

    module.handleAction("ROTATE_RIGHT");
    module.handleAction("PRESS");
    await new Promise((resolve) => setTimeout(resolve, 15));

    assert.equal(module.domFocusedElement, controls[1]);
    assert.equal(events.includes("click:two"), true);

    module.handleAction("PRESS");
    module.handleAction("PRESS");
    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.equal(module.interactionActive, false);
    assert.equal(events.at(-1), "blur:two");
  } finally {
    global.document.querySelectorAll = originalQuerySelectorAll;
  }
});

test("generic focus mode keeps its logical position when controls are rerendered", () => {
  const module = instance([]);
  module.interactionActive = true;
  module.config.interaction = { enabled: true, timeout: 0 };
  module.domFocusIndex = 2;
  const events = [];
  const control = (name) => ({
    disabled: false,
    getAttribute: () => null,
    getClientRects: () => [{}],
    closest: () => null,
    focus: () => events.push(`focus:${name}`),
    click: () => events.push(`click:${name}`),
    scrollIntoView: () => {}
  });
  const stale = control("stale");
  const replacements = [control("one"), control("two"), control("three"), control("four")];
  module.domFocusedElement = stale;
  module.getDomFocusElements = () => replacements;

  module.moveDomFocus(1, { mode: "focus" });
  assert.equal(module.domFocusIndex, 3);
  assert.equal(module.domFocusedElement, replacements[3]);

  module.domFocusedElement = stale;
  module.domFocusIndex = 2;
  module.activateDomFocus({ mode: "focus" });
  assert.equal(events.at(-1), "click:three");
});

test("restores attention WLED state after closing the selector", () => {
  const module = instance([{ page: 0 }]);
  const requests = [];
  const originalFetch = global.fetch;
  global.fetch = (url) => {
    requests.push(url);
    return Promise.resolve();
  };
  module.config.wled = {
    enabled: true,
    baseUrl: "http://wled.test/",
    presets: { open: 4, idle: 5, attention: 6 }
  };

  try {
    module.notificationReceived("ATTENTION_ON");
    module.openSelector();
    module.closeSelector();
  } finally {
    global.fetch = originalFetch;
  }

  assert.deepEqual(requests, [
    "http://wled.test/win&PL=6",
    "http://wled.test/win&PL=4",
    "http://wled.test/win&PL=6"
  ]);
});

test("applies optional timer and control presets with deterministic priority", () => {
  const module = instance([{ page: 0 }]);
  const requests = [];
  const originalFetch = global.fetch;
  global.fetch = (url) => {
    requests.push(url);
    return Promise.resolve({ ok: true });
  };
  module.config.timer = { warningSeconds: 10, focusOnWarning: false, focusOnFinish: false };
  module.config.wled = {
    enabled: true,
    baseUrl: "http://wled.test",
    presets: {
      open: 1,
      idle: 2,
      attention: 3,
      timerWarning: 4,
      timerFinished: 5,
      control: 6
    }
  };

  try {
    module.interactionActive = true;
    module.applyWledState();
    module.notificationReceived("KITCHEN_TIMER_TICK", { remainingSeconds: 10 });
    module.notificationReceived("ATTENTION_ON", { source: "message-center" });
    module.notificationReceived("KITCHEN_TIMER_FINISHED", { remainingSeconds: 0 });
    module.openSelector();
    module.closeSelector();
    module.notificationReceived("KITCHEN_TIMER_DISMISSED");
    module.notificationReceived("ATTENTION_OFF", { source: "message-center" });
  } finally {
    global.fetch = originalFetch;
  }

  assert.deepEqual(requests, [
    "http://wled.test/win&PL=6",
    "http://wled.test/win&PL=4",
    "http://wled.test/win&PL=3",
    "http://wled.test/win&PL=5",
    "http://wled.test/win&PL=5",
    "http://wled.test/win&PL=1",
    "http://wled.test/win&PL=5",
    "http://wled.test/win&PL=3",
    "http://wled.test/win&PL=2"
  ]);
});

test("falls back to core presets when optional WLED mappings are absent", () => {
  const module = instance([{ page: 0 }]);
  const requests = [];
  const originalFetch = global.fetch;
  global.fetch = (url) => {
    requests.push(url);
    return Promise.resolve({ ok: true });
  };
  module.config.timer = { warningSeconds: 10, focusOnWarning: false, focusOnFinish: false };
  module.config.wled = {
    enabled: true,
    baseUrl: "http://wled.test",
    presets: { open: 1, idle: 2, attention: 3 }
  };

  try {
    module.interactionActive = true;
    module.applyWledState();
    module.notificationReceived("KITCHEN_TIMER_TICK", { remainingSeconds: 10 });
    module.notificationReceived("KITCHEN_TIMER_FINISHED", { remainingSeconds: 0 });
  } finally {
    global.fetch = originalFetch;
  }

  assert.deepEqual(requests, [
    "http://wled.test/win&PL=2",
    "http://wled.test/win&PL=2",
    "http://wled.test/win&PL=3"
  ]);
});

test("uses the optional System WLED preset while the overlay is open", () => {
  const module = instance([{ page: 0 }]);
  const requests = [];
  const originalFetch = global.fetch;
  global.fetch = (url) => {
    requests.push(url);
    return Promise.resolve({ ok: true });
  };
  module.config.systemPanel = { ...definition.defaults.systemPanel, autoDismissDelay: 0 };
  module.config.wled = {
    enabled: true,
    baseUrl: "http://wled.test",
    presets: { open: 1, idle: 2, attention: 3, system: 7 }
  };

  try {
    module.openSystemPanel();
    module.closeSystemPanel();
  } finally {
    global.fetch = originalFetch;
  }

  assert.deepEqual(requests, [
    "http://wled.test/win&PL=7",
    "http://wled.test/win&PL=2"
  ]);
});

test("maps FocusBreak lifecycle notifications without depending on progress", () => {
  const module = instance([{ page: 0 }]);
  const requests = [];
  const originalFetch = global.fetch;
  global.fetch = (url) => {
    requests.push(url);
    return Promise.resolve({ ok: true });
  };
  module.config.wled = {
    enabled: true,
    baseUrl: "http://wled.test",
    presets: { open: 1, idle: 2, attention: 3, focusing: 7, breakActive: 8, breakFinished: 9 }
  };

  try {
    module.notificationReceived("FOCUS_STARTED");
    module.notificationReceived("FOCUS_PAUSED");
    module.notificationReceived("FOCUS_BREAK_PROGRESS", { progress: 0.4 });
    module.notificationReceived("FOCUS_COMPLETED");
    module.notificationReceived("BREAK_STARTED");
    module.notificationReceived("BREAK_PAUSED");
    module.notificationReceived("BREAK_COMPLETED", { reason: "skipped" });
    module.notificationReceived("FOCUS_STARTED");
    module.notificationReceived("FOCUS_BREAK_READY");
    module.notificationReceived("BREAK_STARTED");
    module.notificationReceived("FOCUS_BREAK_RESET");
  } finally {
    global.fetch = originalFetch;
  }

  assert.deepEqual(requests, [
    "http://wled.test/win&PL=7",
    "http://wled.test/win&PL=8",
    "http://wled.test/win&PL=9",
    "http://wled.test/win&PL=7",
    "http://wled.test/win&PL=2",
    "http://wled.test/win&PL=8",
    "http://wled.test/win&PL=2"
  ]);
  assert.equal(module.focusBreakWledState, null);
});

test("selector temporarily overrides and restores every FocusBreak state", () => {
  const module = instance([{ page: 0 }]);
  const requests = [];
  const originalFetch = global.fetch;
  global.fetch = (url) => {
    requests.push(url);
    return Promise.resolve({ ok: true });
  };
  module.config.wled = {
    enabled: true,
    baseUrl: "http://wled.test",
    presets: { open: 1, idle: 2, attention: 3, focusing: 7, breakActive: 8, breakFinished: 9 }
  };

  try {
    ["focusing", "breakActive", "breakFinished"].forEach((state) => {
      module.focusBreakWledState = state;
      module.openSelector();
      module.closeSelector();
    });
  } finally {
    global.fetch = originalFetch;
  }

  assert.deepEqual(requests, [
    "http://wled.test/win&PL=1", "http://wled.test/win&PL=7",
    "http://wled.test/win&PL=1", "http://wled.test/win&PL=8",
    "http://wled.test/win&PL=1", "http://wled.test/win&PL=9"
  ]);
});

test("FocusBreak participates in deterministic WLED priority without clearing attention", () => {
  const module = instance([{ page: 0 }]);
  const requests = [];
  const originalFetch = global.fetch;
  global.fetch = (url) => {
    requests.push(url);
    return Promise.resolve({ ok: true });
  };
  module.config.wled = {
    enabled: true,
    baseUrl: "http://wled.test",
    presets: {
      open: 1, idle: 2, attention: 3, timerWarning: 4, timerFinished: 5,
      control: 6, focusing: 7, breakActive: 8, breakFinished: 9
    }
  };

  try {
    module.focusBreakWledState = "focusing";
    module.interactionActive = true;
    module.applyWledState();
    module.focusBreakWledState = "breakActive";
    module.applyWledState();
    module.timerWledState = "timerWarning";
    module.applyWledState();
    module.attentionOn("message-center");
    module.focusBreakWledState = "breakFinished";
    module.applyWledState();
    module.timerWledState = "timerFinished";
    module.applyWledState();
    module.timerWledState = null;
    module.notificationReceived("FOCUS_BREAK_RESET");
  } finally {
    global.fetch = originalFetch;
  }

  assert.deepEqual(requests, [
    "http://wled.test/win&PL=6",
    "http://wled.test/win&PL=8",
    "http://wled.test/win&PL=4",
    "http://wled.test/win&PL=3",
    "http://wled.test/win&PL=9",
    "http://wled.test/win&PL=5",
    "http://wled.test/win&PL=3"
  ]);
  assert.equal(module.attentionSources.has("message-center"), true);
});

test("FocusBreak mappings reuse idle and attention when optional presets are absent", () => {
  const module = instance([{ page: 0 }]);
  const requests = [];
  const originalFetch = global.fetch;
  global.fetch = (url) => {
    requests.push(url);
    return Promise.resolve({ ok: true });
  };
  module.config.wled = {
    enabled: true,
    baseUrl: "http://wled.test",
    presets: { open: 1, idle: 2, attention: 3 }
  };

  try {
    module.notificationReceived("FOCUS_STARTED");
    module.notificationReceived("BREAK_STARTED");
    module.notificationReceived("BREAK_COMPLETED");
  } finally {
    global.fetch = originalFetch;
  }

  assert.deepEqual(requests, [
    "http://wled.test/win&PL=2",
    "http://wled.test/win&PL=2",
    "http://wled.test/win&PL=3"
  ]);
});

test("WLED-disabled FocusBreak handling remains local and safe", () => {
  const module = instance([{ page: 0 }]);
  let requests = 0;
  const originalFetch = global.fetch;
  global.fetch = () => {
    requests += 1;
    return Promise.resolve({ ok: true });
  };
  module.config.wled = { enabled: false };

  try {
    module.notificationReceived("BREAK_COMPLETED");
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(module.focusBreakWledState, "breakFinished");
  assert.equal(requests, 0);
});

test("WLED heartbeat reapplies state and can be stopped", () => {
  const module = instance([{ page: 0 }]);
  const requests = [];
  const originalFetch = global.fetch;
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  global.fetch = (url) => {
    requests.push(url);
    return Promise.resolve({ ok: true });
  };
  global.setInterval = (callback, interval) => {
    assert.equal(interval, 5);
    callback();
    callback();
    return 123;
  };
  global.clearInterval = () => {};
  module.config.wled = {
    enabled: true,
    baseUrl: "http://wled.test",
    heartbeatInterval: 5,
    presets: { open: 4, idle: 5, attention: 6 }
  };

  try {
    module.startWledHeartbeat();
    module.stopWledHeartbeat();
  } finally {
    module.stopWledHeartbeat();
    global.fetch = originalFetch;
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  }

  assert.equal(requests.length >= 3, true);
  assert.equal(requests.every((url) => url === "http://wled.test/win&PL=5"), true);
  assert.equal(module.wledHeartbeatTimer, null);
});

test("WLED heartbeat reapplies the active FocusBreak state", () => {
  const module = instance([{ page: 0 }]);
  const requests = [];
  const originalFetch = global.fetch;
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  global.fetch = (url) => {
    requests.push(url);
    return Promise.resolve({ ok: true });
  };
  global.setInterval = (callback) => {
    callback();
    return 456;
  };
  global.clearInterval = () => {};
  module.focusBreakWledState = "breakActive";
  module.config.wled = {
    enabled: true,
    baseUrl: "http://wled.test",
    heartbeatInterval: 5,
    presets: { open: 1, idle: 2, attention: 3, breakActive: 8 }
  };

  try {
    module.startWledHeartbeat();
    module.stopWledHeartbeat();
  } finally {
    global.fetch = originalFetch;
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
  }

  assert.deepEqual(requests, [
    "http://wled.test/win&PL=8",
    "http://wled.test/win&PL=8"
  ]);
});

test("zero WLED heartbeat interval keeps event-driven updates only", () => {
  const module = instance([{ page: 0 }]);
  const originalFetch = global.fetch;
  let requests = 0;
  global.fetch = () => {
    requests += 1;
    return Promise.resolve({ ok: true });
  };
  module.config.wled = {
    enabled: true,
    heartbeatInterval: 0,
    presets: { open: 1, idle: 2, attention: 3 }
  };

  try {
    module.startWledHeartbeat();
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(requests, 1);
  assert.equal(module.wledHeartbeatTimer, null);
});

test("auto-dismiss closes the selector", async () => {
  const module = instance([{ page: 0 }]);
  module.config.autoDismiss = true;
  module.config.autoDismissDelay = 5;

  module.openSelector();
  assert.equal(module.isOpen, true);

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(module.isOpen, false);
  assert.equal(module.dismissTimer, null);
});

test("keeps idle return opt-in and local by default", () => {
  assert.deepEqual(definition.defaults.idleReturn, {
    enabled: false,
    page: 0,
    delay: 300000
  });
});

test("returns to the configured page after user inactivity", async () => {
  const module = instance([{ page: 0 }, { page: 3 }]);
  module.currentPage = 3;
  module.config.idleReturn = { enabled: true, page: 0, delay: 5 };
  const notifications = [];
  module.sendNotification = (name, payload) => notifications.push({ name, payload });

  module.startIdleReturnTimer();
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(module.currentPage, 0);
  assert.equal(module.activeIndex, 0);
  assert.deepEqual(notifications, [
    { name: "PAGE_CHANGED", payload: 0 },
    { name: "SEYMOUR_IDLE_RETURNED", payload: { from: 3, page: 0 } }
  ]);
  assert.equal(module.idleReturnTimer, null);
});

test("does not leave a channel that opts out of idle return", async () => {
  const module = instance([{ page: 0 }, { page: 3, idleReturn: false }]);
  module.currentPage = 3;
  module.config.idleReturn = { enabled: true, page: 0, delay: 5 };
  const notifications = [];
  module.sendNotification = (name, payload) => notifications.push({ name, payload });

  module.startIdleReturnTimer();
  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(module.currentPage, 3);
  assert.deepEqual(notifications, []);
  assert.equal(module.idleReturnTimer, null);
});

test("pauses idle return while Seymour controls are open", () => {
  const module = instance([{ page: 0 }, { page: 3 }]);
  module.currentPage = 3;
  module.config.idleReturn = { enabled: true, page: 0, delay: 50 };

  module.isOpen = true;
  module.startIdleReturnTimer();
  assert.equal(module.idleReturnTimer, null);

  module.isOpen = false;
  module.systemOpen = true;
  module.startIdleReturnTimer();
  assert.equal(module.idleReturnTimer, null);

  module.systemOpen = false;
  module.interactionActive = true;
  module.startIdleReturnTimer();
  assert.equal(module.idleReturnTimer, null);
});

test("starts a fresh idle period when the selector closes", async () => {
  const module = instance([{ page: 0 }, { page: 3 }]);
  module.currentPage = 3;
  module.config.idleReturn = { enabled: true, page: 0, delay: 5 };

  module.openSelector();
  assert.equal(module.idleReturnTimer, null);
  module.closeSelector();
  assert.notEqual(module.idleReturnTimer, null);

  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(module.currentPage, 0);
});

test("ignores idle return when its destination is not a configured channel", () => {
  const module = instance([{ page: 3 }]);
  module.currentPage = 3;
  module.config.idleReturn = { enabled: true, page: 0, delay: 5 };

  module.startIdleReturnTimer();

  assert.equal(module.idleReturnTimer, null);
  assert.equal(module.returnToIdlePage(), false);
  assert.equal(module.currentPage, 3);
});

test("ignores shortcuts while the user is typing", () => {
  const module = instance([{ page: 0 }]);
  const event = keyEvent("Enter");
  event.target = { tagName: "INPUT", isContentEditable: false };

  module.handleKeyEvent(event);
  assert.equal(module.isOpen, false);
  assert.equal(event.defaultPrevented, false);
});

test("touch launcher opens and scrim dismisses the selector", () => {
  const module = instance([{ page: 0 }]);
  let clickHandler;
  const wrapper = {
    dataset: {},
    addEventListener(name, handler) {
      assert.equal(name, "click");
      clickHandler = handler;
    }
  };
  const originalGetElementById = document.getElementById;
  document.getElementById = () => wrapper;

  try {
    module.bindTouchControls();
    clickHandler({
      target: {
        closest(selector) {
          return selector === "[data-seymour-action='open']" ? {} : null;
        }
      }
    });
    assert.equal(module.isOpen, true);

    clickHandler({
      target: {
        closest(selector) {
          return selector === "[data-seymour-action='dismiss']" ? {} : null;
        }
      }
    });
    assert.equal(module.isOpen, false);
  } finally {
    document.getElementById = originalGetElementById;
  }
});

test("touching a channel activates its page", () => {
  const module = instance([{ page: 0 }, { page: 3 }]);
  module.isOpen = true;
  let clickHandler;
  let notification;
  module.sendNotification = (name, payload) => {
    notification = { name, payload };
  };
  const wrapper = {
    dataset: {},
    addEventListener(_name, handler) {
      clickHandler = handler;
    }
  };
  const originalGetElementById = document.getElementById;
  document.getElementById = () => wrapper;

  try {
    module.bindTouchControls();
    clickHandler({
      target: {
        closest(selector) {
          if (selector === "[data-seymour-index]") {
            return { dataset: { seymourIndex: "1" } };
          }
          return null;
        }
      }
    });
  } finally {
    if (module.closeTimer) clearTimeout(module.closeTimer);
    document.getElementById = originalGetElementById;
  }

  assert.equal(module.activeIndex, 1);
  assert.deepEqual(notification, { name: "PAGE_CHANGED", payload: 3 });
});

test("attention stays active until every sender clears", () => {
  const module = instance([{ page: 0 }]);
  const senderA = { identifier: "calendar" };
  const senderB = { identifier: "message-center" };

  module.notificationReceived("ATTENTION_ON", null, senderA);
  module.notificationReceived("ATTENTION_ON", null, senderB);
  module.notificationReceived("ATTENTION_OFF", null, senderA);

  assert.equal(module.attentionActive, true);
  assert.deepEqual([...module.attentionSources], ["message-center"]);

  module.notificationReceived("ATTENTION_OFF", null, senderB);
  assert.equal(module.attentionActive, false);
});

test("encoder selection is centered in an overflowing channel strip", () => {
  const module = instance([{ page: 0 }]);
  let scrollOptions;
  const selector = {
    clientWidth: 600,
    scrollTo(options) {
      scrollOptions = options;
    }
  };
  const activeItem = { offsetLeft: 900, offsetWidth: 120 };
  const wrapper = {
    querySelector(selectorName) {
      if (selectorName === ".seymour-selector") return selector;
      if (selectorName === ".seymour-item.active") return activeItem;
      return null;
    }
  };

  module.centerActiveItem(wrapper);

  assert.deepEqual(scrollOptions, { left: 660, behavior: "smooth" });
});

test("centers the selected tile after MagicMirror finishes rendering the DOM", () => {
  const module = instance([{ page: 0 }]);
  module.isOpen = true;
  let centeredWrapper;
  const wrapper = {
    dataset: {},
    addEventListener() {}
  };
  const originalGetElementById = global.document.getElementById;
  global.document.getElementById = () => wrapper;
  module.centerActiveItem = (value) => { centeredWrapper = value; };

  module.notificationReceived("MODULE_DOM_UPDATED");

  global.document.getElementById = originalGetElementById;
  assert.equal(centeredWrapper, wrapper);
});

test("focuses the timer page at warning time and only once", async () => {
  const module = instance([{ page: 0 }, { page: 7 }]);
  module.config.timer = { page: 7, warningSeconds: 10 };
  module.maxPages = 8;
  module.currentPage = 0;
  const notifications = [];
  module.sendNotification = (name, payload) => notifications.push({ name, payload });

  module.notificationReceived("KITCHEN_TIMER_TICK", { remainingSeconds: 10 });
  module.notificationReceived("KITCHEN_TIMER_TICK", { remainingSeconds: 9 });
  await new Promise((resolve) => setTimeout(resolve, 5));

  assert.deepEqual(notifications, [{ name: "PAGE_CHANGED", payload: 7 }]);
});

test("timer completion focuses its page and controls attention lifecycle", async () => {
  const module = instance([{ page: 0 }, { page: 7 }]);
  module.config.timer = { page: 7, attentionOnFinish: true };
  module.maxPages = 8;
  module.currentPage = 0;
  let page;
  module.sendNotification = (name, payload) => {
    if (name === "PAGE_CHANGED") page = payload;
  };

  module.notificationReceived("KITCHEN_TIMER_FINISHED", { remainingSeconds: 0 });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(page, 7);
  assert.equal(module.attentionSources.has("kitchen-timer"), true);

  module.notificationReceived("KITCHEN_TIMER_DISMISSED");
  assert.equal(module.attentionSources.has("kitchen-timer"), false);
});
