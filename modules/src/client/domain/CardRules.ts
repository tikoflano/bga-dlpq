export type DecodedCardTypeArg = { name_index: number; value: number; isAlarm: boolean };

/**
 * Decode card_type_arg to get name_index, value, and isAlarm
 * Format: name_index * 10000 + value * 100 + (isAlarm ? 1 : 0)
 * Value range: 0-3 (potato cards always have value 0)
 */
export function decodeCardTypeArg(typeArg: number): DecodedCardTypeArg {
  const isAlarm = typeArg % 100 === 1;
  const value = Math.floor((typeArg % 10000) / 100);
  const nameIndex = Math.floor(typeArg / 10000);
  return { name_index: nameIndex, value, isAlarm };
}

const CARD_NAMES: Record<string, Record<number, string>> = {
  potato: {
    1: _("potato"),
    2: _("duchesses potatoes"),
    3: _("french fries"),
  },
  action: {
    1: _("No dude"),
    2: _("I told you no dude"),
    3: _("Get off the pony"),
    4: _("Lend me a buck"),
    5: _("Runaway potatoes"),
    6: _("Harry Potato"),
    7: _("Pope Potato"),
    8: _("Look ahead"),
    9: _("The potato of the year"),
    10: _("Potato of destiny"),
    11: _("Potato Dawan"),
    12: _("Jump to the side"),
    13: _("Papageddon"),
    14: _("Spider potato"),
  },
  wildcard: {
    1: _("Wildcard"),
  },
};

/**
 * Get card name by type and name_index.
 */
export function getCardName(card: Card): string {
  const decoded = decodeCardTypeArg(card.type_arg || 0);
  return CARD_NAMES[card.type]?.[decoded.name_index] || _("Unknown Card");
}

export function getCardValue(card: Card): number {
  const decoded = decodeCardTypeArg(card.type_arg || 0);
  return decoded.value;
}

/**
 * Check if a card is an interrupt card (No dude or I told you no dude).
 */
