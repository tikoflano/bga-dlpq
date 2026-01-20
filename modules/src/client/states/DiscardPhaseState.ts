import type { Game } from "../Game";
import type { ClientStateHandler } from "./ClientStateHandler";

export class DiscardPhaseState implements ClientStateHandler {
  constructor(private game: Game) {}

  onEnter(args: any): void {
    // Discard-to-7 UI should be handled via:
    // - clicking cards in hand to select
    // - a status-bar button that submits the discard when the selection is valid
    // So we explicitly remove any legacy UI block (older builds) and just rely on the hand rendering.
    this.hide();
    this.game.clearSelectedCards();
    this.game.updateHand(this.game.getGamedatas().hand || []);
    this.onUpdateActionButtons(args);
  }

  onUpdateActionButtons(args: any): void {
    if (!this.game.bga.gameui.isCurrentPlayerActive()) return;

    // BGA sometimes wraps state args as { args: ... }.
    const a = args?.args || args || {};

    this.game.bga.statusBar.removeActionButtons();

    const handSize = (this.game.getGamedatas().hand || []).length;
    const selectedCount = this.game.getSelectedCards().length;
    const cardsToDiscard = Math.max(0, handSize - 7);

    // Only show the action if the selection would leave exactly 7 cards.
    if (cardsToDiscard > 0 && selectedCount === cardsToDiscard) {
      const label = _("Discard ${count} cards").replace("${count}", String(selectedCount));
      this.game.bga.statusBar.addActionButton(
        label,
        () => {
          const cardIds = this.game.getSelectedCards().slice();
          // Defensive: only submit if still valid at click-time.
          if ((this.game.getGamedatas().hand || []).length - cardIds.length !== 7) return;

          this.game.bga.actions.performAction("actDiscardCards", { card_ids: cardIds });
          this.game.clearSelectedCards();
          this.game.updateHand(this.game.getGamedatas().hand || []);
          this.game.bga.statusBar.removeActionButtons();
        },
        { color: "primary" },
      );
    } else if (a) {
      // No button: status bar text is enough, per UX requirement.
    }
  }

  onLeave(): void {
    this.hide();
    this.game.clearSelectedCards();
    this.game.updateHand(this.game.getGamedatas().hand || []);
  }

  private hide(): void {
    const discardDiv = document.getElementById("discard-phase-ui");
    if (discardDiv) discardDiv.remove();
  }
}

