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

test("sends an integer page notification", () => {
  const module = instance([{ page: "2.8" }]);
  let notification;
  module.sendNotification = (name, payload) => {
    notification = { name, payload };
  };

  module.activateChannel();
  assert.deepEqual(notification, { name: "PAGE_CHANGED", payload: 2 });
});

test("ignores shortcuts while the user is typing", () => {
  const module = instance([{ page: 0 }]);
  const event = keyEvent("Enter");
  event.target = { tagName: "INPUT", isContentEditable: false };

  module.handleKeyEvent(event);
  assert.equal(module.isOpen, false);
  assert.equal(event.defaultPrevented, false);
});
