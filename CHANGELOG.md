# Changelog

All notable changes to MMM-Seymour will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project intends to use [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Audrey-inspired, appliance-oriented channel selector for MMM-pages.
- Touch, keyboard, GPIO notification, and rotary-encoder navigation.
- Generic focus mode for interacting with accessible controls in other modules.
- Semantic channel controls for modules that accept MagicMirror notifications.
- Optional MMM-Remote-Control API integration.
- Optional WLED states for idle, selector, attention, timer, and control modes.
- WLED heartbeat recovery after controller restarts or network interruptions.
- Default and dark channel-art themes with placeholder artwork.
- Stock-module configuration, WLED presets, hardware contract, and module guide.
- Dependency-free Node.js unit test suite.

### Changed

- Encoder-selected channels remain centered in an overflowing selector.
- Attention is tracked by sender so one module cannot clear another module's
  active alert.
- Timer focus and attention delivery remain active even when its page is not
  currently visible.

## [0.1.0] - Unreleased

First public-preview release. The release date will be added after clean-install
and appliance validation are complete.

[Unreleased]: https://github.com/bwente/MMM-Seymour/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/bwente/MMM-Seymour/releases/tag/v0.1.0
