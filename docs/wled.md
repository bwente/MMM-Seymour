# WLED setup

WLED is optional. Seymour works as a normal MagicMirror module without an LED
controller, and WLED support is disabled by default. When enabled, Seymour maps
appliance states to user-configurable WLED preset numbers. Other MagicMirror
modules publish meaning—such as attention or timer completion—without knowing
the WLED address, effect name, or preset number.

## Requirements

- A WLED-compatible controller reachable from the MagicMirror device.
- A 16-pixel addressable ring for the bundled preset pack. Other pixel counts
  work after changing each preset's segment bounds.
- WLED and MagicMirror on the same trusted local network.
- A stable hostname or DHCP reservation for the controller.

Do not expose WLED directly to the public internet. The sample preset file does
not contain Wi-Fi credentials or controller configuration.

## Install the preset pack

The sample file is [`examples/wled/presets.json`](../examples/wled/presets.json).
It contains these presets:

| ID | Name | Seymour use |
| --- | --- | --- |
| 1 | Selector Open | Selector is visible. |
| 2 | Selector Closed | Normal idle state; the sample turns the ring off. |
| 3 | Attention Pulse | One or more sources require attention. |
| 4 | Timer Warning | A configured timer reaches its warning threshold. |
| 5 | Timer Finished | A timer completes and awaits dismissal. |
| 6 | Control Mode | The encoder is interacting with the active channel. |
| 7 | Music Activity | Reserved sample effect; not selected by Seymour yet. |
| 8 | Connection Error | Reserved sample effect; not selected by Seymour yet. |

Back up the controller's existing presets before continuing. Replacing
`presets.json` can overwrite every preset already stored on the controller.
Download the existing `/presets.json` file or use WLED's backup facility, then
open the controller's `/edit` page and upload the Seymour file as
`presets.json`. Restart WLED if the new preset names do not appear immediately.

For a ring with a different pixel count, edit each segment's `stop` value. The
bundled value is `16`, which addresses pixels 0 through 15.

## Configure Seymour

Add the WLED block to MMM-Seymour in `config/config.js`:

```js
wled: {
  enabled: true,
  baseUrl: "http://wled-seymour.local",
  heartbeatInterval: 60000,
  presets: {
    open: 1,
    idle: 2,
    attention: 3,
    timerWarning: 4,
    timerFinished: 5,
    control: 6,
    focusing: null,
    breakActive: null,
    breakFinished: null
  }
}
```

Replace `baseUrl` with the controller's local hostname or reserved IP address.
Restart MagicMirror after changing its configuration.

The heartbeat reapplies the expected state every 60 seconds. It is useful when
WLED reboots or temporarily loses its network connection. Set
`heartbeatInterval: 0` to retain event-driven changes without a heartbeat.

## State priority

Only one WLED preset can own the ring at a time. Seymour resolves simultaneous
states in this order:

1. Selector open
2. System overlay open
3. Kitchen timer finished
4. FocusBreak break finished
5. Other attention
6. Kitchen timer warning
7. FocusBreak active break
8. Channel control mode
9. Active focus
10. Idle

Closing the selector restores the state beneath it. Dismissing a completed
timer restores another outstanding attention source, control mode, or idle as
appropriate. Attention is reference-counted by source, so one module cannot
clear another module's alert.

The optional mappings are backward-compatible. If `timerFinished` or
`breakFinished` is absent, Seymour uses `attention`. If `timerWarning`,
`control`, `focusing`, or `breakActive` is absent, Seymour uses `idle`. Existing
installations with only presets 1–3 therefore continue to work.

## FocusBreak semantics and preset reuse

[MMM-FocusBreak](https://github.com/bwente/MMM-FocusBreak) is optional. It
publishes ordinary MagicMirror lifecycle notifications and has no knowledge of
Seymour, WLED, controller addresses, or effects. Seymour translates those
notifications into three semantic states:

| State | Meaning | Default visual alias |
| --- | --- | --- |
| `focusing` | A focus session is running or paused. | `idle` |
| `breakActive` | A break is running or paused. | `idle` |
| `breakFinished` | A break ended and focus should resume. | `attention` |

Reuse is intentional. A calm idle effect and an established attention pulse
already form the appliance's visual language, so FocusBreak does not require
new WLED preset slots. Users who want distinct focus or break visuals can map
the optional keys to existing presets or explicitly create new ones in WLED.
Seymour never defines effects on behalf of FocusBreak.

`breakFinished` remains active until another focus session starts or FocusBreak
resets. Selector and higher-priority states temporarily override it; closing
the selector or heartbeat recovery restores it.

## Test the controller

Before testing through MagicMirror, select each preset from the WLED interface.
You can also request one locally in a browser:

```text
http://wled-seymour.local/win&PL=1
```

Then verify the integration in this order:

1. Start MagicMirror and confirm the idle preset.
2. Open and close Seymour's selector.
3. Enter and exit an interactive channel's control mode.
4. Start a short KitchenTimer and observe warning, completion, and dismissal.
5. Send attention from MessageCenter and confirm it remains active until read
   or otherwise acknowledged.
6. Restart WLED and confirm the heartbeat restores the current state.
7. If MMM-FocusBreak is installed, start focus, begin a break, and complete the
   break. With no new mappings, the ring should reuse idle, idle, and attention.

## Troubleshooting

- **No response:** open `baseUrl` from the Raspberry Pi and verify name
  resolution, Wi-Fi, and the WLED power supply.
- **Wrong effect:** confirm the preset numbers in WLED match the numbers in
  `config.wled.presets`.
- **Only presets 1–3 work:** add the optional mappings to the Seymour config and
  restart MagicMirror.
- **Ring changes back unexpectedly:** another state has higher priority, or the
  heartbeat is restoring Seymour's current state.
- **Effects address the wrong pixels:** update the segment start/stop values for
  the installed LED count.

WLED effects are presentation choices. Users may replace every color and effect
while retaining the semantic preset mapping.
