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
- **Korean text**: reused from this repository's existing July 2026 catalog
  (`da20f72`, `public/data/ygo-ko-cards/part-*.json`). Only records not flagged as
  unofficial translations are used. The original catalog was derived from
  [YAML Yugi](https://github.com/DawnbrandBots/yaml-yugi), with Korean text from
  the official Yu-Gi-Oh! Neuron OCG Card Database. Cards without a matching
  Korean record retain BabelCDB's name/text. The bundle can be regenerated with
  `python3 scripts/prepare-ko.py /path/to/original/catalog`.

License copies are also published under `public/licenses/`.
