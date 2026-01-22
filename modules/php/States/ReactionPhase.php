<?php

declare(strict_types=1);

namespace Bga\Games\DondeLasPapasQueman\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\UserException;
use Bga\Games\DondeLasPapasQueman\Game;
use Bga\Games\DondeLasPapasQueman\States\ActionResolution;
use Bga\Games\DondeLasPapasQueman\States\EndScore;

class ReactionPhase extends GameState {
    function __construct(protected Game $game) {
        parent::__construct(
            $game,
            id: 20,
            type: StateType::MULTIPLE_ACTIVE_PLAYER,
            description: clienttranslate("Players may react with interrupt cards"),
            descriptionMyTurn: clienttranslate("You may react with an interrupt card")
        );
    }

    /**
     * Calculate reaction time in seconds based on game speed
     * Uses speed profile: Fast=5s, Medium=7s, Slow=10s
     */
    private function getReactionTimeSeconds(): int {
        // Try to get speed profile from table options
        // Option 200 is GAMESTATE_CLOCK_MODE: 0=fast, 1=normal, 2=slow (for realtime games)
        try {
            $speedProfile = $this->game->tableOptions->get(200);
            if ($speedProfile === 0) {
                return 5; // Fast: 5 seconds
            } elseif ($speedProfile === 2) {
                return 10; // Slow: 10 seconds
            } else {
                return 7; // Normal/Medium: 7 seconds (default)
            }
        } catch (\Exception $e) {
            // Fallback to default if speed profile not available
            return 7;
        }
    }

    /**
     * Called when entering reaction phase
     */
    public function onEnteringState(int $activePlayerId) {
        // In MULTIPLE_ACTIVE_PLAYER states, the injected $activePlayerId is not reliable.
        // Use reaction_data to identify the player who triggered the reaction window.
        $reactionData = $this->game->globals->get("reaction_data");
        $data = unserialize($reactionData);
        $targetPlayerId = (int) ($data["player_id"] ?? $activePlayerId);

        // Calculate reaction time based on game speed
        $reactionTime = $this->getReactionTimeSeconds();

        // Give a variable window for reactions based on game speed
        $players = $this->game->getCollectionFromDb("SELECT player_id FROM player");
        foreach ($players as $player) {
            $this->game->giveExtraTime($player["player_id"], $reactionTime);
        }

        // Set a flag to track if any interrupt was played
        $this->game->setGameStateValue("interrupt_played", 0); // 0 = no interrupt, 1 = interrupt played
        // Track whether we've already applied post-reaction effects (some transitions bypass onLeavingState).
        $this->game->globals->set("reaction_effects_applied", "0");

        // In MULTIPLE_ACTIVE_PLAYER state, we need to explicitly set which players are active
        // All players EXCEPT the one who played the card can react
        $activePlayers = [];
        foreach ($players as $player) {
            $playerId = (int) $player["player_id"];
            if ($playerId != $targetPlayerId) {
                $activePlayers[] = $playerId;
            }
        }

        // Set all other players as multiactive (they can react)
        // The third parameter (true) means players NOT in the list will be made inactive
        $this->game->gamestate->setPlayersMultiactive($activePlayers, "", true);

        return null;
    }

    private function applyPostReactionEffects(bool $interruptPlayed, bool $isActionCard): void {
        if ($this->game->globals->get("reaction_effects_applied") === "1") {
            return;
        }
        $this->game->globals->set("reaction_effects_applied", "1");

        $reactionData = $this->game->globals->get("reaction_data");
        $data = unserialize($reactionData);

        if (!$interruptPlayed) {
            // Threesome: award golden potatoes only after reaction phase completes.
            if (($data["type"] ?? "") === "threesome") {
                $targetPlayerId = (int) ($data["player_id"] ?? 0);
                $goldenPotatoes = (int) ($data["golden_potatoes"] ?? 0);

                if ($targetPlayerId > 0 && $goldenPotatoes > 0) {
                    $this->game->updateGoldenPotatoes($targetPlayerId, $goldenPotatoes);
                    $this->notify->all(
                        "threesomeScored",
                        clienttranslate('${player_name} gains ${golden_potatoes} golden potatoes'),
                        [
                            "player_id" => $targetPlayerId,
                            "player_name" => $this->game->getPlayerNameById($targetPlayerId),
                            "golden_potatoes" => $goldenPotatoes,
                        ]
                    );
                }
            }

            // Regular single card: card is already in discard (moved when played).
            // No need to move it again - just proceed to action resolution.
        } else {
            // If an action card was interrupted, clear pending data so we don't carry stale selections.
            if ($isActionCard) {
                $this->game->globals->set("action_card_data", "");
            }
        }
    }

