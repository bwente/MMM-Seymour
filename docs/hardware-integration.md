# Hardware integration

The mechanical, electrical, CAD, fabrication, and assembly work for Seymour
lives in the companion
[Seymour-Hardware](https://github.com/bwente/Seymour-Hardware) repository.

MMM-Seymour's hardware-facing contract is intentionally small:

| Intended action | Required browser key event |
| --- | --- |
| Open or activate | `Enter` |
| Previous channel | `ArrowLeft` |
| Next channel | `ArrowRight` |
| Cancel | `Escape` |

The physical interface may use USB, Bluetooth, GPIO-to-keyboard, or another
controller, but it must emit these standard browser keyboard events. Enter key
repeat is ignored; arrow-key repeat is supported.

## Shared integration points

- MMM-pages indexes are zero-based non-negative integers.
- MMM-Seymour must be in MMM-pages' `fixed` list.
- The selector tracks `NEW_PAGE`, `PAGE_NUMBER_IS`, and `MAX_PAGES_CHANGED`.
- WLED presets `1` (selector open) and `2` (selector closed) are provisional
  hardware requirements and are not implemented in this software baseline.
- The historical WLED hostname is `wled-seymour.local`.

The authoritative draft contract and measurement worksheets live in
Seymour-Hardware. Changes to controls, WLED behavior, channel numbering, or
display geometry should update both repositories and be validated on the
physical mirror.
