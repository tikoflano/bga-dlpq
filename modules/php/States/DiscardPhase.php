<?php

declare(strict_types=1);

namespace Bga\Games\DondeLasPapasQueman\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\Actions\Types\IntArrayParam;
use Bga\GameFramework\UserException;
use Bga\Games\DondeLasPapasQueman\Game;

class DiscardPhase extends GameState
{
    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: 30,
            type: StateType::ACTIVE_PLAYER,
            description: clienttranslate('${actplayer} must discard cards down to 7'),
            descriptionMyTurn: clienttranslate('${you} must discard cards down to 7'),
        );
    }

    /**
     * Get arguments for discard phase
     */
    public function getArgs(): array
    {
        $activePlayerId = $this->game->getActivePlayerId();
        if ($activePlayerId === null || $activePlayerId === '') {
            // During setup or if no active player, return empty args
            return [
                "hand" => [],
                "handSize" => 0,
                "cardsToDiscard" => 0,
                "playableCardsIds" => [],
            ];
        }
        $activePlayerId = (int) $activePlayerId;
        $hand = $this->game->cards->getPlayerHand($activePlayerId);
        $handSize = count($hand);
        $cardsToDiscard = max(0, $handSize - 7);

        return [
            "hand" => $hand,
            "handSize" => $handSize,
            "cardsToDiscard" => $cardsToDiscard,
            "playableCardsIds" => array_column($hand, 'id'),
        ];
    }

    /**
     * Discard cards to get down to 7 or fewer
     */
    #[PossibleAction]
    public function actDiscardCards(#[IntArrayParam] array $card_ids, int $activePlayerId)
    {
        $hand = $this->game->cards->getPlayerHand($activePlayerId);
        $handSize = count($hand);
        $cardsToDiscard = max(0, $handSize - 7);

        if ($cardsToDiscard === 0) {
            return NextPlayer::class;
        }

        if (count($card_ids) !== $cardsToDiscard) {
            throw new UserException(sprintf('You must discard exactly %d cards', $cardsToDiscard));
        }

        if (count($card_ids) > $handSize) {
            throw new UserException('You cannot discard more cards than you have');
        }

        $handCardIds = array_column($hand, 'id');
        foreach ($card_ids as $cardId) {
            if (!in_array($cardId, $handCardIds)) {
                throw new UserException('You can only discard cards from your hand');
            }
        }

        // Move cards to discard
        $discardedCards = [];
        $lastDiscardedCard = null;
        foreach ($card_ids as $cardId) {
            $card = $this->game->cards->getCard($cardId);
            if ($card) {
                $cardPublic = [
                    "id" => (int) $card["id"],
                    "type" => (string) $card["type"],
                    "type_arg" => isset($card["type_arg"]) ? (int) $card["type_arg"] : 0,
                ];
                $discardedCards[] = $cardPublic;
                $lastDiscardedCard = $cardPublic;
            }
            $this->game->moveCardToDiscard((int) $cardId);
        }

        $discardedNames = array_map(function ($c) {
            $decoded = Game::decodeCardTypeArg((int) ($c["type_arg"] ?? 0));
            return Game::getCardName((string) ($c["type"] ?? ""), (int) ($decoded["name_index"] ?? 0));
        }, $discardedCards);

        $this->game->notify->all("cardsDiscarded", clienttranslate('${player_name} discards ${cards}'), [
            "player_id" => $activePlayerId,
            "player_name" => $this->game->getPlayerNameById($activePlayerId),
            "count" => count($card_ids), // kept for client logic / debugging
            "card_ids" => $card_ids,
            "discarded_cards" => $discardedCards,
            "cards" => implode(", ", array_filter($discardedNames)),
            "i18n" => ["cards"],
            "discard_top_card" => $lastDiscardedCard,
        ]);

        // Verify hand size is now 7 or less
        $newHand = $this->game->cards->getPlayerHand($activePlayerId);
        $newHandSize = count($newHand);
        if ($newHandSize > 7) {
            // Still too many cards - stay in this state
            return null;
        }

        // Hand size is good: return to NextPlayer, but DO NOT draw again.
        // We entered DiscardPhase because we already drew an end-of-turn card.
        $this->game->setGameStateValue('skip_draw_flag', 1);
        return NextPlayer::class;
    }

    /**
     * Zombie handling - discard random cards
     */
    function zombie(int $playerId) {
        $hand = $this->game->cards->getPlayerHand($playerId);
        $handSize = count($hand);
        $cardsToDiscard = max(0, $handSize - 7);

        if ($cardsToDiscard > 0) {
            $cardIds = array_column($hand, 'id');
            shuffle($cardIds);
            $cardsToDiscardIds = array_slice($cardIds, 0, $cardsToDiscard);
            return $this->actDiscardCards($cardsToDiscardIds, $playerId);
        }

        return NextPlayer::class;
    }
}
