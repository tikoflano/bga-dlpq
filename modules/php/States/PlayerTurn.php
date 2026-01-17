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
            $this->notify->all("emptyHandDraw", clienttranslate('${player_name} has no cards and draws 3'), [
                "player_id" => $activePlayerId,
                "player_name" => $this->game->getPlayerNameById($activePlayerId),
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

        $this->notify->all("discardAndDraw", clienttranslate('${player_name} discards a card and draws 3'), [
            "player_id" => $activePlayerId,
            "player_name" => $this->game->getPlayerNameById($activePlayerId),
            "card_id" => $card["id"],
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

        // Check if it's a type-based threesome (potato cards with same name)
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
        if (count($potatoCards) + count($wildcards) == 3 && count($wildcards) <= 2) {
            // All cards are potato or wildcard, at most 2 wildcards
            if (count($potatoCards) > 0) {
                $nameIndexes = array_column($potatoCards, "name_index");
                $uniqueNames = array_unique($nameIndexes);
                if (count($uniqueNames) == 1) {
                    // All potato cards have same name
                    $nameIndex = $uniqueNames[0];
                    $isTypeBased = true;
                    // Rewards: potato=1, duchesses potatoes=2, fried potatoes=3
                    $goldenPotatoes = match ($nameIndex) {
                        1 => 1, // potato
                        2 => 2, // duchesses potatoes
                        3 => 3, // fried potatoes
                        default => 0,
                    };
                }
            }
        }

        // Check value-based threesome (if not type-based)
        if (!$isTypeBased) {
            $values = [];
            foreach ($cards as $card) {
                if ($card["type"] == "wildcard") {
                    throw new UserException("Wildcards cannot be used in value-based threesomes");
                }
                $decoded = Game::decodeCardTypeArg((int) $card["type_arg"]);
                $values[] = $decoded["value"];
            }
            $uniqueValues = array_unique($values);
            if (count($uniqueValues) == 1) {
                // All cards have same value
                $goldenPotatoes = 1;
            } else {
                throw new UserException("Invalid threesome: cards must have same type/name or same value");
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

        // Move card to discard
        $this->game->cards->moveCard($card_id, "discard");

        // Notify all players
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

        // Check if this is an action card that requires target selection
        $targetRequired = 0;
        if ($card["type"] == "action") {
            $targetRequired = Game::actionCardRequiresTarget($nameIndex);
        }

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
            // Store card info for reaction phase
            $this->game->globals->set(
                "reaction_data",
                serialize(["type" => "card", "player_id" => $activePlayerId, "card_id" => $card_id, "is_alarm" => $isAlarm])
            );

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
     * End turn explicitly
     */
    #[PossibleAction]
    public function actEndTurn(int $activePlayerId) {
        $this->notify->all("turnEnded", clienttranslate('${player_name} ends their turn'), [
            "player_id" => $activePlayerId,
            "player_name" => $this->game->getPlayerNameById($activePlayerId),
        ]);

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
