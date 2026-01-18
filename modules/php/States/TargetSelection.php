<?php

declare(strict_types=1);

namespace Bga\Games\DondeLasPapasQueman\States;

use Bga\GameFramework\StateType;
use Bga\GameFramework\States\GameState;
use Bga\GameFramework\States\PossibleAction;
use Bga\GameFramework\Actions\Types\IntArrayParam;
use Bga\GameFramework\UserException;
use Bga\Games\DondeLasPapasQueman\Game;
use Bga\Games\DondeLasPapasQueman\States\CardSelection;
use Bga\Games\DondeLasPapasQueman\States\CardNameSelection;
use Bga\Games\DondeLasPapasQueman\States\ReactionPhase;

class TargetSelection extends GameState
{
    function __construct(protected Game $game)
    {
        parent::__construct(
            $game,
            id: 25,
            type: StateType::ACTIVE_PLAYER,
            description: clienttranslate('${actplayer} must select a target'),
            descriptionMyTurn: clienttranslate('${you} must select a target')
        );
    }

    /**
     * Get arguments for target selection
     */
    public function getArgs(): array
    {
        $activePlayerId = $this->game->getActivePlayerId();
        if ($activePlayerId === null || $activePlayerId === '') {
            return [
                "selectablePlayers" => [],
                "cardName" => "",
                "requiresMultipleTargets" => false,
                "targetCount" => 1,
            ];
        }
        $activePlayerId = (int) $activePlayerId;

        // Get the card being played from game state
        $actionCardData = $this->game->globals->get("action_card_data");
        $cardData = unserialize($actionCardData);
        $cardName = $cardData["card_name"] ?? "";
        $nameIndex = $cardData["name_index"] ?? 0;

        // Determine if multiple targets are required
        $requiresMultipleTargets = ($nameIndex == 14); // Spider potato requires 2 targets
        $targetCount = $requiresMultipleTargets ? 2 : 1;

        // Get all players except self (unless card allows self)
        $players = $this->game->getCollectionFromDb("SELECT player_id, player_name FROM player");
        $selectablePlayers = [];

        foreach ($players as $player) {
            $playerId = (int) $player["player_id"];
            // Spider potato can include self, others cannot
            if ($nameIndex == 14 || $playerId != $activePlayerId) {
                $selectablePlayers[] = [
                    "id" => $playerId,
                    "name" => $player["player_name"],
                ];
            }
        }

        return [
            "selectablePlayers" => $selectablePlayers,
            "cardName" => $cardName,
            "requiresMultipleTargets" => $requiresMultipleTargets,
            "targetCount" => $targetCount,
        ];
    }

    /**
     * Select target(s) for action card
     */
    #[PossibleAction]
    public function actSelectTargets(#[IntArrayParam] array $targetPlayerIds, int $activePlayerId)
    {
        // Get the card being played from game state
        $actionCardData = $this->game->globals->get("action_card_data");
        $cardData = unserialize($actionCardData);
        $nameIndex = $cardData["name_index"] ?? 0;

        // Validate target count
        $requiresMultipleTargets = ($nameIndex == 14); // Spider potato
        $expectedCount = $requiresMultipleTargets ? 2 : 1;

        if (count($targetPlayerIds) != $expectedCount) {
            throw new UserException(sprintf("You must select exactly %d target(s)", $expectedCount));
        }

        // Validate targets are valid players
        $players = $this->game->getCollectionFromDb("SELECT player_id FROM player");
        $validPlayerIds = array_column($players, "player_id");

        foreach ($targetPlayerIds as $targetId) {
            if (!in_array($targetId, $validPlayerIds)) {
                throw new UserException("Invalid target player");
            }
            // For most cards, cannot target self (except Spider potato)
            if ($nameIndex != 14 && $targetId == $activePlayerId) {
                throw new UserException("You cannot target yourself");
            }
        }

        // Store selected targets in game state
        $cardData["target_player_ids"] = $targetPlayerIds;
        $this->game->globals->set("action_card_data", serialize($cardData));

        // Check if card requires card selection (blind card stealing)
        // Cards that need card selection: 4 (Lend me a buck), 11 (Potato Dawan), 13 (Papageddon)
        $needsCardSelection = in_array($nameIndex, [4, 11, 13]);
        
        // Check if card requires card name selection (Pope Potato)
        $needsCardNameSelection = ($nameIndex == 7); // Pope Potato
        
        if ($needsCardSelection) {
            // Transition to card selection
            return CardSelection::class;
        } elseif ($needsCardNameSelection) {
            // Transition to card name selection
            return CardNameSelection::class;
        } else {
            // Transition to reaction phase
            return ReactionPhase::class;
        }
    }

    /**
     * Zombie handling - select random target(s)
     */
    function zombie(int $playerId)
    {
        $args = $this->getArgs();
        $selectablePlayers = $args["selectablePlayers"];
        $targetCount = $args["targetCount"];

        if (empty($selectablePlayers)) {
            // No valid targets, skip target selection
            return ReactionPhase::class;
        }

        // Select random target(s)
        shuffle($selectablePlayers);
        $selectedTargets = array_slice($selectablePlayers, 0, $targetCount);
        $targetIds = array_column($selectedTargets, "id");

        return $this->actSelectTargets($targetIds, $playerId);
    }
}