    /**
     * Get arguments for reaction phase
     */
    public function getArgs(): array {
        $reactionData = $this->game->globals->get("reaction_data");
        $data = unserialize($reactionData);

        $result = [
            "reaction_type" => $data["type"] ?? "card",
            "target_player_id" => $data["player_id"] ?? 0,
            "target_card_id" => $data["card_id"] ?? 0,
            "target_card_ids" => $data["card_ids"] ?? [],
            "is_threesome" => ($data["type"] ?? "") == "threesome",
            "is_alarm" => $data["is_alarm"] ?? false,
            "reaction_time_seconds" => $this->getReactionTimeSeconds(),
        ];

        // Get all players' interrupt cards (for UI, but don't reveal who has what)
        $players = $this->game->getCollectionFromDb("SELECT player_id FROM player");
        $result["players"] = [];
        foreach ($players as $player) {
            $hand = $this->game->cards->getPlayerHand($player["player_id"]);
            $hasNoPoh = false;
            $hasTeDijeQueNoPoh = false;

            foreach ($hand as $card) {
                if ($card["type"] == "action") {
                    $decoded = Game::decodeCardTypeArg((int) $card["type_arg"]);
                    if ($decoded["name_index"] == 1) {
                        $hasNoPoh = true;
                    } elseif ($decoded["name_index"] == 2) {
                        $hasTeDijeQueNoPoh = true;
                    }
                }
            }

            // In MULTIPLE_ACTIVE_PLAYER state, all players are active
            // Show interrupt card info for all players (they'll only see their own)
            $playerId = (int) $player["player_id"];
            $result["players"][$playerId] = [
                "hasNoDude" => $hasNoPoh,
                "hasIToldYouNoDude" => $hasTeDijeQueNoPoh,
            ];
        }

        return $result;
    }

