<?php

declare(strict_types=1);

namespace Bga\Games\DondeLasPapasQueman\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\Games\DondeLasPapasQueman\Game;
use Bga\Games\DondeLasPapasQueman\States\PlayerTurn;
use Bga\Games\DondeLasPapasQueman\States\NextPlayer;

class ActionResolution extends GameState
{
    function __construct(protected Game $game)
    {
        parent::__construct(
            $game,
            id: 27,
            type: StateType::GAME,
            description: clienttranslate("Resolving action card effect")
        );
    }

    /**
     * Called when entering this state - resolve the action card effect
     */
    public function onEnteringState(int $activePlayerId)
    {
        // Get action card data
        $actionCardData = $this->game->globals->get("action_card_data");
        if (!$actionCardData) {
            // No action card to resolve, return to player turn
            return PlayerTurn::class;
        }

        $cardData = unserialize($actionCardData);
        $nameIndex = $cardData["name_index"] ?? 0;
        $activePlayerId = $cardData["player_id"] ?? $activePlayerId;

        // Check if card was interrupted
        $interruptPlayed = $this->game->getGameStateValue("interrupt_played") == 1;
        
        if ($interruptPlayed) {
            // Card was interrupted, don't resolve effect
            // Clear action card data
            $this->game->globals->set("action_card_data", "");
            return PlayerTurn::class;
        }

        // Resolve action card effect based on name_index
        $nextState = $this->resolveActionCard($nameIndex, $cardData, $activePlayerId);

        // Clear action card data
        $this->game->globals->set("action_card_data", "");

        return $nextState;
    }

    /**
     * Resolve action card effect
     */
    private function resolveActionCard(int $nameIndex, array $cardData, int $activePlayerId)
    {
        $isAlarm = $cardData["is_alarm"] ?? false;
        $targetPlayerIds = $cardData["target_player_ids"] ?? [];
        $targetPlayerId = !empty($targetPlayerIds) ? (int) $targetPlayerIds[0] : 0;

        switch ($nameIndex) {
            case 3: // "Get off the pony"
                return $this->resolveGetOffThePony($activePlayerId, $targetPlayerId);

            case 4: // "Lend me a buck"
                return $this->resolveLendMeABuck($activePlayerId, $targetPlayerId, $cardData);

            case 5: // "Runaway potatoes"
                return $this->resolveRunawayPotatoes($activePlayerId);

            case 6: // "Harry Potato"
                return $this->resolveHarryPotato($activePlayerId);

            case 7: // "Pope Potato"
                return $this->resolvePopePotato($activePlayerId, $targetPlayerId, $cardData);

            case 8: // "Look ahead"
                return $this->resolveLookAhead($targetPlayerId);

            case 9: // "The potato of the year"
                return $this->resolvePotatoOfTheYear($activePlayerId);

            case 10: // "Potato of destiny"
                return $this->resolvePotatoOfDestiny($targetPlayerId);

            case 11: // "Potato Dawan"
                return $this->resolvePotatoDawan($activePlayerId, $targetPlayerId, $cardData);

            case 12: // "Jump to the side"
                return $this->resolveJumpToTheSide($activePlayerId);

            case 13: // "Papageddon"
                return $this->resolvePapageddon($activePlayerId, $cardData);

            case 14: // "Spider potato"
                return $this->resolveSpiderPotato($cardData);

            default:
                // Unknown action card, just return to player turn
                return PlayerTurn::class;
        }
    }

    /**
     * "Get off the pony" - Steal 1 golden potato from target
     */
    private function resolveGetOffThePony(int $activePlayerId, int $targetPlayerId)
    {
        if ($targetPlayerId == 0) {
            return PlayerTurn::class;
        }

        // Steal golden potato
        $this->game->updateGoldenPotatoes($targetPlayerId, -1);
        $this->game->updateGoldenPotatoes($activePlayerId, 1);

        $this->game->notify->all("getOffThePony", clienttranslate('${player_name} steals a golden potato from ${target_name}'), [
            "player_id" => $activePlayerId,
            "player_name" => $this->game->getPlayerNameById($activePlayerId),
            "target_player_id" => $targetPlayerId,
            "target_name" => $this->game->getPlayerNameById($targetPlayerId),
            "i18n" => ["target_name"],
        ]);

        // Alarm card - end turn
        return NextPlayer::class;
    }

