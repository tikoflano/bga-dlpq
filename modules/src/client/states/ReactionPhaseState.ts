import type { Game } from "../Game";
import type { ClientStateHandler } from "./ClientStateHandler";

export class ReactionPhaseState implements ClientStateHandler {
  private timerId: number | null = null;

  constructor(private game: Game) {}

  onEnter(_args: any): void {
    this.startTimer();
  }

  onLeave(): void {
    this.stopTimer();
    // Best effort: refresh hand to remove interrupt highlighting.
    this.game.updateHand(this.game.getGamedatas().hand || []);
  }

  onUpdateActionButtons(args: any): void {
    // MULTIPLE_ACTIVE_PLAYER: use players.isCurrentPlayerActive()
    if (!this.game.bga.players.isCurrentPlayerActive()) return;

    this.game.bga.statusBar.removeActionButtons();

    // Refresh hand to highlight interrupt cards
    if (this.game.getGamedatas().hand) {
      this.game.updateHand(this.game.getGamedatas().hand);
    }

    // Add "Skip" button for all active players
    this.game.bga.statusBar.addActionButton(
      _("Skip"),
      () => {
        this.game.bga.actions.performAction("actSkipReaction", {});
      },
      { color: "secondary" },
    );
  }

  private startTimer(): void {
    // Remove any existing timer first
    this.stopTimer();

    const timerDiv = document.createElement("div");
    timerDiv.id = "reaction-timer";
    timerDiv.className = "reaction-timer";
    timerDiv.innerHTML =
      '<div>Reaction Phase: <span id="timer-countdown">3</span> seconds</div>';
    this.game.bga.gameArea.getElement().appendChild(timerDiv);

    let timeLeft = 3;
    this.timerId = window.setInterval(() => {
      timeLeft--;
      const countdownEl = document.getElementById("timer-countdown");
      if (countdownEl) countdownEl.textContent = timeLeft.toString();

      if (timeLeft <= 0) {
        this.stopTimer();
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    const timerDiv = document.getElementById("reaction-timer");
    if (timerDiv) timerDiv.remove();
  }
}

