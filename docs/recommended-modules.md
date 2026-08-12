# Recommended MagicMirror modules

Seymour is intentionally an interaction layer, not a replacement for the
MagicMirror ecosystem. A channel should normally be an existing MagicMirror
module configured for a small landscape display. Prefer modules that work
locally, provide a focused single-purpose view, and remain usable without
Seymour-specific patches.

## Foundation

| Module | Role | Status |
| --- | --- | --- |
| [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror) | Application framework and bundled modules. | Required |
| [MMM-pages](https://github.com/edward-shen/MMM-pages) | Assigns modules to numbered channels. | Required |
| [MMM-MessageCenter](https://github.com/bwente/MMM-MessageCenter) | Shared notification inbox and semantic attention events. | Strongly recommended |
| [MMM-Remote-Control](https://github.com/Jopyth/MMM-Remote-Control) | Browser-based administration, restart, update, and remote actions. | Strongly recommended |

Keep MMM-Seymour, MMM-pages, and MMM-Remote-Control in the MMM-pages `fixed`
list so their integration remains available on every channel.

## Start with bundled modules

MagicMirror's bundled modules provide a dependable first-run experience with
no additional repositories:

- `clock` — a calm default or home channel;
- `calendar` — local or network calendar feeds;
- `weather` — current conditions and forecast;
- `newsfeed` — headlines and ambient updates;
- `alert` — the standard MagicMirror alert surface.

The [stock configuration](../examples/stock-modules.config.js) demonstrates
Clock, Calendar, Weather, and News channels. Seymour should remain useful with
this small installation before optional integrations are added.

## Appliance-oriented additions

| Module | Suggested channel | Integration notes |
| --- | --- | --- |
| [MMM-KitchenTimer](https://github.com/bwente/MMM-KitchenTimer) | Timer | Local timer with large touch targets. Seymour can focus its page and present warning/completion states. Generic focus mode allows encoder control. |
| [MMM-MusicAssistant-Controller](https://github.com/bwente/MMM-MusicAssistant-Controller) | Music | Compact local-first Music Assistant controls. Notification mappings support direct volume and deliberate encoder interaction. |
| [MMM-CalendarExt3](https://github.com/MMRIZE/MMM-CalendarExt3) | Calendar | Rich calendar overview for a dedicated page. Use restrained ranges and typography on a 1024×600 display. |
| [MMM-CalendarExt3Agenda](https://github.com/MMRIZE/MMM-CalendarExt3Agenda) | Agenda | Agenda-oriented alternative when a two-week grid is too dense. |
| [MMM-RTSPStream](https://github.com/shbatm/MMM-RTSPStream) | Camera | Local camera or doorbell feed. Use Seymour's selector lifecycle hooks when a native player would otherwise cover the selector. |
| [MMM-HomeAssistant](https://github.com/BenRoe/MMM-HomeAssistant) | Home | Optional home-control/status page. Keep core Seymour behavior independent of Home Assistant. |

Companion modules are optional. Their semantic notifications and accessible DOM
controls improve integration, but they must continue to work as ordinary
MagicMirror modules without Seymour, GPIO, or WLED.

## Notification foundation

MessageCenter is optional as a dependency, but it is the recommended
notification foundation for an appliance-style Seymour installation. It gives
otherwise unrelated sources one message schema and one history, while
publishing semantic attention instead of issuing device-specific commands.

That boundary is important:

- Message sources do not need to know whether attention means WLED, sound, a
  page change, or only an on-screen toast.
- MessageCenter remains useful on an ordinary MagicMirror without Seymour or
  special hardware.
- Seymour remains useful as a channel interface without MessageCenter.
- Integrations can be added or replaced without changing every notification
  producer.

Start with the stock example for the smallest dependency set. Use the
[showcase configuration](../examples/showcase.config.js) as the recommended
next step when evaluating Seymour as an ambient appliance.

## Photos and backgrounds

Photo channels need special care on a Raspberry Pi. Avoid having a slideshow
perform synchronous recursive scans or runtime resizing directly on an SMB/NFS
mount. A stalled network filesystem can block MagicMirror for minutes even
while the PM2 process remains online.

For a reliable appliance:

1. Synchronize photos into a local cache outside the MagicMirror process.
2. Preserve the last successful cache when the server is unavailable.
3. Ignore metadata files such as `._*`.
4. Pre-size images for the display when practical.
5. Point the slideshow module only at the local directory.

Background and animation modules are optional decoration, not launch
requirements. Test their CPU usage, text-color rules, stacking, and touch input
on the actual Raspberry Pi before including them in a default setup.

## Choosing another module

A module is a good Seymour channel candidate when it:

- fits a single 1024×600 landscape viewport without scrolling;
- suspends or stops expensive work while its MMM-pages page is hidden;
- uses accessible buttons or accepts semantic MagicMirror notifications;
- does not require a cloud service for basic operation;
- avoids global overlays and CSS that intercept input on other pages; and
- recovers cleanly when its network service is unavailable.

If a module has no custom artwork, use the theme's `placeholder.png`. Channel
art is presentation configuration; it should not require modifying the module.

## Configuration boundaries

Keep these concerns separate:

- **Source module:** data, playback, timer, camera, or notification behavior.
- **MMM-pages:** which source modules appear on each numbered channel.
- **MMM-Seymour:** navigation, generic interaction, page focus, and semantic
  appliance state.
- **Personal `config.js`:** service URLs, credentials, calendar feeds, channel
  order, and WLED preset numbers.
- **Hardware project:** wiring, enclosure, firmware backup, and physical build.

Never commit a live personal `config.js`, access token, camera URL, calendar
feed, or Wi-Fi credential to a public repository.
