const assert = require("node:assert/strict");
const test = require("node:test");

let definition;
global.Module = {
  register(name, moduleDefinition) {
    assert.equal(name, "MMM-Seymour");
    definition = moduleDefinition;
  }
};
global.Log = { info() {} };
global.document = { addEventListener() {}, removeEventListener() {} };

require("../MMM-Seymour.js");

function instance(channels = []) {
  return {
    ...definition,
    config: { ...definition.defaults, channels },
    activeIndex: 0,
    isOpen: false,
    currentPage: null,
    maxPages: null,
    _closeTimer: null,
    updateDom() {},
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
  let notification;
  module.sendNotification = (name, payload) => {
    notification = { name, payload };
  };

  module.start();

  assert.deepEqual(notification, { name: "QUERY_PAGE_NUMBER", payload: undefined });
});

test("opens with the current MMM-pages channel selected", () => {
  const module = instance([{ page: 0 }, { page: 2 }, { page: 4 }]);

  module.notificationReceived("NEW_PAGE", 2);
  module.openSelector();

  assert.equal(module.currentPage, 2);
  assert.equal(module.activeIndex, 1);
  assert.equal(module.isOpen, true);
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

test("ignores shortcuts while the user is typing", () => {
  const module = instance([{ page: 0 }]);
  const event = keyEvent("Enter");
  event.target = { tagName: "INPUT", isContentEditable: false };

  module.handleKeyEvent(event);
  assert.equal(module.isOpen, false);
  assert.equal(event.defaultPrevented, false);
});
