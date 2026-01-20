import type { Game } from "../Game";
import type { ClientStateHandler } from "./ClientStateHandler";
import { ActionResolutionState } from "./ActionResolutionState";
import { CardNameSelectionState } from "./CardNameSelectionState";
import { CardSelectionState } from "./CardSelectionState";
import { DiscardPhaseState } from "./DiscardPhaseState";
import { PlayerTurnState } from "./PlayerTurnState";
import { ReactionPhaseState } from "./ReactionPhaseState";
import { TargetSelectionState } from "./TargetSelectionState";

export function createStateHandlers(game: Game): Record<string, ClientStateHandler> {
  return {
    PlayerTurn: new PlayerTurnState(game),
    ReactionPhase: new ReactionPhaseState(game),
    ActionResolution: new ActionResolutionState(game),
    TargetSelection: new TargetSelectionState(game),
    DiscardPhase: new DiscardPhaseState(game),
    CardSelection: new CardSelectionState(game),
    CardNameSelection: new CardNameSelectionState(game),
  };
}

