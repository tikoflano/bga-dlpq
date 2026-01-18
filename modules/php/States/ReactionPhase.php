<?php

declare(strict_types=1);

namespace Bga\Games\DondeLasPapasQueman\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\UserException;
use Bga\Games\DondeLasPapasQueman\Game;
use Bga\Games\DondeLasPapasQueman\States\ActionResolution;

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
     * Called when entering reaction phase
     */
    public function onEnteringState(int $activePlayerId) {
        // Set 3-second timer for all players
        $players = $this->game->getCollectionFromDb("SELECT player_id FROM player");
        foreach ($players as $player) {
            $this->game->giveExtraTime($player["player_id"], 3);
        }

        // Set a flag to track if any interrupt was played
        $this->game->setGameStateValue("interrupt_played", 0); // 0 = no interrupt, 1 = interrupt played

        // In MULTIPLE_ACTIVE_PLAYER state, we need to explicitly set which players are active
        // All players EXCEPT the one who played the card can react
        $activePlayers = [];
        foreach ($players as $player) {
            $playerId = (int) $player["player_id"];
            if ($playerId != $activePlayerId) {
                $activePlayers[] = $playerId;
            }
        }

        // Set all other players as multiactive (they can react)
        // The third parameter (true) means players NOT in the list will be made inactive
        $this->game->gamestate->setPlayersMultiactive($activePlayers, "", true);

        return null;
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
    public function actPlayNoPoh(int $playerId) {
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
        $this->game->cards->moveCard($noPohCard["id"], "discard");

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
    public function actPlayTeDijeQueNoPoh(int $playerId) {
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
        $this->game->cards->moveCard($teDijeCard["id"], "discard");

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
            // Cancel threesome - cards already in discard, but reverse golden potatoes
            // Get the amount that was awarded (stored in reaction data or default to 3)
            $goldenPotatoesAwarded = $data["golden_potatoes"] ?? 3;
            // Reverse golden potatoes and update score
            $this->game->updateGoldenPotatoes($targetPlayerId, -$goldenPotatoesAwarded);
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

        if ($interruptPlayed) {
            // Card was interrupted, return to PlayerTurn
            $this->game->setGameStateValue("alarm_flag", 0);
            $this->game->setGameStateValue("interrupt_played", 0);
            return PlayerTurn::class;
        }

        // If action card was played, resolve its effect
        if ($isActionCard) {
            $this->game->setGameStateValue("alarm_flag", 0);
            $this->game->setGameStateValue("interrupt_played", 0);
            return ActionResolution::class;
        }

        // Regular card - if alarm card, end turn
        if ($alarmFlag) {
            $this->game->setGameStateValue("alarm_flag", 0);
            return NextPlayer::class;
        }

        // Otherwise, return to PlayerTurn to continue
        return null;
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

        $nextState = "";
        if ($interruptPlayed) {
            // Reset flags before transitioning
            $this->game->setGameStateValue("alarm_flag", 0);
            $this->game->setGameStateValue("interrupt_played", 0);
            $nextState = PlayerTurn::class;
        } elseif ($isActionCard) {
            $this->game->setGameStateValue("alarm_flag", 0);
            $this->game->setGameStateValue("interrupt_played", 0);
            $nextState = ActionResolution::class;
        } elseif ($alarmFlag) {
            $this->game->setGameStateValue("alarm_flag", 0);
            $nextState = NextPlayer::class;
        } else {
            $nextState = PlayerTurn::class;
        }

        // Make player inactive and transition if this is the last active player
        // setPlayerNonMultiactive will only transition if this is the last active player
        $this->game->gamestate->setPlayerNonMultiactive($playerId, $nextState);

        return null;
    }

    /**
     * Zombie handling - don't react
     */
    function zombie(int $playerId) {
        // Zombies don't react
        return null;
    }
}
