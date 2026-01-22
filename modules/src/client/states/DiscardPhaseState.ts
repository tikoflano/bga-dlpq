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

    // Always show the button when cards need to be discarded, with appropriate state and message
    if (cardsToDiscard > 0) {
      let label: string;
      let disabled = false;

      if (selectedCount < cardsToDiscard) {
        const remaining = cardsToDiscard - selectedCount;
        const cardWord = remaining === 1 ? "card" : "cards";
        label = _("Select ${count} more ${cardWord}").replace("${count}", String(remaining)).replace("${cardWord}", cardWord);
        disabled = true;
      } else if (selectedCount > cardsToDiscard) {
        const excess = selectedCount - cardsToDiscard;
        const cardWord = excess === 1 ? "card" : "cards";
        label = _("Unselect ${count} more ${cardWord}").replace("${count}", String(excess)).replace("${cardWord}", cardWord);
        disabled = true;
      } else {
        const cardWord = selectedCount === 1 ? "card" : "cards";
        label = _("Discard ${count} ${cardWord}").replace("${count}", String(selectedCount)).replace("${cardWord}", cardWord);
        disabled = false;
      }

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
        { color: "primary", disabled },
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

