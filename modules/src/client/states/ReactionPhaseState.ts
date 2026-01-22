import type { Game } from "../Game";
import type { ClientStateHandler } from "./ClientStateHandler";

export class ReactionPhaseState implements ClientStateHandler {
  private countdownIntervalId: number | null = null;
  private autoSkipTimeoutId: number | null = null;
  private skipButton: HTMLButtonElement | null = null;
  private reactionTimeSeconds: number = 7; // Default, will be updated from args

  constructor(private game: Game) {}

  onEnter(args: any): void {
    // Get reaction time from args if available
    if (args && typeof args.reaction_time_seconds === "number") {
      this.reactionTimeSeconds = args.reaction_time_seconds;
    }
    this.game.resetReactionActionSent();
    this.maybeStartTimer();
  }

  onLeave(): void {
    this.stopTimer();
    this.game.resetReactionActionSent();
    // Explicitly remove interrupt highlighting by passing false for isReactionPhase
    this.game.updateHand(this.game.getGamedatas().hand || [], false);
  }

  onUpdateActionButtons(args: any): void {
    // MULTIPLE_ACTIVE_PLAYER: use players.isCurrentPlayerActive()
    if (!this.game.bga.players.isCurrentPlayerActive()) {
      this.stopTimer();
      return;
    }

    // Update reaction time from args if available
    if (args && typeof args.reaction_time_seconds === "number") {
      this.reactionTimeSeconds = args.reaction_time_seconds;
    }

    this.game.bga.statusBar.removeActionButtons();

    // Refresh hand to highlight interrupt cards
    if (this.game.getGamedatas().hand) {
      this.game.updateHand(this.game.getGamedatas().hand);
    }

    // Add "Skip" button for all active players
    this.skipButton = this.game.bga.statusBar.addActionButton(
      _("Skip"),
      () => {
        this.sendSkip();
      },
      { color: "primary" },
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

    // Use the variable reaction time instead of hardcoded 5
    const reactionSeconds = this.reactionTimeSeconds;
    const deadlineMs = Date.now() + reactionSeconds * 1000;
    let lastShownSeconds = reactionSeconds;

    // Set initial button text to show countdown
    if (this.skipButton) {
      this.skipButton.textContent = _("Skip") + ` (${reactionSeconds})`;
    }

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

        // Update skip button text with countdown
        if (this.skipButton) {
          if (secondsLeft > 0) {
            this.skipButton.textContent = _("Skip") + ` (${secondsLeft})`;
          } else {
            this.skipButton.textContent = _("Skip");
          }
        }
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
    this.skipButton = null;
  }
}
