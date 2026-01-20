import type { Game } from "../Game";
import type { ClientStateHandler } from "./ClientStateHandler";

export class ReactionPhaseState implements ClientStateHandler {
  private countdownIntervalId: number | null = null;
  private autoSkipTimeoutId: number | null = null;

  constructor(private game: Game) {}

  onEnter(_args: any): void {
    this.game.resetReactionActionSent();
    this.maybeStartTimer();
  }

  onLeave(): void {
    this.stopTimer();
    this.game.resetReactionActionSent();
    // Best effort: refresh hand to remove interrupt highlighting.
    this.game.updateHand(this.game.getGamedatas().hand || []);
  }

  onUpdateActionButtons(args: any): void {
    // MULTIPLE_ACTIVE_PLAYER: use players.isCurrentPlayerActive()
    if (!this.game.bga.players.isCurrentPlayerActive()) {
      this.stopTimer();
      return;
    }

    this.game.bga.statusBar.removeActionButtons();

    // Refresh hand to highlight interrupt cards
    if (this.game.getGamedatas().hand) {
      this.game.updateHand(this.game.getGamedatas().hand);
    }

    // Add "Skip" button for all active players
    this.game.bga.statusBar.addActionButton(
      _("Skip"),
      () => {
        this.sendSkip();
      },
      { color: "secondary", classes: ["dplq-reaction-skip"] },
    );

    this.maybeStartTimer();
  }

  private maybeStartTimer(): void {
    // Defensive: never run the ReactionPhase timer if we've already left the state.
    if (this.game.getGamedatas().gamestate.name !== "ReactionPhase") {
      this.stopTimer();
      return;
    }
    if (!this.game.bga.players.isCurrentPlayerActive()) {
      this.stopTimer();
      return;
    }
    if (this.game.didSendReactionAction()) {
      this.stopTimer();
      return;
    }
    if (this.countdownIntervalId !== null || this.autoSkipTimeoutId !== null) return;

    const reactionSeconds = 5;
    const timerDiv = document.createElement("div");
    timerDiv.id = "reaction-timer";
    timerDiv.className = "reaction-timer";
    timerDiv.innerHTML =
      `<div>Reaction Phase: <span id="timer-countdown">${reactionSeconds}</span> seconds</div>`;
    this.game.bga.gameArea.getElement().appendChild(timerDiv);

    const deadlineMs = Date.now() + reactionSeconds * 1000;
    let lastShownSeconds = reactionSeconds;

    this.autoSkipTimeoutId = window.setTimeout(() => {
      if (this.game.getGamedatas().gamestate.name !== "ReactionPhase") return;
      if (!this.game.bga.players.isCurrentPlayerActive()) return;
      if (this.game.didSendReactionAction()) return;
      this.sendSkip();
    }, reactionSeconds * 1000);

    this.countdownIntervalId = window.setInterval(() => {
      if (
        this.game.getGamedatas().gamestate.name !== "ReactionPhase" ||
        !this.game.bga.players.isCurrentPlayerActive() ||
        this.game.didSendReactionAction()
      ) {
        this.stopTimer();
        return;
      }

      const msLeft = deadlineMs - Date.now();
      const secondsLeft = Math.max(0, Math.ceil(msLeft / 1000));
      if (secondsLeft !== lastShownSeconds) {
        lastShownSeconds = secondsLeft;
        const countdownEl = document.getElementById("timer-countdown");
        if (countdownEl) countdownEl.textContent = secondsLeft.toString();
      }
    }, 100);
  }

  private sendSkip(): void {
    if (this.game.didSendReactionAction()) return;
    if (this.game.getGamedatas().gamestate.name !== "ReactionPhase") {
      this.stopTimer();
      return;
    }
    this.game.markReactionActionSent();
    this.game.bga.actions.performAction("actSkipReaction", {});
    this.stopTimer();
  }

  private stopTimer(): void {
    if (this.countdownIntervalId !== null) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
    if (this.autoSkipTimeoutId !== null) {
      clearTimeout(this.autoSkipTimeoutId);
      this.autoSkipTimeoutId = null;
    }
    const timerDiv = document.getElementById("reaction-timer");
    if (timerDiv) timerDiv.remove();
  }
}

