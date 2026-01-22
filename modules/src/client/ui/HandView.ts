import { CardRenderer } from "./CardRenderer";

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
      const cardDiv = CardRenderer.createCardElement({
        card,
        selected: args.selectedCardIds.includes(card.id),
        isReactionPhase: args.isReactionPhase,
        isThreesome: args.isThreesome,
        onClick: args.onCardClick,
        attachTooltip: args.attachTooltip,
      });

      handCards.appendChild(cardDiv);
      
      // Attach tooltip after element is in DOM
      if (args.attachTooltip) {
        CardRenderer.attachTooltipAfterAppend(cardDiv);
      }
    });
  }
}
