<?php

declare(strict_types=1);

namespace Bga\Games\DondeLasPapasQueman\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\UserException;
use Bga\Games\DondeLasPapasQueman\Game;

class CardNameSelection extends GameState
{
    function __construct(protected Game $game)
    {
        parent::__construct(
            $game,
            id: 28,
            type: StateType::ACTIVE_PLAYER,
            description: clienttranslate('${actplayer} must name a card'),
            descriptionMyTurn: clienttranslate('${you} must name a card')
        );
    }

    /**
     * Get arguments for card name selection
     */
    public function getArgs(): array
    {
        // Get all possible card names
        $cardNames = [];
        
        // Potato cards
        $cardNames["potato"] = [
            1 => Game::getCardName("potato", 1), // potato
            2 => Game::getCardName("potato", 2), // duchesses potatoes
            3 => Game::getCardName("potato", 3), // fried potatoes
        ];
        
        // Action cards (excluding interrupts which can't be stolen)
        $cardNames["action"] = [
            3 => Game::getCardName("action", 3), // Get off the pony
            4 => Game::getCardName("action", 4), // Lend me a buck
            5 => Game::getCardName("action", 5), // Runaway potatoes
            6 => Game::getCardName("action", 6), // Harry Potato
            7 => Game::getCardName("action", 7), // Pope Potato
            8 => Game::getCardName("action", 8), // Look ahead
            9 => Game::getCardName("action", 9), // The potato of the year
            10 => Game::getCardName("action", 10), // Potato of destiny
            11 => Game::getCardName("action", 11), // Potato Dawan
            12 => Game::getCardName("action", 12), // Jump to the side
            13 => Game::getCardName("action", 13), // Papageddon
            14 => Game::getCardName("action", 14), // Spider potato
        ];
        
        // Wildcards
        $cardNames["wildcard"] = [
            1 => Game::getCardName("wildcard", 1), // Wildcard
        ];

        return [
            "cardNames" => $cardNames,
        ];
    }

    /**
     * Select a card name
     */
    #[PossibleAction]
    public function actSelectCardName(string $cardType, int $nameIndex, int $activePlayerId)
    {
        // Validate card type and name_index
        $validTypes = ["potato", "action", "wildcard"];
        if (!in_array($cardType, $validTypes)) {
            throw new UserException("Invalid card type");
        }

        // Get action card data
        $actionCardData = $this->game->globals->get("action_card_data");
        $cardData = unserialize($actionCardData);
        
        // Store selected card name
        $cardData["named_card_type"] = $cardType;
        $cardData["named_name_index"] = $nameIndex;
        $this->game->globals->set("action_card_data", serialize($cardData));

        $cardName = Game::getCardName($cardType, $nameIndex);
        
        $this->game->notify->all("cardNameSelected", clienttranslate('${player_name} names ${card_name}'), [
            "player_id" => $activePlayerId,
            "player_name" => $this->game->getPlayerNameById($activePlayerId),
            "card_name" => $cardName,
            "card_type" => $cardType,
            "name_index" => $nameIndex,
            "i18n" => ["card_name"],
        ]);

        // Transition to reaction phase
        return ReactionPhase::class;
    }

    /**
     * Zombie handling - select random card name
     */
    function zombie(int $playerId)
    {
        $args = $this->getArgs();
        $cardNames = $args["cardNames"];
        
        // Select random type and name
        $types = array_keys($cardNames);
        $randomType = $types[array_rand($types)];
        $nameIndexes = array_keys($cardNames[$randomType]);
        $randomNameIndex = $nameIndexes[array_rand($nameIndexes)];
        
        return $this->actSelectCardName($randomType, $randomNameIndex, $playerId);
    }
}
