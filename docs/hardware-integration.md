# Hardware integration

The mechanical, electrical, CAD, fabrication, and assembly work for Seymour
lives in the companion
[Seymour-Hardware](https://github.com/bwente/Seymour-Hardware) repository.

MMM-Seymour's hardware-facing contract is intentionally small:

| Intended action | Browser key | MagicMirror notification |
| --- | --- | --- |
| Open or activate | `Enter` | `SEYMOUR_PRESS` |
| Previous channel | `ArrowLeft` | `SEYMOUR_ROTATE_LEFT` |
| Next channel | `ArrowRight` | `SEYMOUR_ROTATE_RIGHT` |
| Cancel | `Escape` | — |

The physical interface may use USB, Bluetooth, GPIO-to-keyboard, or another
controller, but it must emit these standard browser keyboard events. Enter key
repeat is ignored; arrow-key repeat is supported.

## Shared integration points

- MMM-pages indexes are zero-based non-negative integers.
- MMM-Seymour must be in MMM-pages' `fixed` list.
- The selector tracks `NEW_PAGE`, `PAGE_NUMBER_IS`, and `MAX_PAGES_CHANGED`.
- WLED is the selected appliance-light controller. It defaults to presets `1`
  (selector open), `2` (idle), and `3` (attention), all configurable under
  `config.wled`.
- Attention remains active after the selector closes until `ATTENTION_OFF` is
  received from every module that raised it.
- The historical default WLED hostname is `wled-seymour.local`.

The authoritative draft contract and measurement worksheets live in
Seymour-Hardware. Changes to controls, WLED behavior, channel numbering, or
display geometry should update both repositories and be validated on the
physical mirror.