export function isInterruptCard(card: Card): boolean {
  if (card.type !== "action") return false;
  const decoded = decodeCardTypeArg(card.type_arg || 0);
  // name_index 1 = "No dude", name_index 2 = "I told you no dude"
  return decoded.name_index === 1 || decoded.name_index === 2;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toHtmlText(text: string): string {
  // Escape then convert newlines to <br/> for tooltip readability.
  return escapeHtml(text).replaceAll("\n", "<br/>");
}

function getPotatoThreesomeReward(nameIndex: number): number {
  // Based on GAME_RULES.md placeholder rules.
  // potato -> 1, duchesses potatoes -> 2, french fries -> 3
  if (nameIndex === 1) return 1;
  if (nameIndex === 2) return 2;
  if (nameIndex === 3) return 3;
  return 0;
}

function getActionCardEffectText(nameIndex: number): string {
  // Placeholder texts based on ACTION_CARDS.md / GAME_RULES.md.
  switch (nameIndex) {
    case 1:
      return _(
        "Interrupt card.\nCancels a regular card or another “No dude”.\nCannot cancel “I told you no dude” or threesomes.",
      );
    case 2:
      return _(
        "Interrupt card.\nCancels anything: regular cards, “No dude”, “I told you no dude”, and threesomes.",
      );
    case 3:
      return _("Steal 1 golden potato from a target player.");
    case 4:
      return _("Steal 1 card from a target player (blind selection).");
    case 5:
      return _("Each other player returns 1 random card from their hand to the deck. Then shuffle the deck.");
    case 6:
      return _("Draw 2 cards from the deck.");
    case 7:
      return _("Choose a target and name a card. If they have it, steal 1 copy of that card.");
    case 8:
      return _("Destroy 1 golden potato from a target player.");
    case 9:
      return _("Gain 1 golden potato from the supply.");
    case 10:
      return _("Target discards their entire hand, then draws 2 new cards.");
    case 11:
      return _("See an opponent's hand and steal a card from it.");
    case 12:
      return _("Draw 1 card. The next player skips their turn.");
    case 13:
      return _("Reverse turn order. Steal 1 card from the next player (blind selection).");
    case 14:
      return _("Choose 2 players. Those players exchange hands (can include you).");
    default:
      return _("No tooltip text yet for this card.");
  }
}

/**
 * Return HTML for a card tooltip. Tooltip visibility is controlled by BGA's
 * built-in “Display tooltips” preference.
 */
export function getCardTooltipHtml(card: Card): string {
  const decoded = decodeCardTypeArg(card.type_arg || 0);
  const title = getCardName(card);

  let body = "";
  const meta: string[] = [];

  if (card.type === "potato") {
    const reward = getPotatoThreesomeReward(decoded.name_index);
    body =
      reward > 0
        ? _("Potato card.\nCollect 3 matching potatoes (wildcards allowed) to gain ${n} golden potatoes.")
            .replace("${n}", String(reward))
        : _("Potato card.\nCollect 3 matching potatoes (wildcards allowed) to gain golden potatoes.");
    meta.push(_("Cannot be played by itself."));
    return `
      <div class="dlpq-tooltip">
        <div class="dlpq-tooltip-title">${escapeHtml(title)}</div>
        <div class="dlpq-tooltip-body">${toHtmlText(body)}</div>
        <div class="dlpq-tooltip-meta">${meta.map((m) => `<div>${toHtmlText(m)}</div>`).join("")}</div>
      </div>
    `;
  }

  if (card.type === "wildcard") {
    body = _("Wildcard.\nCounts as any potato for potato threesomes.");
    meta.push(_("Cannot be played by itself."));
    return `
      <div class="dlpq-tooltip">
        <div class="dlpq-tooltip-title">${escapeHtml(title)}</div>
        <div class="dlpq-tooltip-body">${toHtmlText(body)}</div>
        <div class="dlpq-tooltip-meta">${meta.map((m) => `<div>${toHtmlText(m)}</div>`).join("")}</div>
      </div>
    `;
  }

  // Action cards
  body = getActionCardEffectText(decoded.name_index);
  if (decoded.value > 0) {
    meta.push(_("Value: ${n}").replace("${n}", String(decoded.value)));
  } else {
    meta.push(_("Value: 0"));
  }
  if (decoded.isAlarm) {
    meta.push(_("Alarm: if not interrupted, your turn ends after the reaction phase."));
  }
  if (decoded.name_index === 1 || decoded.name_index === 2) {
    meta.push(_("Playable during reaction phase only."));
  }

  return `
    <div class="dlpq-tooltip">
      <div class="dlpq-tooltip-title">${escapeHtml(title)}</div>
      <div class="dlpq-tooltip-body">${toHtmlText(body)}</div>
      <div class="dlpq-tooltip-meta">${meta.map((m) => `<div>${toHtmlText(m)}</div>`).join("")}</div>
    </div>
  `;
}

export type ValidPlayFromSelection =
  | { kind: "single"; cardId: number; label: string }
  | { kind: "threesome_potato"; cardIds: number[]; label: string }
  | { kind: "threesome_value3"; cardIds: number[]; label: string };

export function getValidPlayFromSelection(
  hand: Card[] | undefined,
  selectedCardIds: number[],
): ValidPlayFromSelection | null {
  const byId = new Map<number, Card>((hand || []).map((c) => [c.id, c]));
  const selected = selectedCardIds.map((id) => byId.get(id)).filter((c): c is Card => !!c);

  if (selected.length === 1) {
    const card = selected[0];
    const decoded = decodeCardTypeArg(card.type_arg || 0);

    // Potato cards, wildcards, and interrupt cards cannot be played by themselves.
    if (card.type === "potato" || card.type === "wildcard" || isInterruptCard(card)) {
      return null;
    }

    const cardName = getCardName(card);
    const label = decoded.isAlarm
      ? _("Play ${card_name} and end turn").replace("${card_name}", cardName)
      : _("Play ${card_name}").replace("${card_name}", cardName);

    return { kind: "single", cardId: card.id, label };
  }

  if (selected.length !== 3) {
    return null;
  }

  const wildcards = selected.filter((c) => c.type === "wildcard");
  const potatoes = selected.filter((c) => c.type === "potato");

  // 3 wildcards => threesome of french fries
  if (wildcards.length === 3) {
    const label = _("Play threesome of ${threesome_name}").replace("${threesome_name}", _("french fries"));
    return { kind: "threesome_potato", cardIds: selectedCardIds.slice(), label };
  }

  // Potato threesome with 0-2 wildcards (potatoes must share the same name)
  if (potatoes.length + wildcards.length === 3 && wildcards.length <= 2 && potatoes.length >= 1) {
    const potatoNames = potatoes.map((c) => decodeCardTypeArg(c.type_arg || 0).name_index);
    const uniquePotatoNames = Array.from(new Set(potatoNames));
    if (uniquePotatoNames.length === 1) {
      const threesomeName = getCardName(potatoes[0]);
      const label = _("Play threesome of ${threesome_name}").replace("${threesome_name}", threesomeName);
      return { kind: "threesome_potato", cardIds: selectedCardIds.slice(), label };
    }
  }

  // 3 cards of any type with value == 3 each
  const allValue3 = selected.every((c) => getCardValue(c) === 3);
  if (allValue3) {
    return { kind: "threesome_value3", cardIds: selectedCardIds.slice(), label: _("Play threesome") };
  }

  return null;
}

