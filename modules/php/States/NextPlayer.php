<?php

declare(strict_types=1);

namespace Bga\Games\DondeLasPapasQueman\States;

use Bga\GameFramework\StateType;
use Bga\Games\DondeLasPapasQueman\Game;

class NextPlayer extends \Bga\GameFramework\States\GameState
{

    function __construct(
        protected Game $game,
    ) {
        parent::__construct($game,
            id: 90,
            type: StateType::GAME,
            updateGameProgression: true,
        );
    }

    /**
     * Called when entering NextPlayer state
     */
    function onEnteringState(int $activePlayerId) {

        // Give some extra time to the active player when he completed an action
        $this->game->giveExtraTime($activePlayerId);
        
        // Check if we should skip the end-of-turn draw
        $skipDraw = $this->game->getGameStateValue('skip_draw_flag') == 1;
        $this->game->setGameStateValue('skip_draw_flag', 0); // Reset flag

        if (!$skipDraw) {
            // Draw 1 card from deck
            $drawnCard = $this->game->cards->pickCard('deck', $activePlayerId);
            
            if ($drawnCard) {
                $this->game->notify->all("cardDrawn", clienttranslate('${player_name} draws a card'), [
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
                    // Transition to DiscardPhase
                    return DiscardPhase::class;
                }
            } else {
                // Deck is empty - handle deck exhaustion
                // For now, just continue (could reshuffle discard or end game)
                $discardCount = $this->game->cards->countCardInLocation('discard');
                if ($discardCount > 0) {
                    // Reshuffle discard into deck
                    $this->game->cards->moveAllCardsInLocation('discard', 'deck');
                    $this->game->cards->shuffle('deck');
                    $this->game->notify->all("deckReshuffled", clienttranslate('The discard pile is reshuffled into the deck'));
                    
                    // Try drawing again
                    $drawnCard = $this->game->cards->pickCard('deck', $activePlayerId);
                    if ($drawnCard) {
                        $this->game->notify->all("cardDrawn", clienttranslate('${player_name} draws a card'), [
                            "player_id" => $activePlayerId,
                            "player_name" => $this->game->getPlayerNameById($activePlayerId),
                            "card_id" => $drawnCard['id'],
                            "card_type" => $drawnCard['type'],
                            "card_type_arg" => $drawnCard['type_arg'],
                        ]);
                        
                        $hand = $this->game->cards->getPlayerHand($activePlayerId);
                        $handSize = count($hand);
                        if ($handSize > 7) {
                            return DiscardPhase::class;
                        }
                    }
                }
            }
        }
        
        // Check win condition
        $players = $this->game->getCollectionFromDb("SELECT player_id FROM player");
        $playerCount = count($players);
        
        $winThreshold = match($playerCount) {
            2, 3 => 8,
            4, 5 => 6,
            6 => 5,
            default => 8,
        };

        foreach ($players as $player) {
            $potatoes = $this->game->playerGoldenPotatoes->get((int) $player['player_id']);
            if ($potatoes >= $winThreshold) {
                return EndScore::class;
            }
        }
        
        // Check if next player should be skipped
        $skipNextPlayer = $this->game->getGameStateValue("skip_next_player") == 1;
        if ($skipNextPlayer) {
            // Reset flag
            $this->game->setGameStateValue("skip_next_player", 0);
            // Skip to player after next
            $this->game->activeNextPlayer(); // Skip first player
        }
        
        $this->game->activeNextPlayer();

        // Reset turn start flag for the new player's turn
        $this->game->setGameStateValue("turn_start_flag", 1);

        return PlayerTurn::class;
    }
}