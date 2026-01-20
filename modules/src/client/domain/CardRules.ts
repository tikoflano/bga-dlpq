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

