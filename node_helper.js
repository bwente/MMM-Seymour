const NodeHelper = require("node_helper");
const { collectSystemInfo } = require("./lib/system-info");

module.exports = NodeHelper.create({
  requiresVersion: "2.25.0",

  socketNotificationReceived(notification) {
    if (notification !== "SEYMOUR_GET_SYSTEM_INFO") return;
    this.sendSocketNotification("SEYMOUR_SYSTEM_INFO", collectSystemInfo({ moduleDirectory: __dirname }));
  }
});