    /**
     * "Lend me a buck" - Steal a card from target (already selected in CardSelection)
     */
    private function resolveLendMeABuck(int $activePlayerId, int $targetPlayerId, array $cardData)
    {
        if ($targetPlayerId == 0) {
            return PlayerTurn::class;
        }

        $selectedCardId = $cardData["selected_card_id"] ?? 0;
        if ($selectedCardId == 0) {
            return PlayerTurn::class;
        }

        // Move card from target's hand to active player's hand
        $this->game->cards->moveCard($selectedCardId, "hand", $activePlayerId);

        $this->game->notify->all("lendMeABuck", clienttranslate('${player_name} steals a card from ${target_name}'), [
            "player_id" => $activePlayerId,
            "player_name" => $this->game->getPlayerNameById($activePlayerId),
            "target_player_id" => $targetPlayerId,
            "target_name" => $this->game->getPlayerNameById($targetPlayerId),
            "card_id" => $selectedCardId,
            "i18n" => ["target_name"],
        ]);

        return PlayerTurn::class;
    }

    /**
     * "Runaway potatoes" - Take 1 card from each other player and shuffle deck
     */
    private function resolveRunawayPotatoes(int $activePlayerId)
    {
        $players = $this->game->getCollectionFromDb("SELECT player_id FROM player");
        $cardsToMove = [];

        foreach ($players as $player) {
            $playerId = (int) $player["player_id"];
            if ($playerId == $activePlayerId) {
                continue; // Skip self
            }

            $hand = $this->game->cards->getPlayerHand($playerId);
            if (!empty($hand)) {
                // Take random card
                $randomCard = $hand[array_rand($hand)];
                $cardsToMove[] = $randomCard["id"];
            }
        }

        // Move all cards to deck
        foreach ($cardsToMove as $cardId) {
            $this->game->cards->moveCard($cardId, "deck");
        }

        // Shuffle deck
        if (!empty($cardsToMove)) {
            $this->game->cards->shuffle("deck");
        }

        $this->game->notify->all("runawayPotatoes", clienttranslate('${player_name} takes cards from all players and shuffles the deck'), [
            "player_id" => $activePlayerId,
            "player_name" => $this->game->getPlayerNameById($activePlayerId),
            "card_count" => count($cardsToMove),
        ]);

        return PlayerTurn::class;
    }

    /**
     * "Harry Potato" - Draw 2 cards
     */
    private function resolveHarryPotato(int $activePlayerId)
    {
        // Draw 2 cards (handle deck exhaustion)
        $drawnCards = $this->game->cards->pickCards(2, "deck", $activePlayerId);
        
        if (count($drawnCards) < 2) {
            // Deck exhausted, try to reshuffle
            $discardCount = $this->game->cards->countCardInLocation("discard");
            if ($discardCount > 0) {
                $this->game->cards->moveAllCardsInLocation("discard", "deck");
                $this->game->cards->shuffle("deck");
                $this->game->notify->all("deckReshuffled", clienttranslate("The discard pile is reshuffled into the deck"));
                
                // Draw remaining cards
                $remaining = 2 - count($drawnCards);
                if ($remaining > 0) {
                    $this->game->cards->pickCards($remaining, "deck", $activePlayerId);
                }
            }
        }

        $this->game->notify->all("harryPotato", clienttranslate('${player_name} draws 2 cards'), [
            "player_id" => $activePlayerId,
            "player_name" => $this->game->getPlayerNameById($activePlayerId),
        ]);

        // Alarm card - end turn
        return NextPlayer::class;
    }

    /**
     * "Pope Potato" - Name a card and steal it if target has it
     */
    private function resolvePopePotato(int $activePlayerId, int $targetPlayerId, array $cardData)
    {
        if ($targetPlayerId == 0) {
            return PlayerTurn::class;
        }

        // Get the named card type and name_index from cardData
        $namedCardType = $cardData["named_card_type"] ?? "";
        $namedNameIndex = $cardData["named_name_index"] ?? 0;

        if ($namedCardType == "" || $namedNameIndex == 0) {
            // No card was named, effect fails
            return PlayerTurn::class;
        }

        // Check if target has that card
        $targetHand = $this->game->cards->getPlayerHand($targetPlayerId);
        $cardToSteal = null;

        foreach ($targetHand as $card) {
            if ($card["type"] == $namedCardType) {
                $decoded = Game::decodeCardTypeArg((int) $card["type_arg"]);
                if ($decoded["name_index"] == $namedNameIndex) {
                    $cardToSteal = $card;
                    break; // Steal first matching card
                }
            }
        }

        if ($cardToSteal) {
            // Steal the card
            $this->game->cards->moveCard($cardToSteal["id"], "hand", $activePlayerId);
            $cardName = Game::getCardName($namedCardType, $namedNameIndex);

            $this->game->notify->all("popePotato", clienttranslate('${player_name} steals ${card_name} from ${target_name}'), [
                "player_id" => $activePlayerId,
                "player_name" => $this->game->getPlayerNameById($activePlayerId),
                "target_player_id" => $targetPlayerId,
                "target_name" => $this->game->getPlayerNameById($targetPlayerId),
                "card_name" => $cardName,
                "card_id" => $cardToSteal["id"],
                "i18n" => ["card_name", "target_name"],
            ]);
        } else {
            // Target doesn't have the card
            $cardName = Game::getCardName($namedCardType, $namedNameIndex);
            $this->game->notify->all("popePotatoFail", clienttranslate('${player_name} names ${card_name}, but ${target_name} doesn\'t have it'), [
                "player_id" => $activePlayerId,
                "player_name" => $this->game->getPlayerNameById($activePlayerId),
                "target_player_id" => $targetPlayerId,
                "target_name" => $this->game->getPlayerNameById($targetPlayerId),
                "card_name" => $cardName,
                "i18n" => ["card_name", "target_name"],
            ]);
        }

        return PlayerTurn::class;
    }

