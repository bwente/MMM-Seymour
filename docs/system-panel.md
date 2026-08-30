# System panel

The System panel keeps occasional appliance controls out of the channel
selector. Triple-press the encoder to open or close it, rotate to choose an
action, and press once to activate the selected action. It closes after 20
seconds of inactivity by default.

Restart, reboot, and shutdown require a second deliberate press. Moving to a
different action cancels the confirmation.

## Configuration

```js
{
  module: "MMM-Seymour",
  position: "fullscreen_above",
  config: {
    systemPanel: {
      enabled: true,
      triplePressDelay: 650,
      autoDismissDelay: 20000,
      title: "System",
      showDiagnostics: true,
      actions: [
        {
          id: "restart",
          label: "Restart MagicMirror",
          notification: "SEYMOUR_SYSTEM_RESTART_MM",
          confirm: true
        },
        {
          id: "reboot",
          label: "Reboot Seymour",
          notification: "SEYMOUR_SYSTEM_REBOOT",
          confirm: true
        },
        {
          id: "shutdown",
          label: "Shut down",
          notification: "SEYMOUR_SYSTEM_SHUTDOWN",
          confirm: true
        }
      ]
    }
  }
}
```

Each action publishes its configured MagicMirror notification and then a
generic `SEYMOUR_SYSTEM_ACTION` event containing the action `id` and
notification name. Seymour does not run operating-system commands or require
administrator privileges. A separate, optional administrator is responsible
for deciding whether and how to perform those commands.

This division keeps the UI portable and prevents an ordinary browser module
from silently gaining control of the host. An action without a listener is a
safe no-op.

Actions may also include:

- `payload`: data sent with the configured notification;
- `confirm: true`: require a second press before publishing;
- `close: false`: keep the panel open after publishing.

The panel also publishes `SEYMOUR_SYSTEM_OPENED` and
`SEYMOUR_SYSTEM_CLOSED`. These can drive optional ambient feedback. Set the
WLED `system` preset to a preset number to show a distinct ring state while
the panel is open; leave it `null` to use the normal idle state.

## Diagnostics

When `showDiagnostics` is enabled, opening the panel requests a fresh,
read-only snapshot from Seymour's node helper. It displays the hostname,
non-loopback IP addresses, uptime, memory usage, one-minute CPU load, Raspberry
Pi temperature when available, and the installed MagicMirror and Node.js
versions.

No shell commands, administrator privileges, hardware addresses, or
credentials are used. Set `showDiagnostics: false` to omit the section.

## Accessibility and input

The panel uses ordinary buttons and remains operable by touch and keyboard.
The encoder gesture is intentionally deliberate so a normal channel-selection
press does not expose administration controls accidentally.
