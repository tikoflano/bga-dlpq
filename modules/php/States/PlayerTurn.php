<?php

declare(strict_types=1);

namespace Bga\Games\DondeLasPapasQueman\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\UserException;
use Bga\Games\DondeLasPapasQueman\Game;
use Bga\Games\DondeLasPapasQueman\States\TargetSelection;

class PlayerTurn extends GameState {
    function __construct(protected Game $game) {
        parent::__construct(
            $game,
            id: 2,
            type: StateType::ACTIVE_PLAYER,
            description: clienttranslate('${actplayer} must play a card or end turn'),
            descriptionMyTurn: clienttranslate('${you} must play a card or end turn')
        );
    }

    /**
     * Called when entering this state
     */
    public function onEnteringState(int $activePlayerId) {
        $hand = $this->game->cards->getPlayerHand($activePlayerId);
        $handSize = count($hand);

        // If 0 cards: automatically draw 3, end turn
        if ($handSize == 0) {
            $this->game->cards->pickCards(3, "deck", $activePlayerId);

            // Private: refresh the active player's hand immediately (avoid needing a page refresh).
            $this->game->notify->player($activePlayerId, "handUpdated", '', [
                "hand" => array_values($this->game->cards->getPlayerHand($activePlayerId)),
                "deckCount" => $this->game->cards->countCardInLocation("deck"),
            ]);
            $this->notify->all("emptyHandDraw", clienttranslate('${player_name} has no cards and draws 3'), [
                "player_id" => $activePlayerId,
                "player_name" => $this->game->getPlayerNameById($activePlayerId),
                "deckCount" => $this->game->cards->countCardInLocation("deck"),
            ]);
            // Mark that we should skip end-of-turn draw
            $this->game->setGameStateValue("skip_draw_flag", 1);
            return NextPlayer::class;
        }

        // If 1 card: offer option to discard and draw 3
        // This will be handled in getArgs() and actDiscardAndDraw()

        return null; // Stay in this state
    }

    /**
     * Game state arguments
     */
    public function getArgs(): array {
        $activePlayerId = $this->game->getActivePlayerId();
        if ($activePlayerId === null || $activePlayerId === '') {
            // During setup or if no active player, return empty args
            return [
                "playableCardsIds" => [],
                "handSize" => 0,
                "canDiscardAndDraw" => false,
            ];
        }
        $activePlayerId = (int) $activePlayerId;
        $hand = $this->game->cards->getPlayerHand($activePlayerId);
        $handSize = count($hand);

        $result = [
            "playableCardsIds" => array_column($hand, "id"),
            "handSize" => $handSize,
            "canDiscardAndDraw" => false,
        ];

        // If 1 card at start of turn, offer discard and draw option
        if ($handSize == 1) {
            $result["canDiscardAndDraw"] = true;
        }

        return $result;
    }

    /**
     * Discard single card and draw 3, then end turn
     */
    #[PossibleAction]
    public function actDiscardAndDraw(int $activePlayerId) {
        $hand = $this->game->cards->getPlayerHand($activePlayerId);
        if (count($hand) != 1) {
            throw new UserException("You can only discard and draw when you have exactly 1 card");
        }

        $card = $hand[0];
        $this->game->cards->moveCard($card["id"], "discard");

        $this->game->cards->pickCards(3, "deck", $activePlayerId);

        // Private: refresh the active player's hand immediately (avoid needing a page refresh).
        $this->game->notify->player($activePlayerId, "handUpdated", '', [
            "hand" => array_values($this->game->cards->getPlayerHand($activePlayerId)),
            "deckCount" => $this->game->cards->countCardInLocation("deck"),
        ]);

        $this->notify->all("discardAndDraw", clienttranslate('${player_name} discards a card and draws 3'), [
            "player_id" => $activePlayerId,
            "player_name" => $this->game->getPlayerNameById($activePlayerId),
            "card_id" => $card["id"],
            "deckCount" => $this->game->cards->countCardInLocation("deck"),
        ]);

        // Mark that we should skip end-of-turn draw
        $this->game->setGameStateValue("skip_draw_flag", 1);
        return NextPlayer::class;
    }

