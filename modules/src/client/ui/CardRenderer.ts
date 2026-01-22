import {
  decodeCardTypeArg,
  getCardName,
  getCardTooltipHtml,
  getCardValue,
  isInterruptCard,
} from "../domain/CardRules";

export type CardRenderOptions = {
  card: Card;
  selected?: boolean;
  isReactionPhase?: boolean;
  isThreesome?: boolean;
  onClick?: (cardId: number) => void;
  attachTooltip?: (nodeId: string, html: string) => void;
  customId?: string; // Optional custom ID prefix (default: "dlpq-card-hand")
  customClassName?: string; // Optional additional class names
};

/**
 * Shared utility for rendering card elements.
 * Ensures consistent card appearance and behavior across the application.
 */
export class CardRenderer {
  /**
   * Attaches tooltip to a card element that was created with createCardElement.
   * Call this after the element has been appended to the DOM.
   */
  static attachTooltipAfterAppend(cardElement: HTMLDivElement): void {
    const tooltipCallback = (cardElement as any)._tooltipCallback;
    const card = (cardElement as any)._cardForTooltip;
    if (tooltipCallback && card) {
      tooltipCallback(cardElement.id, getCardTooltipHtml(card));
    }
  }
  /**
   * Creates and returns a card DOM element with proper styling and event handlers.
   * The element is not yet attached to the DOM - caller should append it.
   */
  static createCardElement(options: CardRenderOptions): HTMLDivElement {
    const {
      card,
      selected = false,
      isReactionPhase = false,
      isThreesome = false,
      onClick,
      attachTooltip,
      customId = "dlpq-card-hand",
      customClassName = "",
    } = options;

    const cardDiv = document.createElement("div");
    cardDiv.className = `card ${customClassName}`.trim();
    cardDiv.id = `${customId}-${card.id}`;
    cardDiv.dataset.cardId = card.id.toString();

    const cardName = getCardName(card);
    const cardValue = getCardValue(card);
    const decoded = decodeCardTypeArg(card.type_arg || 0);
    const interrupt = isInterruptCard(card);

    cardDiv.innerHTML = `
      ${decoded.isAlarm ? '<div class="alarm-dot" title="' + _("Alarm") + '"></div>' : ""}
      <div class="card-type">${card.type}</div>
      <div class="card-name">${cardName}</div>
      <div class="card-value">Value: ${cardValue}</div>
    `;

    if (onClick) {
      cardDiv.addEventListener("click", () => onClick(card.id));
    }

    if (selected) {
      cardDiv.classList.add("selected");
    }

    // Highlight interrupt cards during reaction phase
    // If it's a threesome, only highlight "I told you no dude" (name_index === 2)
    if (isReactionPhase && interrupt) {
      if (isThreesome) {
        // Only highlight "I told you no dude" for threesomes
        if (decoded.name_index === 2) {
          cardDiv.classList.add("interrupt-card");
        }
      } else {
        // Highlight all interrupt cards for regular cards
        cardDiv.classList.add("interrupt-card");
      }
    }

    // Note: Tooltip attachment should be done by caller after element is appended to DOM
    // We store the tooltip callback and card for later attachment
    if (attachTooltip) {
      // Store reference for later tooltip attachment after element is in DOM
      // Caller should call attachTooltipAfterAppend after appending to DOM
      (cardDiv as any)._tooltipCallback = attachTooltip;
      (cardDiv as any)._cardForTooltip = card;
    }

    return cardDiv;
  }

  /**
   * Creates a card element from revealed card data (used in card selection).
   * Converts the revealed card data structure to a Card-like object.
   */
  static createCardElementFromRevealed(
    revealedCard: {
      position: number;
      card_id: number;
      type: string;
      type_arg: number;
      name_index: number;
      value: number;
      is_alarm: boolean;
    },
    options: {
      onClick?: (position: number) => void;
      attachTooltip?: (nodeId: string, html: string) => void;
    }
  ): HTMLDivElement {
    // Convert revealed card data to Card format
    const card: Card = {
      id: revealedCard.card_id,
      type: revealedCard.type,
      type_arg: revealedCard.type_arg,
    };

    return this.createCardElement({
      card,
      onClick: options.onClick ? () => options.onClick!(revealedCard.position) : undefined,
      attachTooltip: options.attachTooltip,
      customId: "dlpq-card-selection",
    });
  }
}
