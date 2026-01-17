<?php

declare(strict_types=1);

namespace Bga\Games\DondeLasPapasQueman\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\UserException;
use Bga\Games\DondeLasPapasQueman\Game;
use Bga\Games\DondeLasPapasQueman\States\ReactionPhase;

class CardSelection extends GameState
{
    function __construct(protected Game $game)
    {
        parent::__construct(
            $game,
            id: 26,
            type: StateType::ACTIVE_PLAYER,
            description: clienttranslate('${actplayer} must select a card'),
            descriptionMyTurn: clienttranslate('${you} must select a card from the target\'s hand')
        );
    }

    /**
     * Get arguments for card selection
     */
    public function getArgs(): array
    {
        $activePlayerId = $this->game->getActivePlayerId();
        if ($activePlayerId === null || $activePlayerId === '') {
            return [
                "targetPlayerId" => 0,
                "targetPlayerName" => "",
                "handSize" => 0,
                "cardBacks" => [],
            ];
        }
        $activePlayerId = (int) $activePlayerId;

        // Get the action card data to find target
        $actionCardData = $this->game->globals->get("action_card_data");
        $cardData = unserialize($actionCardData);
        $targetPlayerIds = $cardData["target_player_ids"] ?? [];

        // For card selection, we only need one target (the first one)
        $targetPlayerId = !empty($targetPlayerIds) ? (int) $targetPlayerIds[0] : 0;

        if ($targetPlayerId == 0) {
            return [
                "targetPlayerId" => 0,
                "targetPlayerName" => "",
                "handSize" => 0,
                "cardBacks" => [],
            ];
        }

        // Get target's hand
        $targetHand = $this->game->cards->getPlayerHand($targetPlayerId);
        $handSize = count($targetHand);

        // Create card back data (don't reveal actual cards, just show positions)
        $cardBacks = [];
        foreach ($targetHand as $index => $card) {
            $cardBacks[] = [
                "position" => $index, // Position in hand
                "card_id" => $card["id"], // Store ID for selection, but don't reveal card data
            ];
        }

        return [
            "targetPlayerId" => $targetPlayerId,
            "targetPlayerName" => $this->game->getPlayerNameById($targetPlayerId),
            "handSize" => $handSize,
            "cardBacks" => $cardBacks,
        ];
    }

    /**
     * Select a card from target's hand (by position)
     */
    #[PossibleAction]
    public function actSelectCard(int $cardPosition, int $activePlayerId)
    {
        // Get the action card data
        $actionCardData = $this->game->globals->get("action_card_data");
        $cardData = unserialize($actionCardData);
        $targetPlayerIds = $cardData["target_player_ids"] ?? [];
        $targetPlayerId = !empty($targetPlayerIds) ? (int) $targetPlayerIds[0] : 0;

        if ($targetPlayerId == 0) {
            throw new UserException("Invalid target player");
        }

        // Get target's hand
        $targetHand = $this->game->cards->getPlayerHand($targetPlayerId);
        
        if ($cardPosition < 0 || $cardPosition >= count($targetHand)) {
            throw new UserException("Invalid card position");
        }

        // Get the selected card
        $selectedCard = $targetHand[$cardPosition];
        $selectedCardId = $selectedCard["id"];

        // Store selected card ID in action card data
        $cardData["selected_card_id"] = $selectedCardId;
        $this->game->globals->set("action_card_data", serialize($cardData));

        // Notify all players (reveal the card that was selected)
        $decoded = Game::decodeCardTypeArg((int) $selectedCard["type_arg"]);
        $cardName = Game::getCardName($selectedCard["type"], $decoded["name_index"]);
        
        $this->game->notify->all("cardSelected", clienttranslate('${player_name} selects ${card_name} from ${target_name}\'s hand'), [
            "player_id" => $activePlayerId,
            "player_name" => $this->game->getPlayerNameById($activePlayerId),
            "target_player_id" => $targetPlayerId,
            "target_name" => $this->game->getPlayerNameById($targetPlayerId),
            "card_id" => $selectedCardId,
            "card_name" => $cardName,
            "i18n" => ["card_name", "target_name"],
        ]);

        // Transition to reaction phase
        // Reaction phase will handle interrupts, then transition to action resolution
        return ReactionPhase::class;
    }

    /**
     * Zombie handling - select random card
     */
    function zombie(int $playerId)
    {
        $args = $this->getArgs();
        $handSize = $args["handSize"];

        if ($handSize == 0) {
            // No cards to select, go to reaction phase
            return ReactionPhase::class;
        }

        // Select random position
        $randomPosition = rand(0, $handSize - 1);
        return $this->actSelectCard($randomPosition, $playerId);
    }
}
