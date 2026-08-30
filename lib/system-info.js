const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function addresses(networkInterfaces = os.networkInterfaces()) {
  return Object.values(networkInterfaces)
    .flatMap((entries) => entries || [])
    .filter((entry) => entry && entry.internal !== true && ["IPv4", "IPv6", 4, 6].includes(entry.family))
    .map((entry) => entry.address)
    .filter((address) => address && !address.toLowerCase().startsWith("fe80:"))
    .filter((address, index, all) => all.indexOf(address) === index);
}

function temperatureC(readFile = fs.readFileSync) {
  try {
    const value = Number(readFile("/sys/class/thermal/thermal_zone0/temp", "utf8"));
    return Number.isFinite(value) ? value / 1000 : null;
  } catch {
    return null;
  }
}

function magicMirrorVersion(readFile = fs.readFileSync, moduleDirectory = __dirname) {
  try {
    const packagePath = path.resolve(moduleDirectory, "..", "..", "package.json");
    return JSON.parse(readFile(packagePath, "utf8")).version || null;
  } catch {
    return null;
  }
}

function collectSystemInfo(options = {}) {
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const cpuCount = Math.max(1, os.cpus().length);
  return {
    hostname: os.hostname(),
    addresses: addresses(),
    uptimeSeconds: os.uptime(),
    memory: { usedBytes: totalBytes - freeBytes, totalBytes },
    cpuLoadPercent: Math.min(100, Math.max(0, (os.loadavg()[0] / cpuCount) * 100)),
    temperatureC: temperatureC(),
    magicMirrorVersion: magicMirrorVersion(
      options.readFile || fs.readFileSync,
      options.moduleDirectory || __dirname
    ),
    nodeVersion: process.version,
    platform: `${os.platform()} ${os.arch()}`
  };
}

module.exports = { addresses, collectSystemInfo, magicMirrorVersion, temperatureC };
