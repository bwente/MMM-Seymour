const assert = require("node:assert/strict");
const test = require("node:test");

const { addresses, magicMirrorVersion, temperatureC } = require("../lib/system-info");

test("system diagnostics return usable unique network addresses", () => {
  assert.deepEqual(addresses({
    lo: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
    wlan0: [
      { address: "192.0.2.10", family: "IPv4", internal: false },
      { address: "fe80::1234", family: "IPv6", internal: false },
      { address: "2001:db8::10", family: "IPv6", internal: false },
      { address: "192.0.2.10", family: 4, internal: false }
    ]
  }), ["192.0.2.10", "2001:db8::10"]);
});

test("temperature diagnostics tolerate unavailable hardware", () => {
  assert.equal(temperatureC(() => "52500"), 52.5);
  assert.equal(temperatureC(() => { throw new Error("not available"); }), null);
});

test("MagicMirror version is read relative to the module directory", () => {
  let requestedPath;
  const version = magicMirrorVersion((filePath) => {
    requestedPath = filePath;
    return JSON.stringify({ version: "2.37.0" });
  }, "/home/pi/MagicMirror/modules/MMM-Seymour");

  assert.equal(requestedPath, "/home/pi/MagicMirror/package.json");
  assert.equal(version, "2.37.0");
});
