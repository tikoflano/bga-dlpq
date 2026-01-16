<?php

declare(strict_types=1);

namespace Bga\Games\DondeLasPapasQueman\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
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
        $activePlayerId = (int) $this->game->getCurrentPlayerId();
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
    public function actDiscardCards(array $card_ids, int $activePlayerId)
    {
        $hand = $this->game->cards->getPlayerHand($activePlayerId);
        $handSize = count($hand);
        $cardsToDiscard = max(0, $handSize - 7);

        if (count($card_ids) < $cardsToDiscard) {
            throw new UserException(sprintf('You must discard at least %d cards', $cardsToDiscard));
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
        foreach ($card_ids as $cardId) {
            $this->game->cards->moveCard($cardId, 'discard');
        }

        $this->game->notify->all("cardsDiscarded", clienttranslate('${player_name} discards ${count} cards'), [
            "player_id" => $activePlayerId,
            "player_name" => $this->game->getPlayerNameById($activePlayerId),
            "count" => count($card_ids),
            "card_ids" => $card_ids,
        ]);

        // Verify hand size is now 7 or less
        $newHand = $this->game->cards->getPlayerHand($activePlayerId);
        $newHandSize = count($newHand);
        if ($newHandSize > 7) {
            // Still too many cards - stay in this state
            return null;
        }

        // Hand size is good, continue to next player
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
