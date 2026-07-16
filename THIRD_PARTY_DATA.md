# Third-party card data

`public/data/ygo-ko-cards/` contains a chunked, reduced snapshot generated on
2026-07-15. `manifest.json` records the source metadata and ordered part list;
the `part-*.json` files contain the card records. The snapshot was generated
from the [YAML Yugi](https://github.com/DawnbrandBots/yaml-yugi) OCG/TCG card
aggregation. Korean card names and text originate primarily from the official
[Yu-Gi-Oh! Neuron OCG Card Database](https://www.db.yugioh-card.com/yugiohdb/?request_locale=ko).

The snapshot contains card identifiers, Korean names and text, card type,
monster statistics, summoning materials, Pendulum text, and Link markers. It
does not contain card images, set lists, prices, or rulings. Community
translations for cards not yet released in Korea are flagged in the data and in
the application UI.

Yu-Gi-Oh! card names and card text are the property of their respective rights
holders. YAML Yugi's pipeline source is licensed separately under AGPL-3.0-or-
later; see its repository for details.
