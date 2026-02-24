<?php

declare(strict_types=1);

namespace Bga\Games\DondeLasPapasQueman\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\UserException;
use Bga\Games\DondeLasPapasQueman\Game;
use Bga\Games\DondeLasPapasQueman\States\ActionResolution;

class CardSelection extends GameState {
    function __construct(protected Game $game) {
        parent::__construct(
            $game,
            id: 26,
            type: StateType::ACTIVE_PLAYER,
            description: clienttranslate('${actplayer} must select a card'),
            descriptionMyTurn: clienttranslate('${you} must select a card from ${otherplayer}\'s hand')
        );
    }

    /**
     * Get arguments for card selection
     */
    public function getArgs(): array {
        $activePlayerId = $this->game->getActivePlayerId();
        if ($activePlayerId === null || $activePlayerId === "") {
            return [
                "targetPlayerId" => 0,
                "targetPlayerName" => "",
                "otherplayer" => "",
                "otherplayer_id" => 0,
                "handSize" => 0,
                "cardBacks" => [],
            ];
        }
        $activePlayerId = (int) $activePlayerId;

        // Get the action card data to find target
        $actionCardData = $this->game->globals->get("action_card_data");
        $cardData = is_string($actionCardData) && $actionCardData !== "" ? @unserialize($actionCardData) : null;
        if (!is_array($cardData)) {
            // Try to reconstruct minimal action-card context from reaction_data.
            $reactionData = $this->game->globals->get("reaction_data");
            $reaction = is_string($reactionData) && $reactionData !== "" ? @unserialize($reactionData) : null;
            if (is_array($reaction) && ($reaction["type"] ?? "") === "action_card") {
                $originPlayerId = (int) ($reaction["player_id"] ?? 0);
                $cardId = (int) ($reaction["card_id"] ?? 0);
                $isAlarm = (bool) ($reaction["is_alarm"] ?? false);

                if ($originPlayerId > 0 && $cardId > 0) {
                    $playedCard = $this->game->cards->getCard($cardId);
                    if ($playedCard && isset($playedCard["type_arg"])) {
                        $decoded = Game::decodeCardTypeArg((int) $playedCard["type_arg"]);
                        $nameIndex = (int) ($decoded["name_index"] ?? 0);

                        $cardData = [
                            "type" => "action",
                            "player_id" => $originPlayerId,
                            "card_id" => $cardId,
                            "name_index" => $nameIndex,
                            "is_alarm" => $isAlarm,
                        ];

                        // Papageddon (name_index=13): implicit target is the "next player" in the current order.
                        if ($nameIndex === 13) {
                            $nextPlayerTable = $this->game->getNextPlayerTable();
                            $computedTargetId = (int) ($nextPlayerTable[$originPlayerId] ?? 0);
                            if ($computedTargetId > 0 && $computedTargetId !== $originPlayerId) {
                                $cardData["target_player_ids"] = [$computedTargetId];
                            }
                        }

                        // Persist reconstructed data so ActionResolution can run.
                        $this->game->globals->set("action_card_data", serialize($cardData));
                    }
                }
            }

            if (!is_array($cardData)) {
                return [
                    "targetPlayerId" => 0,
                    "targetPlayerName" => "",
                    "otherplayer" => "",
                    "otherplayer_id" => 0,
                    "handSize" => 0,
                    "cardBacks" => [],
                ];
            }
        }
        $targetPlayerIds = $cardData["target_player_ids"] ?? [];

        // For card selection, we only need one target (the first one)
        $targetPlayerId = !empty($targetPlayerIds) ? (int) $targetPlayerIds[0] : 0;

        // Backward-compatible fallback:
        // Older saved states / in-progress games may not have populated target_player_ids for implicit-target cards.
        // Papageddon (name_index=13): target is the "next player" in the current turn order (before reversal).
        if ($targetPlayerId === 0 && ((int) ($cardData["name_index"] ?? 0)) === 13) {
            $originPlayerId = (int) ($cardData["player_id"] ?? $activePlayerId);
            $nextPlayerTable = $this->game->getNextPlayerTable();
            $computedTargetId = (int) ($nextPlayerTable[$originPlayerId] ?? 0);
            if ($computedTargetId > 0 && $computedTargetId !== $originPlayerId) {
                $targetPlayerId = $computedTargetId;
                // Persist for the rest of the resolution pipeline.
                $cardData["target_player_ids"] = [$computedTargetId];
                $this->game->globals->set("action_card_data", serialize($cardData));
            }
        }

        if ($targetPlayerId == 0) {
            return [
                "targetPlayerId" => 0,
                "targetPlayerName" => "",
                "otherplayer" => "",
                "otherplayer_id" => 0,
                "handSize" => 0,
                "cardBacks" => [],
            ];
        }

        // Get target's hand
        // IMPORTANT: BGA Deck helpers may return arrays keyed by card id.
        // For "select by position" UIs we need a stable 0..N-1 index order.
        $targetHand = array_values($this->game->cards->getPlayerHand($targetPlayerId));
        $handSize = count($targetHand);

        // Check if this is Potato Dawan (name_index 11) - it reveals the opponent's hand
        $nameIndex = (int) ($cardData["name_index"] ?? 0);
        $revealCards = ($nameIndex === 11); // Potato Dawan shows actual cards

        // Create card data with opaque tokens (client never sees position/hand index).
        $tokenToPosition = [];
        $cardBacks = [];
        $revealedCards = [];
        foreach ($targetHand as $index => $card) {
            $token = bin2hex(random_bytes(8));
            $tokenToPosition[$token] = $index;
            $cardBacks[] = ["selectToken" => $token];

            if ($revealCards) {
                $decoded = Game::decodeCardTypeArg((int) $card["type_arg"]);
                $revealedCards[] = [
                    "selectToken" => $token,
                    "card_id" => (int) $card["id"],
                    "type" => $card["type"],
                    "type_arg" => (int) $card["type_arg"],
                    "name_index" => $decoded["name_index"],
                    "value" => $decoded["value"],
                    "is_alarm" => $decoded["isAlarm"],
                ];
            }
        }

        $this->game->globals->set("card_selection_tokens", serialize($tokenToPosition));

        // Shuffle so the attacking player cannot infer hand order.
        shuffle($cardBacks);
        if ($revealCards) {
            shuffle($revealedCards);
        }

        $result = [
            "targetPlayerId" => $targetPlayerId,
            "targetPlayerName" => $this->game->getPlayerNameById($targetPlayerId),
            "targetPlayerColor" => $this->game->getPlayerColorById($targetPlayerId),
            "otherplayer" => $this->game->getPlayerNameById($targetPlayerId),
            "otherplayer_id" => $targetPlayerId,
            "handSize" => $handSize,
            "cardBacks" => $cardBacks,
        ];
        
        if ($revealCards) {
            $result["revealedCards"] = $revealedCards;
        }
        
        return $result;
    }

