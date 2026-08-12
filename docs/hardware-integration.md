# Hardware integration

The mechanical, electrical, CAD, fabrication, and assembly work for Seymour
lives in the companion Seymour-Hardware project. It remains private while the
prototype files and assembly documentation are prepared for release.

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
- Interactive channels may map rotation and press events to semantic
  MagicMirror notifications. Seymour owns double-press recognition and the
  interaction timeout; participating modules remain independent of GPIO.
- A single encoder press retains channel-selector behavior. A configured
  channel uses a double press to enter interaction mode, rotation to move focus,
  and a deliberate press to activate the focused control.
- Modules with accessible HTML controls can opt into `controls.mode: "focus"`;
  Seymour then provides generic tab-style focus and activation without requiring
  module-specific notification handlers.
- WLED is an optional appliance-light controller and is disabled by default.
  When enabled, its default presets are `1` (selector open), `2` (idle), and
  `3` (attention), all configurable under `config.wled`. Optional mappings add
  timer warning, timer completion, and channel control mode without placing
  WLED details in the participating modules.
- WLED state priority is selector, timer finished, attention, timer warning,
  control mode, then idle. Missing optional mappings fall back to the original
  attention or idle states.
- Attention remains active after the selector closes until `ATTENTION_OFF` is
  received from every module that raised it.
- The historical default WLED hostname is `wled-seymour.local`.

See [WLED setup](wled.md) for the preset pack, configuration, state table, and
test procedure.

The authoritative draft contract and measurement worksheets live in
Seymour-Hardware. Changes to controls, WLED behavior, channel numbering, or
display geometry should update both repositories and be validated on the
physical mirror.
