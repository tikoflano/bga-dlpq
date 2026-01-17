<?php

declare(strict_types=1);

namespace Bga\Games\DondeLasPapasQueman\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\UserException;
use Bga\Games\DondeLasPapasQueman\Game;

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
                    $decoded = Game::decodeCardTypeArg($card["type_arg"]);
                    if ($decoded["name_index"] == 1) {
                        $hasNoPoh = true;
                    } elseif ($decoded["name_index"] == 2) {
                        $hasTeDijeQueNoPoh = true;
                    }
                }
            }

            // Only show if current player (for their own hand)
            // Use getActivePlayerId() with null check for MULTIPLE_ACTIVE_PLAYER states
            $currentPlayerId = $this->game->getActivePlayerId();
            if ($currentPlayerId !== null && $player["player_id"] == $currentPlayerId) {
                $result["players"][$player["player_id"]] = [
                    "hasNoPoh" => $hasNoPoh,
                    "hasTeDijeQueNoPoh" => $hasTeDijeQueNoPoh,
                ];
            }
        }

        return $result;
    }

    /**
     * Play "No Poh" interrupt card
     */
    #[PossibleAction]
    public function actPlayNoPoh(int $playerId) {
        // Check if interrupt already played (first-request-wins)
        if ($this->game->getGameStateValue("interrupt_played") == 1) {
            throw new UserException("Another player has already reacted");
        }

        // Check if player has "No Poh" card
        $hand = $this->game->cards->getPlayerHand($playerId);
        $noPohCard = null;
        foreach ($hand as $card) {
            if ($card["type"] == "action") {
                $decoded = Game::decodeCardTypeArg($card["type_arg"]);
                if ($decoded["name_index"] == 1) {
                    // No Poh
                    $noPohCard = $card;
                    break;
                }
            }
        }

        if (!$noPohCard) {
            throw new UserException('You do not have a "No Poh" card');
        }

        // Check if "No Poh" can cancel the target
        $reactionData = $this->game->globals->get("reaction_data");
        $data = unserialize($reactionData);

        $canCancel = false;
        if ($data["type"] == "threesome") {
            // "No Poh" cannot cancel threesomes
            throw new UserException('"No Poh" cannot cancel threesomes');
        } elseif ($data["type"] == "card") {
            // Check if target is "Te Dije Que No Poh" or another "No Poh"
            $targetCard = $this->game->cards->getCard($data["card_id"]);
            if ($targetCard && $targetCard["type"] == "action") {
                $targetDecoded = Game::decodeCardTypeArg($targetCard["type_arg"]);
                if ($targetDecoded["name_index"] == 2) {
                    // Target is "Te Dije Que No Poh" - cannot cancel
                    throw new UserException('"No Poh" cannot cancel "Te Dije Que No Poh"');
                }
            }
            $canCancel = true;
        }

        // Mark that interrupt was played
        $this->game->setGameStateValue("interrupt_played", 1);

        // Move "No Poh" to discard
        $this->game->cards->moveCard($noPohCard["id"], "discard");

        // Cancel the target action
        $this->cancelTarget($data, $playerId, "No Poh");

        // If cancelled card was an interrupt, we need to handle the chain
        // For now, just return to PlayerTurn
        return PlayerTurn::class;
    }

    /**
     * Play "Te Dije Que No Poh" interrupt card
     */
    #[PossibleAction]
    public function actPlayTeDijeQueNoPoh(int $playerId) {
        // Check if interrupt already played (first-request-wins)
        if ($this->game->getGameStateValue("interrupt_played") == 1) {
            throw new UserException("Another player has already reacted");
        }

        // Check if player has "Te Dije Que No Poh" card
        $hand = $this->game->cards->getPlayerHand($playerId);
        $teDijeCard = null;
        foreach ($hand as $card) {
            if ($card["type"] == "action") {
                $decoded = Game::decodeCardTypeArg($card["type_arg"]);
                if ($decoded["name_index"] == 2) {
                    // Te Dije Que No Poh
                    $teDijeCard = $card;
                    break;
                }
            }
        }

        if (!$teDijeCard) {
            throw new UserException('You do not have a "Te Dije Que No Poh" card');
        }

        // "Te Dije Que No Poh" can cancel everything
        $reactionData = $this->game->globals->get("reaction_data");
        $data = unserialize($reactionData);

        // Mark that interrupt was played
        $this->game->setGameStateValue("interrupt_played", 1);

        // Move "Te Dije Que No Poh" to discard
        $this->game->cards->moveCard($teDijeCard["id"], "discard");

        // Cancel the target action
        $this->cancelTarget($data, $playerId, "Te Dije Que No Poh");

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
            $this->game->playerGoldenPotatoes->inc($targetPlayerId, -3); // Assume max, adjust if needed
            // Actually, we need to know how many were awarded - store this in reaction data
            // For now, just notify
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

        // If no interrupt was played and it was an alarm card, end turn
        if (!$interruptPlayed && $alarmFlag) {
            $this->game->setGameStateValue("alarm_flag", 0);
            return NextPlayer::class;
        }

        // Otherwise, return to PlayerTurn to continue
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
