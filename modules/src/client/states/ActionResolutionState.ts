import type { Game } from "../Game";
import type { ClientStateHandler } from "./ClientStateHandler";

export class ActionResolutionState implements ClientStateHandler {
  constructor(private game: Game) {}

  onEnter(_args: any): void {
    if (this.game.getGamedatas().hand) {
      this.game.updateHand(this.game.getGamedatas().hand);
    }
  }
}