    /**
     * "Look ahead" - Destroy 1 golden potato from target
     */
    private function resolveLookAhead(int $targetPlayerId)
    {
        if ($targetPlayerId == 0) {
            return PlayerTurn::class;
        }

        // Destroy golden potato
        $this->game->updateGoldenPotatoes($targetPlayerId, -1);

        $this->game->notify->all("lookAhead", clienttranslate('${target_name} loses a golden potato'), [
            "target_player_id" => $targetPlayerId,
            "target_name" => $this->game->getPlayerNameById($targetPlayerId),
            "i18n" => ["target_name"],
        ]);

        // Alarm card - end turn
        return NextPlayer::class;
    }

    /**
     * "The potato of the year" - Get 1 golden potato from supply
     */
    private function resolvePotatoOfTheYear(int $activePlayerId)
    {
        $this->game->updateGoldenPotatoes($activePlayerId, 1);

        $this->game->notify->all("potatoOfTheYear", clienttranslate('${player_name} gains a golden potato'), [
            "player_id" => $activePlayerId,
            "player_name" => $this->game->getPlayerNameById($activePlayerId),
        ]);

        return PlayerTurn::class;
    }

    /**
     * "Potato of destiny" - Target discards hand and draws 2 cards
     */
    private function resolvePotatoOfDestiny(int $targetPlayerId)
    {
        if ($targetPlayerId == 0) {
            return PlayerTurn::class;
        }

        // Discard entire hand
        $targetHand = $this->game->cards->getPlayerHand($targetPlayerId);
        foreach ($targetHand as $card) {
            $this->game->cards->moveCard($card["id"], "discard");
        }

        // Draw 2 cards (handle deck exhaustion)
        $drawnCards = $this->game->cards->pickCards(2, "deck", $targetPlayerId);
        
        if (count($drawnCards) < 2) {
            // Deck exhausted, try to reshuffle
            $discardCount = $this->game->cards->countCardInLocation("discard");
            if ($discardCount > 0) {
                $this->game->cards->moveAllCardsInLocation("discard", "deck");
                $this->game->cards->shuffle("deck");
                $this->game->notify->all("deckReshuffled", clienttranslate("The discard pile is reshuffled into the deck"));
                
                // Draw remaining cards
                $remaining = 2 - count($drawnCards);
                if ($remaining > 0) {
                    $this->game->cards->pickCards($remaining, "deck", $targetPlayerId);
                }
            }
        }

        $this->game->notify->all("potatoOfDestiny", clienttranslate('${target_name} discards their hand and draws 2 cards'), [
            "target_player_id" => $targetPlayerId,
            "target_name" => $this->game->getPlayerNameById($targetPlayerId),
            "i18n" => ["target_name"],
        ]);

        return PlayerTurn::class;
    }

    /**
     * "Potato Dawan" - Steal a card from target (already selected in CardSelection)
     */
    private function resolvePotatoDawan(int $activePlayerId, int $targetPlayerId, array $cardData)
    {
        if ($targetPlayerId == 0) {
            return PlayerTurn::class;
        }

        $selectedCardId = $cardData["selected_card_id"] ?? 0;
        if ($selectedCardId == 0) {
            return PlayerTurn::class;
        }

        // Move card from target's hand to active player's hand
        $this->game->cards->moveCard($selectedCardId, "hand", $activePlayerId);

        $this->game->notify->all("potatoDawan", clienttranslate('${player_name} steals a card from ${target_name}\'s hand'), [
            "player_id" => $activePlayerId,
            "player_name" => $this->game->getPlayerNameById($activePlayerId),
            "target_player_id" => $targetPlayerId,
            "target_name" => $this->game->getPlayerNameById($targetPlayerId),
            "card_id" => $selectedCardId,
            "i18n" => ["target_name"],
        ]);

        return PlayerTurn::class;
    }