    /**
     * Play "No dude" interrupt card
     */
    #[PossibleAction]
    public function actPlayNoPoh() {
        // In MULTIPLE_ACTIVE_PLAYER states, the reacting player is the one making the request.
        // Always use getCurrentPlayerId() (do not rely on any injected "activePlayerId").
        $playerId = (int) $this->game->getCurrentPlayerId();

        // Check if interrupt already played (first-request-wins)
        if ($this->game->getGameStateValue("interrupt_played") == 1) {
            throw new UserException("Another player has already reacted");
        }

        // Check if player has "No dude" card
        $hand = $this->game->cards->getPlayerHand($playerId);
        $noPohCard = null;
        foreach ($hand as $card) {
            if ($card["type"] == "action") {
                $decoded = Game::decodeCardTypeArg((int) $card["type_arg"]);
                if ($decoded["name_index"] == 1) {
                    // No dude
                    $noPohCard = $card;
                    break;
                }
            }
        }

        if (!$noPohCard) {
            throw new UserException('You do not have a "No dude" card');
        }

        // Check if "No dude" can cancel the target
        $reactionData = $this->game->globals->get("reaction_data");
        $data = unserialize($reactionData);

        $canCancel = false;
        if ($data["type"] == "threesome") {
            // "No dude" cannot cancel threesomes
            throw new UserException('"No dude" cannot cancel threesomes');
        } elseif ($data["type"] == "card") {
            // Check if target is "I told you no dude" or another "No dude"
            $targetCard = $this->game->cards->getCard($data["card_id"]);
            if ($targetCard && $targetCard["type"] == "action") {
                $targetDecoded = Game::decodeCardTypeArg((int) $targetCard["type_arg"]);
                if ($targetDecoded["name_index"] == 2) {
                    // Target is "I told you no dude" - cannot cancel
                    throw new UserException('"No dude" cannot cancel "I told you no dude"');
                }
            }
            $canCancel = true;
        }

        // Mark that interrupt was played
        $this->game->setGameStateValue("interrupt_played", 1);

        // Move "No dude" to discard
        $this->game->moveCardToDiscard($noPohCard["id"]);

        // Notify all players that the interrupt card was moved to discard
        $this->game->notify->all("cardMovedToDiscard", "", [
            "player_id" => $playerId,
            "card_id" => $noPohCard["id"],
            "card_type" => $noPohCard["type"],
            "card_type_arg" => isset($noPohCard["type_arg"]) ? (int) $noPohCard["type_arg"] : null,
        ]);

        // Notify all players that the interrupt card was played (so frontend can remove it from hand)
        $this->notify->all("cardPlayed", clienttranslate('${player_name} plays ${card_name}'), [
            "player_id" => $playerId,
            "player_name" => $this->game->getPlayerNameById($playerId),
            "card_name" => "No dude",
            "card_id" => $noPohCard["id"],
            "card_type" => $noPohCard["type"],
            "card_type_arg" => $noPohCard["type_arg"],
            "is_alarm" => false,
            "i18n" => ["card_name"],
        ]);

        // Cancel the target action
        $this->cancelTarget($data, $playerId, "No dude");

        // If cancelled card was an interrupt, we need to handle the chain
        // For now, just return to PlayerTurn
        return PlayerTurn::class;
    }

    /**
     * Play "I told you no dude" interrupt card
     */
    #[PossibleAction]
    public function actPlayTeDijeQueNoPoh() {
        // In MULTIPLE_ACTIVE_PLAYER states, the reacting player is the one making the request.
        // Always use getCurrentPlayerId() (do not rely on any injected "activePlayerId").
        $playerId = (int) $this->game->getCurrentPlayerId();

        // Check if interrupt already played (first-request-wins)
        if ($this->game->getGameStateValue("interrupt_played") == 1) {
            throw new UserException("Another player has already reacted");
        }

        // Check if player has "I told you no dude" card
        $hand = $this->game->cards->getPlayerHand($playerId);
        $teDijeCard = null;
        foreach ($hand as $card) {
            if ($card["type"] == "action") {
                $decoded = Game::decodeCardTypeArg((int) $card["type_arg"]);
                if ($decoded["name_index"] == 2) {
                    // I told you no dude
                    $teDijeCard = $card;
                    break;
                }
            }
        }

        if (!$teDijeCard) {
            throw new UserException('You do not have an "I told you no dude" card');
        }

        // "I told you no dude" can cancel everything
        $reactionData = $this->game->globals->get("reaction_data");
        $data = unserialize($reactionData);

        // Mark that interrupt was played
        $this->game->setGameStateValue("interrupt_played", 1);

        // Move "I told you no dude" to discard
        $this->game->moveCardToDiscard($teDijeCard["id"]);

        // Notify all players that the interrupt card was moved to discard
        $this->game->notify->all("cardMovedToDiscard", "", [
            "player_id" => $playerId,
            "card_id" => $teDijeCard["id"],
            "card_type" => $teDijeCard["type"],
            "card_type_arg" => isset($teDijeCard["type_arg"]) ? (int) $teDijeCard["type_arg"] : null,
        ]);

        // Notify all players that the interrupt card was played (so frontend can remove it from hand)
        $this->notify->all("cardPlayed", clienttranslate('${player_name} plays ${card_name}'), [
            "player_id" => $playerId,
            "player_name" => $this->game->getPlayerNameById($playerId),
            "card_name" => "I told you no dude",
            "card_id" => $teDijeCard["id"],
            "card_type" => $teDijeCard["type"],
            "card_type_arg" => $teDijeCard["type_arg"],
            "is_alarm" => false,
            "i18n" => ["card_name"],
        ]);

        // Cancel the target action
        $this->cancelTarget($data, $playerId, "I told you no dude");

        return PlayerTurn::class;
    }