    /**
     * Play a threesome (3 cards of same type/name or same value)
     */
    #[PossibleAction]
    public function actPlayThreesome(array $card_ids, int $activePlayerId) {
        if (count($card_ids) != 3) {
            throw new UserException("You must play exactly 3 cards for a threesome");
        }

        $hand = $this->game->cards->getPlayerHand($activePlayerId);
        $handCardIds = array_column($hand, "id");

        foreach ($card_ids as $cardId) {
            if (!in_array($cardId, $handCardIds)) {
                throw new UserException("You can only play cards from your hand");
            }
        }

        $cards = $this->game->cards->getCards($card_ids);

        // Check if it's a type-based threesome (potato cards with same name + optional wildcards)
        $potatoCards = [];
        $wildcards = [];
        foreach ($cards as $card) {
            if ($card["type"] == "potato") {
                $decoded = Game::decodeCardTypeArg((int) $card["type_arg"]);
                $potatoCards[] = ["card" => $card, "name_index" => $decoded["name_index"]];
            } elseif ($card["type"] == "wildcard") {
                $wildcards[] = $card;
            }
        }

        $goldenPotatoes = 0;
        $isTypeBased = false;

        // Check type-based threesome
        if (count($potatoCards) + count($wildcards) == 3) {
            // 3 wildcards => trio of french fries
            if (count($wildcards) == 3) {
                $isTypeBased = true;
                $goldenPotatoes = 3;
            } elseif (count($wildcards) <= 2 && count($potatoCards) > 0) {
                // Potato trio with 1-2 wildcards; potato cards must share the same name
                $nameIndexes = array_column($potatoCards, "name_index");
                $uniqueNames = array_unique($nameIndexes);
                if (count($uniqueNames) == 1) {
                    // All potato cards have same name
                    $nameIndex = $uniqueNames[0];
                    $isTypeBased = true;
                    // Rewards: potato=1, duchesses potatoes=2, french fries=3
                    $goldenPotatoes = match ($nameIndex) {
                        1 => 1, // potato
                        2 => 2, // duchesses potatoes
                        3 => 3, // french fries
                        default => 0,
                    };
                }
            }
        }

        // Check value==3 threesome (if not type-based)
        if (!$isTypeBased) {
            $values = [];
            foreach ($cards as $card) {
                $decoded = Game::decodeCardTypeArg((int) $card["type_arg"]);
                $values[] = $decoded["value"];
            }
            $uniqueValues = array_unique($values);
            if (count($uniqueValues) == 1 && $uniqueValues[0] === 3) {
                // All cards have value == 3
                $goldenPotatoes = 1;
            } else {
                throw new UserException("Invalid threesome: must be a potato trio (with optional wildcards), 3 wildcards, or three value-3 cards");
            }
        }

        if ($goldenPotatoes == 0) {
            throw new UserException("Invalid threesome");
        }

        // Move cards to discard
        foreach ($cards as $card) {
            $this->game->cards->moveCard($card["id"], "discard");
        }

        // Award golden potatoes and update score
        $this->game->updateGoldenPotatoes($activePlayerId, $goldenPotatoes);

        $threesomeType = $isTypeBased ? "type-based" : "value-based";
        $this->notify->all(
            "threesomePlayed",
            clienttranslate(
                '${player_name} plays a ${threesome_type} threesome and gains ${golden_potatoes} golden potatoes'
            ),
            [
                "player_id" => $activePlayerId,
                "player_name" => $this->game->getPlayerNameById($activePlayerId),
                "threesome_type" => $threesomeType,
                "golden_potatoes" => $goldenPotatoes,
                "card_ids" => $card_ids,
                "i18n" => ["threesome_type"],
            ]
        );

        // Trigger reaction phase
        $this->game->globals->set(
            "reaction_data",
            serialize([
                "type" => "threesome",
                "player_id" => $activePlayerId,
                "card_ids" => $card_ids,
                "golden_potatoes" => $goldenPotatoes,
            ])
        );
        return ReactionPhase::class;
    }

