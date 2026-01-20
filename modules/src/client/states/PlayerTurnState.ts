import type { Game } from "../Game";
import { getValidPlayFromSelection } from "../domain/CardRules";
import type { ClientStateHandler } from "./ClientStateHandler";

export class PlayerTurnState implements ClientStateHandler {
  constructor(private game: Game) {}

  onEnter(args: any): void {
    this.game.clearSelectedCards();
    if (this.game.getGamedatas().hand) {
      this.game.updateHand(this.game.getGamedatas().hand || []);
    }

    if (!this.game.bga.gameui.isCurrentPlayerActive()) return;

    this.game.bga.statusBar.removeActionButtons();

    const canDiscardAndDraw = !!(args?.canDiscardAndDraw ?? args?.args?.canDiscardAndDraw);
    if (canDiscardAndDraw) {
      this.game.bga.statusBar.addActionButton(
        _("Discard and Draw 3"),
        () => {
          this.game.bga.actions.performAction("actDiscardAndDraw", {});
        },
        { color: "primary" },
      );
    }

    // Add "End Turn" button last so it stays far right
    this.game.bga.statusBar.addActionButton(
      _("End Turn"),
      () => {
        this.game.bga.actions.performAction("actEndTurn", {});
      },
      { color: "alert", classes: ["bgabutton", "bgabutton_red"] },
    );
  }

  onUpdateActionButtons(args: any): void {
    if (!this.game.bga.gameui.isCurrentPlayerActive()) return;

    this.game.bga.statusBar.removeActionButtons();

    const canDiscardAndDraw = !!(args?.canDiscardAndDraw ?? args?.args?.canDiscardAndDraw);
    if (canDiscardAndDraw) {
      this.game.bga.statusBar.addActionButton(
        _("Discard and Draw 3"),
        () => {
          this.game.bga.actions.performAction("actDiscardAndDraw", {});
        },
        { color: "primary" },
      );
    }

    const validPlay = getValidPlayFromSelection(this.game.getGamedatas().hand, this.game.getSelectedCards());
    if (validPlay) {
      this.game.bga.statusBar.addActionButton(
        validPlay.label,
        () => {
          if (validPlay.kind === "single") {
            this.game.bga.actions.performAction("actPlayCard", { card_id: validPlay.cardId });
          } else {
            this.game.bga.actions.performAction("actPlayThreesome", { card_ids: validPlay.cardIds });
          }

          this.game.clearSelectedCards();
          this.game.updateHand(this.game.getGamedatas().hand || []);
          this.game.onUpdateActionButtons("PlayerTurn", this.game.getGamedatas().gamestate.args || null);
        },
        { color: "primary" },
      );
    }

    // Add "End Turn" button last so it stays far right
    this.game.bga.statusBar.addActionButton(
      _("End Turn"),
      () => {
        this.game.bga.actions.performAction("actEndTurn", {});
      },
      { color: "alert", classes: ["bgabutton", "bgabutton_red"] },
    );
  }
}

