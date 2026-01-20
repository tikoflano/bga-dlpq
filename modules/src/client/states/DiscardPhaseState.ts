import type { Game } from "../Game";
import type { ClientStateHandler } from "./ClientStateHandler";

export class DiscardPhaseState implements ClientStateHandler {
  constructor(private game: Game) {}

  onEnter(args: any): void {
    // Only show UI for the active player
    if (!this.game.bga.gameui.isCurrentPlayerActive()) return;

    this.hide();

    const discardDiv = document.createElement("div");
    discardDiv.id = "discard-phase-ui";
    discardDiv.className = "discard-phase";
    discardDiv.innerHTML = `
            <h3>Discard Cards</h3>
            <p>You have ${args.handSize} cards. Discard ${args.cardsToDiscard} to get down to 7.</p>
            <div id="discard-selection-area"></div>
            <button id="confirm-discard" disabled>Confirm Discard</button>
        `;
    this.game.bga.gameArea.getElement().appendChild(discardDiv);

    const selectionArea = document.getElementById("discard-selection-area");
    if (!selectionArea) return;

    const selectedForDiscard: number[] = [];
    if (args.hand && Array.isArray(args.hand)) {
      args.hand.forEach((card: Card) => {
        const cardDiv = document.createElement("div");
        cardDiv.className = "discard-card";
        cardDiv.dataset.cardId = card.id.toString();
        cardDiv.innerHTML = `Card ${card.id}`;

        cardDiv.addEventListener("click", () => {
          if (cardDiv.classList.contains("selected")) {
            cardDiv.classList.remove("selected");
            const index = selectedForDiscard.indexOf(card.id);
            if (index > -1) selectedForDiscard.splice(index, 1);
          } else {
            cardDiv.classList.add("selected");
            selectedForDiscard.push(card.id);
          }

          const confirmBtn = document.getElementById("confirm-discard") as HTMLButtonElement;
          if (confirmBtn) {
            confirmBtn.disabled = selectedForDiscard.length < args.cardsToDiscard;
          }
        });

        selectionArea.appendChild(cardDiv);
      });
    }

    const confirmBtn = document.getElementById("confirm-discard");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => {
        if (selectedForDiscard.length >= args.cardsToDiscard) {
          this.game.bga.actions.performAction("actDiscardCards", {
            card_ids: selectedForDiscard,
          });
        }
      });
    }
  }

  onLeave(): void {
    this.hide();
  }

  private hide(): void {
    const discardDiv = document.getElementById("discard-phase-ui");
    if (discardDiv) discardDiv.remove();
  }
}

