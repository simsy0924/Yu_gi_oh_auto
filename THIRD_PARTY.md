# Source and license notices

The integrated client is distributed under AGPL-3.0-or-later; see LICENSE.
The setup screen links to the complete source repository. All data and Lua assets
are served locally from the same deployment, without runtime third-party CDNs.

- **ocgcore-wasm 0.1.2**: MIT, copyright 2025 Simone Miraglia.
  [Source](https://github.com/n1xx1/ocgcore-wasm/tree/9f36452),
  [build scripts](https://github.com/n1xx1/ocgcore-wasm/tree/9f36452/scripts).
  `scripts/patch-core.mjs` backports the wasm32 CardData field offset correction
  from upstream commit `3c7d293077d656b9496c9c4014aaa299e1b43fff` and the SELECT_SUM
  parser correction from `1dabded283959f44a2c34494b5575434911b2c02`.
  The exact published JS input is guarded, and npm's integrity lock pins the
  original binary and source package. The WASM binary is unmodified.
- **YGOPro / EDOPro core**: AGPL-3.0-or-later.
  The wrapper release pins [core source 8e5f4e4](https://github.com/edo9300/ygopro-core/tree/8e5f4e4f0ab6b8ca750e8e1c91c1a58f407e3272).
- **Lua**: MIT. The wrapper release pins
  [Lua source 75ea9cc](https://github.com/lua/lua/tree/75ea9ccbea7c4886f30da147fb67b693b2624c26).
  Copyright and license: https://www.lua.org/license.html
- **ProjectIgnis/CardScripts**: AGPL-3.0-or-later. Lua scripts are included in
  source form in the gzip JSON bundle, preserving their comments. Revision and
  source URL are in `public/engine/sources.json`.
- **ProjectIgnis/BabelCDB**: official and prerelease master-rule card data.
  Revision and source URL are in `public/engine/sources.json`. Card names and
  text belong to their respective rights holders. No card images are included.
- **Korean card names and text**: refreshed from the pinned
  [YAML Yugi card catalog](https://github.com/DawnbrandBots/yaml-yugi/tree/eb6042f1a33661ca570c29939f7aa70807119857/data/cards),
  which derives Korean entries from the official Yu-Gi-Oh! Neuron OCG Card
  Database. The source revision is recorded in `public/engine/sources.json`.
  `<ruby>` reading annotations are removed from names, and `<br>` separators in
  effects become plain line breaks because the client escapes catalog text.
  Cards without matching Korean data retain BabelCDB's name/text. Regenerate
  with `python3 scripts/prepare-ko.py /path/to/yaml-yugi/data/cards`; the script
  checks that the source checkout matches the pinned revision.
- **Korean effect-choice strings**: extracted from the community
  [EDOPro Korean database](https://github.com/Team-AllYGOPro/edopro-korean),
  AGPL-3.0. The pinned revision is recorded in `public/engine/sources.json`.
  Only the 16 effect strings for cards in the bundled core database are included.
  Regenerate with `python3 scripts/prepare-ko-strings.py /path/to/edopro-korean/cards.cdb`.
- **Additional Korean card names and text**: used where the official Korean card
  catalog has no entry, from the pinned EDOPro Korean `cards.cdb` at the same
  revision listed above, and from project-maintained provisional translations.
  Provisional card names are marked `(임시 번역)`. These entries remain in
  `public/engine/ko-overrides.json` so catalog generation preserves them.

License copies are also published under `public/licenses/`.
