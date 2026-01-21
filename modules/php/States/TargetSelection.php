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

class TargetSelection extends GameState {
    function __construct(protected Game $game) {
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
    public function getArgs(): array {
        $activePlayerId = $this->game->getActivePlayerId();
        if ($activePlayerId === null || $activePlayerId === "") {
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
        $requiresMultipleTargets = $nameIndex == 14; // Spider potato requires 2 targets
        $targetCount = $requiresMultipleTargets ? 2 : 1;

        // Get all players except self (unless card allows self)
        $players = $this->game->getCollectionFromDb("SELECT player_id, player_name, player_color FROM player");
        $selectablePlayers = [];

        foreach ($players as $player) {
            $playerId = (int) $player["player_id"];
            // Spider potato can include self, others cannot
            if ($nameIndex == 14 || $playerId != $activePlayerId) {
                $selectablePlayers[] = [
                    "id" => $playerId,
                    "name" => $player["player_name"],
                    "color" => $player["player_color"] ?? "",
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
    public function actSelectTargets(#[IntArrayParam] array $targetPlayerIds, int $activePlayerId) {
        // Get the card being played from game state
        $actionCardData = $this->game->globals->get("action_card_data");
        $cardData = unserialize($actionCardData);
        $nameIndex = $cardData["name_index"] ?? 0;
        $cardName = $cardData["card_name"] ?? "";

        // Validate target count
        $requiresMultipleTargets = $nameIndex == 14; // Spider potato
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

        // Also store targets in reaction_data so the interruption step has full context.
        $reactionData = $this->game->globals->get("reaction_data");
        if ($reactionData) {
            $data = unserialize($reactionData);
            if (($data["type"] ?? "") === "action_card") {
                $data["target_player_ids"] = $targetPlayerIds;
                $this->game->globals->set("reaction_data", serialize($data));
            }
        }

        // Log which player(s) were targeted (important for ReactionPhase decisions).
        // (Especially useful for "Lend me a buck", where the target needs to know they're being targeted before card selection.)
        $targetNames = array_map(fn($id) => $this->game->getPlayerNameById((int) $id), $targetPlayerIds);
        $targetNamesText = implode(", ", array_filter($targetNames));
        if ($targetNamesText !== "") {
            $this->game->notify->all(
                "targetsSelected",
                clienttranslate('${player_name} targets ${target_name} with ${card_name}'),
                [
                    "player_id" => $activePlayerId,
                    "player_name" => $this->game->getPlayerNameById($activePlayerId),
                    "target_name" => $targetNamesText,
                    "card_name" => $cardName,
                    "i18n" => ["card_name"],
                ]
            );
        }

        // Always allow interruption after choosing targets, before any follow-up selection.
        // ReactionPhase will route to CardSelection / CardNameSelection / ActionResolution as needed.
        return ReactionPhase::class;
    }

    /**
     * Zombie handling - select random target(s)
     */
    function zombie(int $playerId) {
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