    /**
     * Play a single card
     */
    #[PossibleAction]
    public function actPlayCard(int $card_id, int $activePlayerId, array $args) {
        $hand = $this->game->cards->getPlayerHand($activePlayerId);
        $handCardIds = array_column($hand, "id");

        if (!in_array($card_id, $handCardIds)) {
            throw new UserException("You can only play cards from your hand");
        }

        $card = $this->game->cards->getCard($card_id);
        if (!$card) {
            throw new UserException("Card not found");
        }

        $decoded = Game::decodeCardTypeArg((int) $card["type_arg"]);
        $cardName = Game::getCardName($card["type"], $decoded["name_index"]);
        $isAlarm = $decoded["isAlarm"];
        $nameIndex = $decoded["name_index"];

        // Potato cards, wildcards, and interrupt cards cannot be played by themselves.
        if ($card["type"] === "potato" || $card["type"] === "wildcard") {
            throw new UserException("This card cannot be played by itself");
        }
        if ($card["type"] === "action" && in_array($nameIndex, [1, 2])) {
            throw new UserException("Interrupt cards can only be played as a reaction");
        }

        // Check if this is an action card that requires target selection
        $targetRequired = 0;
        if ($card["type"] == "action") {
            $targetRequired = Game::actionCardRequiresTarget($nameIndex);
        }

        // Don't move card to discard yet - it could be interrupted
        // The card will be moved to discard in ActionResolution after the reaction phase
        // For now, just notify that the card is being played
        $this->notify->all("cardPlayed", clienttranslate('${player_name} plays ${card_name}'), [
            "player_id" => $activePlayerId,
            "player_name" => $this->game->getPlayerNameById($activePlayerId),
            "card_name" => $cardName,
            "card_id" => $card_id,
            "card_type" => $card["type"],
            "card_type_arg" => $card["type_arg"],
            "is_alarm" => $isAlarm,
            "i18n" => ["card_name"],
        ]);

        if ($targetRequired > 0) {
            // Store card info for target selection and action resolution
            $actionCardData = [
                "type" => "action",
                "player_id" => $activePlayerId,
                "card_id" => $card_id,
                "card_name" => $cardName,
                "name_index" => $nameIndex,
                "value" => $decoded["value"],
                "is_alarm" => $isAlarm,
            ];
            $this->game->globals->set("action_card_data", serialize($actionCardData));

            // Also store in reaction_data for reaction phase (after target selection)
            $this->game->globals->set(
                "reaction_data",
                serialize(["type" => "action_card", "player_id" => $activePlayerId, "card_id" => $card_id, "is_alarm" => $isAlarm])
            );

            // If alarm card, set flag
            if ($isAlarm) {
                $this->game->setGameStateValue("alarm_flag", 1);
            }

            // Transition to target selection
            return TargetSelection::class;
        } else {
            // Action cards without targets still need to be resolved in ActionResolution.
            // Treat them as "action_card" so ReactionPhase routes correctly.
            if ($card["type"] === "action") {
                $actionCardData = [
                    "type" => "action",
                    "player_id" => $activePlayerId,
                    "card_id" => $card_id,
                    "card_name" => $cardName,
                    "name_index" => $nameIndex,
                    "value" => $decoded["value"],
                    "is_alarm" => $isAlarm,
                ];
                $this->game->globals->set("action_card_data", serialize($actionCardData));

                $this->game->globals->set(
                    "reaction_data",
                    serialize(["type" => "action_card", "player_id" => $activePlayerId, "card_id" => $card_id, "is_alarm" => $isAlarm])
                );
            } else {
                // Store regular card info for reaction phase
                $this->game->globals->set(
                    "reaction_data",
                    serialize(["type" => "card", "player_id" => $activePlayerId, "card_id" => $card_id, "is_alarm" => $isAlarm])
                );
            }

            // If alarm card and not interrupted, end turn
            // (We'll check this after reaction phase)
            if ($isAlarm) {
                $this->game->setGameStateValue("alarm_flag", 1); // Flag: alarm card played
            }

            // Trigger reaction phase
            return ReactionPhase::class;
        }
    }

    /**
     * End turn explicitly - draws a card and checks hand size
     */
    #[PossibleAction]
    public function actEndTurn(int $activePlayerId) {
        $this->notify->all("turnEnded", clienttranslate('${player_name} ends their turn'), [
            "player_id" => $activePlayerId,
            "player_name" => $this->game->getPlayerNameById($activePlayerId),
        ]);

        // Draw 1 card from deck (handle deck exhaustion)
        $drawnCard = $this->game->cards->pickCard('deck', $activePlayerId);
        
        if (!$drawnCard) {
            // Deck exhausted, try to reshuffle
            $discardCount = $this->game->cards->countCardInLocation('discard');
            if ($discardCount > 0) {
                $this->game->cards->moveAllCardsInLocation('discard', 'deck');
                $this->game->cards->shuffle('deck');
                $this->game->notify->all("deckReshuffled", clienttranslate("The discard pile is reshuffled into the deck"));
                
                $drawnCard = $this->game->cards->pickCard('deck', $activePlayerId);
            }
        }

        if ($drawnCard) {
            $this->notify->all("cardDrawn", clienttranslate('${player_name} draws a card'), [
                "player_id" => $activePlayerId,
                "player_name" => $this->game->getPlayerNameById($activePlayerId),
                "card_id" => $drawnCard['id'],
                "card_type" => $drawnCard['type'],
                "card_type_arg" => $drawnCard['type_arg'],
            ]);

            // Check hand size
            $hand = $this->game->cards->getPlayerHand($activePlayerId);
            $handSize = count($hand);

            if ($handSize > 7) {
                // Mark that we should skip end-of-turn draw in NextPlayer
                $this->game->setGameStateValue("skip_draw_flag", 1);
                // Transition to DiscardPhase
                return DiscardPhase::class;
            }
        }

        // Mark that we should skip end-of-turn draw in NextPlayer (since we already drew)
        $this->game->setGameStateValue("skip_draw_flag", 1);
        return NextPlayer::class;
    }

    /**
     * Zombie player handling
     */
    function zombie(int $playerId) {
        $hand = $this->game->cards->getPlayerHand($playerId);
        $handSize = count($hand);

        // If 0 cards: draw 3 and end
        if ($handSize == 0) {
            $this->game->cards->pickCards(3, "deck", $playerId);
            $this->game->setGameStateValue("skip_draw_flag", 1);
            return NextPlayer::class;
        }

        // If 1 card: discard and draw 3
        if ($handSize == 1) {
            return $this->actDiscardAndDraw($playerId);
        }

        // Otherwise: play a random card or end turn
        $args = $this->getArgs();
        if (!empty($args["playableCardsIds"])) {
            $zombieChoice = $this->getRandomZombieChoice($args["playableCardsIds"]);
            return $this->actPlayCard($zombieChoice, $playerId, $args);
        } else {
            return $this->actEndTurn($playerId);
        }
    }
}