    /**
     * "Jump to the side" - Draw 1 card and skip next player's turn
     */
    private function resolveJumpToTheSide(int $activePlayerId)
    {
        // Draw 1 card (handle deck exhaustion)
        $drawnCard = $this->game->cards->pickCard("deck", $activePlayerId);
        
        if (!$drawnCard) {
            // Deck exhausted, try to reshuffle
            $discardCount = $this->game->cards->countCardInLocation("discard");
            if ($discardCount > 0) {
                $this->game->cards->moveAllCardsInLocation("discard", "deck");
                $this->game->cards->shuffle("deck");
                $this->game->notify->all("deckReshuffled", clienttranslate("The discard pile is reshuffled into the deck"));
                
                $drawnCard = $this->game->cards->pickCard("deck", $activePlayerId);
            }
        }

        // Set skip flag for next player
        $this->game->setGameStateValue("skip_next_player", 1);

        $this->game->notify->all("jumpToTheSide", clienttranslate('${player_name} draws a card and the next player will skip their turn'), [
            "player_id" => $activePlayerId,
            "player_name" => $this->game->getPlayerNameById($activePlayerId),
        ]);

        // Alarm card - end turn
        return NextPlayer::class;
    }

    /**
     * "Papageddon" - Reverse turn order and steal random card from next player
     */
    private function resolvePapageddon(int $activePlayerId, array $cardData)
    {
        // Get current next player before reversing order
        $nextPlayerTable = $this->game->getNextPlayerTable();
        $nextPlayerId = $nextPlayerTable[$activePlayerId] ?? 0;

        // Reverse turn order
        $players = $this->game->getCollectionFromDb("SELECT player_id FROM player ORDER BY player_no");
        $playerIds = array_column($players, "player_id");
        $reversedPlayerIds = array_reverse($playerIds);
        
        // Recreate next player table with reversed order
        $this->game->createNextPlayerTable($reversedPlayerIds);

        $this->game->notify->all("papageddonOrder", clienttranslate('${player_name} reverses the turn order'), [
            "player_id" => $activePlayerId,
            "player_name" => $this->game->getPlayerNameById($activePlayerId),
        ]);

        // Steal random card from the player who was next (before reversal)
        if ($nextPlayerId > 0 && $nextPlayerId != $activePlayerId) {
            $nextPlayerHand = $this->game->cards->getPlayerHand($nextPlayerId);
            if (!empty($nextPlayerHand)) {
                $randomCard = $nextPlayerHand[array_rand($nextPlayerHand)];
                $this->game->cards->moveCard($randomCard["id"], "hand", $activePlayerId);

                $this->game->notify->all("papageddonSteal", clienttranslate('${player_name} steals a card from ${target_name}'), [
                    "player_id" => $activePlayerId,
                    "player_name" => $this->game->getPlayerNameById($activePlayerId),
                    "target_player_id" => $nextPlayerId,
                    "target_name" => $this->game->getPlayerNameById($nextPlayerId),
                    "card_id" => $randomCard["id"],
                    "i18n" => ["target_name"],
                ]);
            }
        }

        // Alarm card - end turn
        return NextPlayer::class;
    }

    /**
     * "Spider potato" - Exchange hands between two players
     */
    private function resolveSpiderPotato(array $cardData)
    {
        $targetPlayerIds = $cardData["target_player_ids"] ?? [];
        
        if (count($targetPlayerIds) != 2) {
            return PlayerTurn::class;
        }

        $player1Id = (int) $targetPlayerIds[0];
        $player2Id = (int) $targetPlayerIds[1];

        // Get both hands
        $hand1 = $this->game->cards->getPlayerHand($player1Id);
        $hand2 = $this->game->cards->getPlayerHand($player2Id);

        // Exchange: move all cards from hand1 to hand2, and hand2 to hand1
        // We need to use a temporary location to avoid conflicts
        // Move hand1 to a temp location, then hand2 to hand1, then temp to hand2
        
        // Move hand1 cards to deck temporarily (we'll move them back)
        $hand1CardIds = array_column($hand1, "id");
        foreach ($hand1CardIds as $cardId) {
            $this->game->cards->moveCard($cardId, "deck", 0);
        }

        // Move hand2 cards to hand1
        $hand2CardIds = array_column($hand2, "id");
        foreach ($hand2CardIds as $cardId) {
            $this->game->cards->moveCard($cardId, "hand", $player1Id);
        }

        // Move hand1 cards (from deck) to hand2
        foreach ($hand1CardIds as $cardId) {
            $this->game->cards->moveCard($cardId, "hand", $player2Id);
        }

        $this->game->notify->all("spiderPotato", clienttranslate('${player1_name} and ${player2_name} exchange their hands'), [
            "player1_id" => $player1Id,
            "player1_name" => $this->game->getPlayerNameById($player1Id),
            "player2_id" => $player2Id,
            "player2_name" => $this->game->getPlayerNameById($player2Id),
            "i18n" => ["player1_name", "player2_name"],
        ]);

        return PlayerTurn::class;
    }
}