    /**
     * Cancel the target action
     */
    private function cancelTarget(array $data, int $interruptingPlayerId, string $interruptCardName) {
        $targetPlayerId = $data["player_id"] ?? 0;
        $targetPlayerName = $this->game->getPlayerNameById($targetPlayerId);
        $interruptingPlayerName = $this->game->getPlayerNameById($interruptingPlayerId);

        if ($data["type"] == "threesome") {
            // Cancel threesome - cards are already in discard.
            // Golden potatoes are awarded only after the reaction phase completes,
            // so there is nothing to reverse here.
            $this->notify->all(
                "threesomeCancelled",
                clienttranslate('${interrupting_player} cancels ${target_player}\'s threesome with ${interrupt_card}'),
                [
                    "interrupting_player_id" => $interruptingPlayerId,
                    "interrupting_player" => $interruptingPlayerName,
                    "target_player_id" => $targetPlayerId,
                    "target_player" => $targetPlayerName,
                    "interrupt_card" => $interruptCardName,
                    "i18n" => ["interrupt_card"],
                ]
            );
        } elseif ($data["type"] == "card") {
            // Card already in discard, just notify
            $this->notify->all(
                "cardCancelled",
                clienttranslate('${interrupting_player} cancels ${target_player}\'s card with ${interrupt_card}'),
                [
                    "interrupting_player_id" => $interruptingPlayerId,
                    "interrupting_player" => $interruptingPlayerName,
                    "target_player_id" => $targetPlayerId,
                    "target_player" => $targetPlayerName,
                    "interrupt_card" => $interruptCardName,
                    "card_id" => $data["card_id"],
                    "i18n" => ["interrupt_card"],
                ]
            );

            // If cancelled card was alarm, turn continues
            if ($data["is_alarm"] ?? false) {
                $this->game->setGameStateValue("alarm_flag", 0); // Clear alarm flag
            }
        }
    }

    /**
     * Called when timer expires or all reactions resolved
     */
    public function onLeavingState() {
        $interruptPlayed = $this->game->getGameStateValue("interrupt_played") == 1;
        $alarmFlag = $this->game->getGameStateValue("alarm_flag") == 1;

        // Check if an action card was played (not just a regular card)
        $reactionData = $this->game->globals->get("reaction_data");
        $data = unserialize($reactionData);
        $isActionCard = ($data["type"] ?? "") == "action_card";

        $this->applyPostReactionEffects($interruptPlayed, $isActionCard);

        // Check win condition after all reactions are complete
        $winnerId = $this->game->checkWinCondition();
        if ($winnerId > 0) {
            // Make all players inactive first to prevent any further actions
            // This ensures no player can try to act after the game has ended
            $this->game->gamestate->setAllPlayersNonMultiactive(EndScore::class);
            return null; // Transition already happened via setAllPlayersNonMultiactive
        }

        // Reset flags now that the reaction window is closing.
        $this->game->setGameStateValue("alarm_flag", 0);
        $this->game->setGameStateValue("interrupt_played", 0);

        return $this->decideNextStateAfterReactions($interruptPlayed, $alarmFlag, $isActionCard);
    }

    /**
     * Decide where to go next (no side effects).
     */
    private function decideNextStateAfterReactions(bool $interruptPlayed, bool $alarmFlag, bool $isActionCard) {
        if ($interruptPlayed) {
            // Card was interrupted, return to PlayerTurn.
            return PlayerTurn::class;
        }

        // Action card: after reaction, we may still need follow-up selection (card / card name).
        if ($isActionCard) {
            $actionCardData = $this->game->globals->get("action_card_data");
            $cardData = unserialize($actionCardData);
            $nameIndex = $cardData["name_index"] ?? 0;

            // Blind card selection (steal from target hand)
            $needsCardSelection = in_array($nameIndex, [4, 11, 13]);
            if ($needsCardSelection && empty($cardData["selected_card_id"])) {
                return CardSelection::class;
            }

            // Card name selection (Pope Potato)
            $needsCardNameSelection = $nameIndex == 7;
            if (
                $needsCardNameSelection &&
                (empty($cardData["named_card_type"]) || empty($cardData["named_name_index"]))
            ) {
                return CardNameSelection::class;
            }

            // Otherwise, resolve immediately.
            return ActionResolution::class;
        }

        // Regular card - if alarm card, end turn
        if ($alarmFlag) {
            return NextPlayer::class;
        }

        // Otherwise (regular card or threesome with no interrupt), return to PlayerTurn to continue
        return PlayerTurn::class;
    }

