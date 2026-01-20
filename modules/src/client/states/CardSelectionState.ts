import type { Game } from "../Game";
import type { ClientStateHandler } from "./ClientStateHandler";

export class CardSelectionState implements ClientStateHandler {
  private dialog: PopinDialog | null = null;

  constructor(private game: Game) {}

  onEnter(args: any): void {
    const a = args?.args || args;
    this.show(a);
  }

  onLeave(): void {
    this.hide();
  }

  private show(args: any): void {
    if (!this.game.bga.gameui.isCurrentPlayerActive()) return;

    this.hide();

    this.dialog = new ebg.popindialog();
    this.dialog.create("card-selection-dialog");
    this.dialog.setTitle(
      _("Select a card from ${target_name}'s hand").replace("${target_name}", args.targetPlayerName || ""),
    );
    this.dialog.setMaxWidth(600);
    this.dialog.hideCloseIcon();

    let cardsHtml = '<div id="card-selection-cards" style="text-align: center; padding: 20px;">';
    if (args.cardBacks && Array.isArray(args.cardBacks)) {
      args.cardBacks.forEach((cardBack: any) => {
        cardsHtml += `
          <div class="card-back" 
               data-position="${cardBack.position}" 
               data-card-id="${cardBack.card_id}"
               style="width: 60px; height: 90px; background-color: #8B0000; border: 2px solid #000; border-radius: 5px; cursor: pointer; display: inline-block; margin: 5px;">
          </div>
        `;
      });
    }
    cardsHtml += "</div>";

    this.dialog.setContent(cardsHtml);
    this.dialog.show();

    setTimeout(() => {
      const cardsDiv = document.getElementById("card-selection-cards");
      if (!cardsDiv) return;

      const cardBacks = cardsDiv.querySelectorAll(".card-back");
      cardBacks.forEach((backDiv) => {
        backDiv.addEventListener("click", () => {
          const position = parseInt((backDiv as HTMLElement).dataset.position || "0");
          this.game.bga.actions.performAction("actSelectCard", {
            cardPosition: position,
          });
          this.hide();
        });
      });
    }, 100);
  }

  private hide(): void {
    if (this.dialog) {
      this.dialog.hide();
      this.dialog.destroy();
      this.dialog = null;
    }
  }
}