    /**
     * Select a card from target's hand (by opaque token)
     */
    #[PossibleAction]
    public function actSelectCard(?string $selectToken, int $activePlayerId) {
        $tokenData = $this->game->globals->get("card_selection_tokens");
        $tokenToPosition = is_string($tokenData) && $tokenData !== "" ? @unserialize($tokenData) : null;
        if (!is_array($tokenToPosition) || $selectToken === null || $selectToken === "" || !isset($tokenToPosition[$selectToken])) {
            throw new UserException("Invalid or expired selection token");
        }
        $cardPosition = $tokenToPosition[$selectToken];
        $this->game->globals->set("card_selection_tokens", "");

        // Get the action card data
        $actionCardData = $this->game->globals->get("action_card_data");
        $cardData = is_string($actionCardData) && $actionCardData !== "" ? @unserialize($actionCardData) : null;
        if (!is_array($cardData)) {
            // Attempt to reconstruct from reaction_data (same approach as getArgs).
            $reactionData = $this->game->globals->get("reaction_data");
            $reaction = is_string($reactionData) && $reactionData !== "" ? @unserialize($reactionData) : null;
            if (is_array($reaction) && ($reaction["type"] ?? "") === "action_card") {
                $originPlayerId = (int) ($reaction["player_id"] ?? 0);
                $cardId = (int) ($reaction["card_id"] ?? 0);
                $isAlarm = (bool) ($reaction["is_alarm"] ?? false);

                if ($originPlayerId > 0 && $cardId > 0) {
                    $playedCard = $this->game->cards->getCard($cardId);
                    if ($playedCard && isset($playedCard["type_arg"])) {
                        $decoded = Game::decodeCardTypeArg((int) $playedCard["type_arg"]);
                        $nameIndex = (int) ($decoded["name_index"] ?? 0);

                        $cardData = [
                            "type" => "action",
                            "player_id" => $originPlayerId,
                            "card_id" => $cardId,
                            "name_index" => $nameIndex,
                            "is_alarm" => $isAlarm,
                        ];

                        if ($nameIndex === 13) {
                            $nextPlayerTable = $this->game->getNextPlayerTable();
                            $computedTargetId = (int) ($nextPlayerTable[$originPlayerId] ?? 0);
                            if ($computedTargetId > 0 && $computedTargetId !== $originPlayerId) {
                                $cardData["target_player_ids"] = [$computedTargetId];
                            }
                        }

                        $this->game->globals->set("action_card_data", serialize($cardData));
                    }
                }
            }

            if (!is_array($cardData)) {
                throw new UserException("Invalid action card data");
            }
        }
        $targetPlayerIds = $cardData["target_player_ids"] ?? [];
        $targetPlayerId = !empty($targetPlayerIds) ? (int) $targetPlayerIds[0] : 0;

        if ($targetPlayerId == 0) {
            throw new UserException("Invalid target player");
        }

        $targetHand = array_values($this->game->cards->getPlayerHand($targetPlayerId));

        if ($cardPosition < 0 || $cardPosition >= count($targetHand)) {
            throw new UserException("Invalid card position");
        }

        $selectedCard = $targetHand[$cardPosition];
        $selectedCardId = $selectedCard["id"];

        // Store selected card ID in action card data
        $cardData["selected_card_id"] = $selectedCardId;
        $this->game->globals->set("action_card_data", serialize($cardData));

        // Reaction phase already happened after target selection.
        // Now resolve the action card effect.
        return ActionResolution::class;
    }

    /**
     * Zombie handling - select random card
     */
    function zombie(int $playerId) {
        $args = $this->getArgs();
        $cardBacks = $args["cardBacks"] ?? [];

        if (empty($cardBacks)) {
            return ActionResolution::class;
        }

        $randomBack = $cardBacks[array_rand($cardBacks)];
        $selectToken = $randomBack["selectToken"] ?? null;
        if ($selectToken === null) {
            return ActionResolution::class;
        }
        return $this->actSelectCard($selectToken, $playerId);
    }
}