    /**
     * Skip reaction (player chooses not to react)
     */
    #[PossibleAction]
    public function actSkipReaction() {
        // Get the current player who is making this action
        // In MULTIPLE_ACTIVE_PLAYER states, use getCurrentPlayerId() to get the player making the request
        $playerId = (int) $this->game->getCurrentPlayerId();

        // Determine next state using the same logic as onLeavingState()
        // This ensures a single, consistent transition path
        $interruptPlayed = $this->game->getGameStateValue("interrupt_played") == 1;
        $alarmFlag = $this->game->getGameStateValue("alarm_flag") == 1;
        $reactionData = $this->game->globals->get("reaction_data");
        $data = unserialize($reactionData);
        $isActionCard = ($data["type"] ?? "") == "action_card";

        $nextState = $this->decideNextStateAfterReactions($interruptPlayed, $alarmFlag, $isActionCard);

        // If this is the last multiactive player, apply post-reaction effects here (some transitions bypass onLeavingState).
        $activeList = $this->game->gamestate->getActivePlayerList();
        if (is_string($activeList)) {
            $activeList = array_values(array_filter(explode(",", $activeList)));
        }
        $isLast = is_array($activeList) ? count($activeList) <= 1 : true;
        
        if ($isLast) {
            $this->applyPostReactionEffects($interruptPlayed, $isActionCard);
            
            // Check win condition after applying effects
            $winnerId = $this->game->checkWinCondition();
            if ($winnerId > 0) {
                // Make all players inactive and transition to EndScore immediately
                // This must be done BEFORE calling setPlayerNonMultiactive to prevent race conditions
                // setAllPlayersNonMultiactive will make all players inactive and transition atomically
                $this->game->gamestate->setAllPlayersNonMultiactive(EndScore::class);
                return null; // Don't call setPlayerNonMultiactive - transition already happened
            }
            
            $this->game->setGameStateValue("alarm_flag", 0);
            $this->game->setGameStateValue("interrupt_played", 0);
        }

        // Make player inactive and transition if this is the last active player
        // setPlayerNonMultiactive will only transition if this is the last active player
        // Note: This won't be called if game ended above due to early return
        $this->game->gamestate->setPlayerNonMultiactive($playerId, $nextState);

        return null;
    }

    /**
     * Zombie handling - don't react
     */
    function zombie(int $playerId) {
        // Zombies don't react: behave like a skip so the state cannot stall.
        $interruptPlayed = $this->game->getGameStateValue("interrupt_played") == 1;
        $alarmFlag = $this->game->getGameStateValue("alarm_flag") == 1;
        $reactionData = $this->game->globals->get("reaction_data");
        $data = unserialize($reactionData);
        $isActionCard = ($data["type"] ?? "") == "action_card";

        $nextState = $this->decideNextStateAfterReactions($interruptPlayed, $alarmFlag, $isActionCard);

        $activeList = $this->game->gamestate->getActivePlayerList();
        if (is_string($activeList)) {
            $activeList = array_values(array_filter(explode(",", $activeList)));
        }
        $isLast = is_array($activeList) ? count($activeList) <= 1 : true;
        if ($isLast) {
            $this->applyPostReactionEffects($interruptPlayed, $isActionCard);
            $this->game->setGameStateValue("alarm_flag", 0);
            $this->game->setGameStateValue("interrupt_played", 0);
        }

        $this->game->gamestate->setPlayerNonMultiactive($playerId, $nextState);

        return null;
    }
}
