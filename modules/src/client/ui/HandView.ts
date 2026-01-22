import { decodeCardTypeArg, getCardName, getCardTooltipHtml, getCardValue, isInterruptCard } from "../domain/CardRules";

export type HandViewRenderArgs = {
  hand: Card[];
  selectedCardIds: number[];
  isReactionPhase: boolean;
  isThreesome?: boolean;
  onCardClick: (cardId: number) => void;
  attachTooltip?: (nodeId: string, html: string) => void;
};

export class HandView {
  render(args: HandViewRenderArgs): void {
    const handArea = document.getElementById("hand-area");
    if (!handArea) return;

    handArea.innerHTML = '<h3>Your Hand</h3><div id="hand-cards"></div>';
    const handCards = document.getElementById("hand-cards");
    if (!handCards) return;

    args.hand.forEach((card) => {
      const cardDiv = document.createElement("div");
      cardDiv.className = "card";
      cardDiv.id = `dlpq-card-hand-${card.id}`;
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

      cardDiv.addEventListener("click", () => args.onCardClick(card.id));

      if (args.selectedCardIds.includes(card.id)) {
        cardDiv.classList.add("selected");
      }

      // Highlight interrupt cards during reaction phase
      // If it's a threesome, only highlight "I told you no dude" (name_index === 2)
      if (args.isReactionPhase && interrupt) {
        if (args.isThreesome) {
          // Only highlight "I told you no dude" for threesomes
          if (decoded.name_index === 2) {
            cardDiv.classList.add("interrupt-card");
          }
        } else {
          // Highlight all interrupt cards for regular cards
          cardDiv.classList.add("interrupt-card");
        }
      }

      handCards.appendChild(cardDiv);

      // Attach tooltip after element is in DOM.
      if (args.attachTooltip) {
        args.attachTooltip(cardDiv.id, getCardTooltipHtml(card));
      }
    });
  }
}
