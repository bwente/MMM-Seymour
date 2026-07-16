# MMM-Seymour

MMM-Seymour is a keyboard-driven visual page selector for
[MagicMirror²](https://magicmirror.builders/) installations that use
[MMM-pages](https://github.com/edward-shen/MMM-pages). Press Enter to open the
selector, use the left and right arrow keys to choose a channel, and press Enter
again to send `PAGE_CHANGED` to MMM-pages.

## Hardware

The module has no dedicated hardware dependencies. A typical installation uses:

- a Raspberry Pi or other computer capable of running MagicMirror²;
- a display supported by that computer; and
- a USB, Bluetooth, GPIO-to-keyboard, or remote-control device that emits the
  standard `Enter`, `Escape`, `ArrowLeft`, and `ArrowRight` browser key events.

Bluetooth and wireless keyboards may introduce pairing or wake-from-sleep
behavior outside this module. GPIO buttons need a separate service or module to
translate button presses into keyboard events.

## Installation

From the MagicMirror `modules` directory:

```sh
git clone YOUR_REPOSITORY_URL MMM-Seymour
```

No runtime package installation is required. Add the module to `config/config.js`
and ensure MMM-pages is installed and configured.

## Configuration

```js
{
  module: "MMM-Seymour",
  position: "fullscreen_above",
  config: {
    selectorSize: "medium",
    showLabels: true,
    enableKeyboard: true,
    channels: [
      { label: "Clock", page: 0, thumbnail: "clock.png" },
      { label: "Weather", page: 1, thumbnail: "weather.png" },
      { label: "News", page: 2, thumbnail: "news.png" }
    ]
  }
}
```

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `selectorSize` | string | `"medium"` | Thumbnail preset: `small`, `medium`, or `large`. |
| `showLabels` | boolean | `true` | Show the channel label below each image. |
| `enableKeyboard` | boolean | `true` | Register the global keyboard controls. |
| `channels` | array | `[]` | Ordered list of pages available in the selector. |

Each channel accepts `label`, a zero-based MMM-pages `page`, and a `thumbnail`
filename from `assets/themes/default`. Missing thumbnail names use
`placeholder.png`.

## Controls

| Key | Action |
| --- | --- |
| Enter | Open the selector or activate the selected page. |
| Left / Right | Move through channels while the selector is open. |
| Escape | Close the selector without changing pages. |

Keyboard shortcuts are ignored while typing in input, select, textarea, or
content-editable elements.

## Development

Run the dependency-free unit tests with Node.js 18 or newer:

```sh
npm test
```

The browser integration should also be tested in the same MagicMirror² and
MMM-pages versions used by the target mirror.

## Release checklist

- Replace `YOUR_REPOSITORY_URL` after creating the GitHub repository.
- Choose and add a license before making the repository public.
- Confirm that every bundled image may be redistributed under that license.
- Test keyboard input and page changes on the target hardware.

## License

No license has been selected yet. Until one is added, the source and images are
not granted for reuse or redistribution.
