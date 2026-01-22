<?php
/**
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * DondeLasPapasQueman implementation : © <Your name here> <Your email address here>
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 *
 * Game.php
 *
 * This is the main file for your game logic.
 *
 * In this PHP file, you are going to defines the rules of the game.
 */
declare(strict_types=1);

namespace Bga\Games\DondeLasPapasQueman;

use Bga\Games\DondeLasPapasQueman\States\PlayerTurn;
use Bga\GameFramework\Components\Counters\PlayerCounter;
use Bga\GameFramework\Components\Deck;

class Game extends \Bga\GameFramework\Table {
    public static array $CARD_TYPES;

    public PlayerCounter $playerEnergy;
    public PlayerCounter $playerGoldenPotatoes;
    public Deck $cards;

    /**
     * Your global variables labels:
     *
     * Here, you can assign labels to global variables you are using for this game. You can use any number of global
     * variables with IDs between 10 and 99. If you want to store any type instead of int, use $this->globals instead.
     *
     * NOTE: afterward, you can get/set the global variables with `getGameStateValue`, `setGameStateInitialValue` or
     * `setGameStateValue` functions.
     */
    public function __construct() {
        parent::__construct();
        $this->initGameStateLabels([
            "skip_draw_flag" => 10,
            "alarm_flag" => 12,
            "interrupt_played" => 13,
            "skip_next_player" => 14,
            "turn_start_flag" => 15,
            "win_condition_met" => 16,
        ]);

        $this->playerEnergy = $this->counterFactory->createPlayerCounter("energy");
        $this->playerGoldenPotatoes = $this->counterFactory->createPlayerCounter("golden_potatoes");

        $this->cards = $this->deckFactory->createDeck("card");
        $this->cards->init("card");

        // Card types: type stored in card_type, name stored in card_type_arg
        // card_type values: 'potato', 'wildcard', 'action'
        // For potato cards, card_type_arg stores the name index: 1='potato', 2='duchesses potatoes', 3='french fries'
        // For action cards, card_type_arg stores the name index: 1='No dude', 2='I told you no dude', etc.
        //
        // Card data structure: card_type_arg encodes name_index, value, and isAlarm
        // Format: name_index * 10000 + value * 100 + (isAlarm ? 1 : 0)
        // - name_index: 0-999 (identifies specific card name within type)
        // - value: 0-3 (card value, potato cards always have value 0)
        // - isAlarm: 0-1 (boolean flag for alarm cards)
        self::$CARD_TYPES = [
            // Helper: get card name by type and type_arg
            "names" => [
                "potato" => [
                    1 => clienttranslate("potato"),
                    2 => clienttranslate("duchesses potatoes"),
                    3 => clienttranslate("french fries"),
                ],
                "action" => [
                    1 => clienttranslate("No dude"),
                    2 => clienttranslate("I told you no dude"),
                    3 => clienttranslate("Get off the pony"),
                    4 => clienttranslate("Lend me a buck"),
                    5 => clienttranslate("Runaway potatoes"),
                    6 => clienttranslate("Harry Potato"),
                    7 => clienttranslate("Pope Potato"),
                    8 => clienttranslate("Look ahead"),
                    9 => clienttranslate("The potato of the year"),
                    10 => clienttranslate("Potato of destiny"),
                    11 => clienttranslate("Potato Dawan"),
                    12 => clienttranslate("Jump to the side"),
                    13 => clienttranslate("Papageddon"),
                    14 => clienttranslate("Spider potato"),
                ],
                "wildcard" => [
                    1 => clienttranslate("Wildcard"),
                ],
            ],
        ];

        /* example of notification decorator.
        // automatically complete notification args when needed
        $this->notify->addDecorator(function(string $message, array $args) {
            if (isset($args['player_id']) && !isset($args['player_name']) && str_contains($message, '${player_name}')) {
                $args['player_name'] = $this->getPlayerNameById($args['player_id']);
            }
        
            if (isset($args['card_id']) && !isset($args['card_name']) && str_contains($message, '${card_name}')) {
                $args['card_name'] = self::$CARD_TYPES[$args['card_id']]['card_name'];
                $args['i18n'][] = ['card_name'];
            }
            
            return $args;
        });*/
    }

    /**
     * Get card name by type and type_arg
     */
    public static function getCardName(string $type, int $typeArg): string {
        return self::$CARD_TYPES["names"][$type][$typeArg] ?? "";
    }

    /**
     * Check if an action card requires target selection
     * Returns: false if no target, 1 for single target, 2 for multiple targets
     */
    public static function actionCardRequiresTarget(int $nameIndex): int {
        // Cards that require single target
        $singleTargetCards = [3, 4, 7, 8, 10, 11]; // Get off the pony, Lend me a buck, Pope Potato, Look ahead, Potato of destiny, Potato Dawan
        // Cards that require multiple targets
        $multipleTargetCards = [14]; // Spider potato (2 targets)

        if (in_array($nameIndex, $multipleTargetCards)) {
            return 2;
        }
        if (in_array($nameIndex, $singleTargetCards)) {
            return 1;
        }
        return 0;
    }

    /**
     * Get win threshold based on player count
     */
    public function getWinThreshold(): int {
        $players = $this->getCollectionFromDb("SELECT player_id FROM player");
        $playerCount = count($players);

        return match ($playerCount) {
            2, 3 => 8,
            4, 5 => 6,
            6 => 5,
            default => 8,
        };
    }

    /**
     * Check if any player has reached the win threshold
     * Returns the player_id of the winner, or 0 if no winner yet
     */
    public function checkWinCondition(): int {
        $winThreshold = $this->getWinThreshold();
        $players = $this->getCollectionFromDb("SELECT player_id FROM player");

        foreach ($players as $player) {
            $potatoes = $this->playerGoldenPotatoes->get((int) $player["player_id"]);
            if ($potatoes >= $winThreshold) {
                return (int) $player["player_id"];
            }
        }

        return 0;
    }

    /**
     * Update golden potatoes and sync the score
     * This ensures the player's score always matches their golden potatoes count
     * Also checks for win condition immediately
     */
    public function updateGoldenPotatoes(int $playerId, int $delta): int {
        $newValue = $this->playerGoldenPotatoes->inc($playerId, $delta);
        // Sync score with golden potatoes
        $this->playerScore->set($playerId, $newValue);
        return $newValue;
    }

    /**
     * Decode card_type_arg to get name_index, value, and isAlarm
     * Format: name_index * 10000 + value * 100 + (isAlarm ? 1 : 0)
     * Value range: 0-3 (potato cards always have value 0)
     */
    public static function decodeCardTypeArg(int $typeArg): array {
        $isAlarm = $typeArg % 100 == 1;
        $value = intval(($typeArg % 10000) / 100);
        $nameIndex = intval($typeArg / 10000);
        return ["name_index" => $nameIndex, "value" => $value, "isAlarm" => $isAlarm];
    }

    /**
     * Encode name_index, value, and isAlarm into card_type_arg
     * Value must be between 0-3 (potato cards always have value 0)
     */
    public static function encodeCardTypeArg(int $nameIndex, int $value, bool $isAlarm): int {
        // Validate value range
        if ($value < 0 || $value > 3) {
            throw new \Exception("Card value must be between 0 and 3, got: " . $value);
        }
        return $nameIndex * 10000 + $value * 100 + ($isAlarm ? 1 : 0);
    }

    /**
     * Compute and return the current game progression.
     *
     * The number returned must be an integer between 0 and 100.
     *
     * This method is called each time we are in a game state with the "updateGameProgression" property set to true.
     *
     * @return int
     * @see ./states.inc.php
     */
    public function getGameProgression() {
        $players = $this->getCollectionFromDb("SELECT player_id FROM player");
        $playerCount = count($players);

        // Win conditions: 2-3 players: 8, 4-5 players: 6, 6 players: 5
        $winThreshold = match ($playerCount) {
            2, 3 => 8,
            4, 5 => 6,
            6 => 5,
            default => 8,
        };

        $maxPotatoes = 0;
        foreach ($players as $player) {
            $potatoes = $this->playerGoldenPotatoes->get((int) $player["player_id"]);
            if ($potatoes > $maxPotatoes) {
                $maxPotatoes = $potatoes;
            }
        }

        return min(100, intval(($maxPotatoes / $winThreshold) * 100));
    }

    /**
     * Migrate database.
     *
     * You don't have to care about this until your game has been published on BGA. Once your game is on BGA, this
     * method is called everytime the system detects a game running with your old database scheme. In this case, if you
     * change your database scheme, you just have to apply the needed changes in order to update the game database and
     * allow the game to continue to run with your new version.
     *
     * @param int $from_version
     * @return void
     */
    public function upgradeTableDb($from_version) {
        //       if ($from_version <= 1404301345)
        //       {
        //            // ! important ! Use `DBPREFIX_<table_name>` for all tables
        //
        //            $sql = "ALTER TABLE `DBPREFIX_xxxxxxx` ....";
        //            $this->applyDbUpgradeToAllDB( $sql );
        //       }
        //
        //       if ($from_version <= 1405061421)
        //       {
        //            // ! important ! Use `DBPREFIX_<table_name>` for all tables
        //
        //            $sql = "CREATE TABLE `DBPREFIX_xxxxxxx` ....";
        //            $this->applyDbUpgradeToAllDB( $sql );
        //       }
    }

    /*
     * Gather all information about current game situation (visible by the current player).
     *
     * The method is called each time the game interface is displayed to a player, i.e.:
     *
     * - when the game starts
     * - when a player refreshes the game page (F5)
     */
    protected function getAllDatas(): array {
        $result = [];

        // WARNING: We must only return information visible by the current player.
        // Use bReturnNullIfNotLogged to handle cases during setup when no player is logged in
        $current_player_id = $this->getCurrentPlayerId(true);
        if ($current_player_id === null) {
            $current_player_id = 0; // Default to 0 if no player is logged in (during setup)
        } else {
            $current_player_id = (int) $current_player_id;
        }

        // Get information about players.
        // NOTE: you can retrieve some extra field you added for "player" table in `dbmodel.sql` if you need it.
        $result["players"] = $this->getCollectionFromDb(
            "SELECT `player_id` `id`, `player_score` `score` FROM `player`"
        );
        $this->playerEnergy->fillResult($result);
        $this->playerGoldenPotatoes->fillResult($result);

        // Add hand counts for all players (visible to all)
        foreach ($result["players"] as $playerId => $player) {
            $handCount = $this->cards->countCardInLocation("hand", (int) $playerId);
            $result["players"][$playerId]["handCount"] = $handCount;
        }

        // Get current player's hand (empty array if no current player)
        // Use array_values() to ensure it's a numeric array, not an associative array (which becomes an object in JSON)
        $hand = $current_player_id > 0 ? $this->cards->getPlayerHand($current_player_id) : [];
        $result["hand"] = array_values($hand);

        // Get deck count (visible to all)
        $result["deckCount"] = $this->cards->countCardInLocation("deck");

        // Get discard count (visible to all)
        $result["discardCount"] = $this->cards->countCardInLocation("discard");

        // Get top card of discard pile (visible to all).
        // This allows the UI to reconstruct discard display after a page refresh.
        $topDiscard = $this->getObjectFromDb(
            "SELECT card_id id, card_type type, card_type_arg type_arg
             FROM card
             WHERE card_location = 'discard'
             ORDER BY card_location_arg DESC, card_id DESC
             LIMIT 1"
        );
        $result["discardTopCard"] = $topDiscard ?: null;

        // Get golden potato pile count (visible to all)
        $result["goldenPotatoPileCount"] = $this->cards->countCardInLocation("golden_potato_pile");

        // Get win threshold (visible to all players)
        $result["winThreshold"] = $this->getWinThreshold();

        return $result;
    }

    /**
     * Get the next location_arg value for the discard pile.
     * This ensures that cards moved to discard are ordered correctly (newest on top).
     * 
     * @return int The next location_arg value to use when moving a card to discard
     */
    public function getNextDiscardLocationArg(): int {
        $maxLocationArg = $this->getUniqueValueFromDb(
            "SELECT COALESCE(MAX(card_location_arg), -1) FROM card WHERE card_location = 'discard'"
        );
        return (int) $maxLocationArg + 1;
    }

    /**
     * Move a card to the discard pile with the correct location_arg to ensure proper ordering.
     * 
     * @param int $cardId The ID of the card to move
     * @return void
     */
    public function moveCardToDiscard(int $cardId): void {
        $locationArg = $this->getNextDiscardLocationArg();
        $this->cards->moveCard($cardId, "discard", $locationArg);
    }

    /**
     * This method is called only once, when a new game is launched. In this method, you must setup the game
     *  according to the game rules, so that the game is ready to be played.
     */
    protected function setupNewGame($players, $options = []) {
        $playerIds = array_keys($players);
        $playerCount = count($players);

        // Initialize game state values FIRST, before other operations
        // This ensures labels are registered before any state tries to use them
        $this->setGameStateInitialValue("skip_draw_flag", 0);
        $this->setGameStateInitialValue("alarm_flag", 0);
        $this->setGameStateInitialValue("interrupt_played", 0);
        $this->setGameStateInitialValue("skip_next_player", 0);
        $this->setGameStateInitialValue("win_condition_met", 0);
        // Note: reaction_data is stored in globals, not game state values

        $this->playerEnergy->initDb($playerIds, initialValue: 2);
        $this->playerGoldenPotatoes->initDb($playerIds, initialValue: 0);
        // Initialize scores to 0 (matching golden potatoes)
        $this->playerScore->initDb($playerIds, initialValue: 0);

        // Set the colors of the players with HTML color code. The default below is red/green/blue/orange/brown. The
        // number of colors defined here must correspond to the maximum number of players allowed for the gams.
        $gameinfos = $this->getGameinfos();
        $default_colors = $gameinfos["player_colors"];

        $query_values = [];
        foreach ($players as $player_id => $player) {
            // Now you can access both $player_id and $player array
            $query_values[] = vsprintf("('%s', '%s', '%s', '%s', '%s')", [
                $player_id,
                array_shift($default_colors),
                $player["player_canal"],
                addslashes($player["player_name"]),
                addslashes($player["player_avatar"]),
            ]);
        }

        // Create players based on generic information.
        //
        // NOTE: You can add extra field on player table in the database (see dbmodel.sql) and initialize
        // additional fields directly here.
        static::DbQuery(
            sprintf(
                "INSERT INTO player (player_id, player_color, player_canal, player_name, player_avatar) VALUES %s",
                implode(",", $query_values)
            )
        );

        $this->reattributeColorsBasedOnPreferences($players, $gameinfos["player_colors"]);
        $this->reloadPlayersBasicInfos();

        // Create the player order table - this must be done before activating the first player
        // createNextPlayerTable expects an array of player IDs, not the full player data
        $this->createNextPlayerTable($playerIds);

        // Create cards
        // Total: 106 cards
        // Distribution:
        // - Potato cards: potato (16), duchesses potatoes (12), french fries (5) = 33
        // - Wildcards: 3
        // - Action cards: No dude (10), I told you no dude (3), Get off the pony (5),
        //   Lend me a buck (10), Runaway potatoes (3), Harry Potato (10), Pope Potato (3),
        //   Look ahead (3), The potato of the year (5), Potato of destiny (3),
        //   Potato Dawan (3), Jump to the side (3), Papageddon (3), Spider potato (3) = 70
        // Total: 33 + 3 + 70 = 106

        $cardsToCreate = [];

        // Create potato cards
        // Potato cards always have value 0
        // potato (name_index=1): 16 cards
        for ($i = 0; $i < 16; $i++) {
            $cardsToCreate[] = [
                "type" => "potato",
                "type_arg" => self::encodeCardTypeArg(1, 0, false),
                "nbr" => 1,
            ];
        }

        // duchesses potatoes (name_index=2): 12 cards
        for ($i = 0; $i < 12; $i++) {
            $cardsToCreate[] = [
                "type" => "potato",
                "type_arg" => self::encodeCardTypeArg(2, 0, false),
                "nbr" => 1,
            ];
        }

        // french fries (name_index=3): 5 cards
        for ($i = 0; $i < 5; $i++) {
            $cardsToCreate[] = [
                "type" => "potato",
                "type_arg" => self::encodeCardTypeArg(3, 0, false),
                "nbr" => 1,
            ];
        }

        // Wildcards: 3 cards with values 0-3
        for ($i = 0; $i < 3; $i++) {
            $value = rand(0, 3); // Value range: 0-3
            $cardsToCreate[] = [
                "type" => "wildcard",
                "type_arg" => self::encodeCardTypeArg(1, $value, false),
                "nbr" => 1,
            ];
        }

        // No dude (name_index=1): 10 cards
        for ($i = 0; $i < 10; $i++) {
            $cardsToCreate[] = [
                "type" => "action",
                "type_arg" => self::encodeCardTypeArg(1, 0, false),
                "nbr" => 1,
            ];
        }

        // I told you no dude (name_index=2): 3 cards
        for ($i = 0; $i < 3; $i++) {
            $cardsToCreate[] = [
                "type" => "action",
                "type_arg" => self::encodeCardTypeArg(2, 0, false),
                "nbr" => 1,
            ];
        }

        // Get off the pony (name_index=3, value=2, isAlarm=true): 5 cards
        for ($i = 0; $i < 5; $i++) {
            $cardsToCreate[] = [
                "type" => "action",
                "type_arg" => self::encodeCardTypeArg(3, 2, true),
                "nbr" => 1,
            ];
        }

        // Lend me a buck (name_index=4, value=1, isAlarm=false): 10 cards
        for ($i = 0; $i < 10; $i++) {
            $cardsToCreate[] = [
                "type" => "action",
                "type_arg" => self::encodeCardTypeArg(4, 1, false),
                "nbr" => 1,
            ];
        }

        // Runaway potatoes (name_index=5, value=3, isAlarm=false): 3 cards
        for ($i = 0; $i < 3; $i++) {
            $cardsToCreate[] = [
                "type" => "action",
                "type_arg" => self::encodeCardTypeArg(5, 3, false),
                "nbr" => 1,
            ];
        }

        // Harry Potato (name_index=6, value=1, isAlarm=true): 10 cards
        for ($i = 0; $i < 10; $i++) {
            $cardsToCreate[] = [
                "type" => "action",
                "type_arg" => self::encodeCardTypeArg(6, 1, true),
                "nbr" => 1,
            ];
        }

        // Pope Potato (name_index=7, value=3, isAlarm=false): 3 cards
        for ($i = 0; $i < 3; $i++) {
            $cardsToCreate[] = [
                "type" => "action",
                "type_arg" => self::encodeCardTypeArg(7, 3, false),
                "nbr" => 1,
            ];
        }

        // Look ahead (name_index=8, value=3, isAlarm=true): 3 cards
        for ($i = 0; $i < 3; $i++) {
            $cardsToCreate[] = [
                "type" => "action",
                "type_arg" => self::encodeCardTypeArg(8, 3, true),
                "nbr" => 1,
            ];
        }

        // The potato of the year (name_index=9, value=2, isAlarm=false): 5 cards
        for ($i = 0; $i < 5; $i++) {
            $cardsToCreate[] = [
                "type" => "action",
                "type_arg" => self::encodeCardTypeArg(9, 2, false),
                "nbr" => 1,
            ];
        }

        // Potato of destiny (name_index=10, value=3, isAlarm=false): 3 cards
        for ($i = 0; $i < 3; $i++) {
            $cardsToCreate[] = [
                "type" => "action",
                "type_arg" => self::encodeCardTypeArg(10, 3, false),
                "nbr" => 1,
            ];
        }

        // Potato Dawan (name_index=11, value=3, isAlarm=false): 3 cards
        for ($i = 0; $i < 3; $i++) {
            $cardsToCreate[] = [
                "type" => "action",
                "type_arg" => self::encodeCardTypeArg(11, 3, false),
                "nbr" => 1,
            ];
        }

        // Jump to the side (name_index=12, value=3, isAlarm=true): 3 cards
        for ($i = 0; $i < 3; $i++) {
            $cardsToCreate[] = [
                "type" => "action",
                "type_arg" => self::encodeCardTypeArg(12, 3, true),
                "nbr" => 1,
            ];
        }

        // Papageddon (name_index=13, value=3, isAlarm=true): 3 cards
        for ($i = 0; $i < 3; $i++) {
            $cardsToCreate[] = [
                "type" => "action",
                "type_arg" => self::encodeCardTypeArg(13, 3, true),
                "nbr" => 1,
            ];
        }

        // Spider potato (name_index=14, value=3, isAlarm=false): 3 cards
        for ($i = 0; $i < 3; $i++) {
            $cardsToCreate[] = [
                "type" => "action",
                "type_arg" => self::encodeCardTypeArg(14, 3, false),
                "nbr" => 1,
            ];
        }

        // Create all cards in the deck
        $this->cards->createCards($cardsToCreate, "deck");

        // Shuffle the deck
        $this->cards->shuffle("deck");

        // Deal 5 cards to each player
        foreach ($playerIds as $playerId) {
            $this->cards->pickCards(5, "deck", $playerId);
        }

        // Init game statistics.
        //
        // NOTE: statistics used in this file must be defined in your `stats.inc.php` file.

        // Dummy content.
        // $this->tableStats->init('table_teststat1', 0);
        // $this->playerStats->init('player_teststat1', 0);

        // Activate the first player - this must be called before transitioning to an ACTIVE_PLAYER state
        // activeNextPlayer() is safe to call during setup as it just sets the active player in the state machine
        $this->activeNextPlayer();
    }

    /**
     * Example of debug function.
     * Here, jump to a state you want to test (by default, jump to next player state)
     * You can trigger it on Studio using the Debug button on the right of the top bar.
     */
    public function debug_goToState(int $state = 3) {
        $this->gamestate->jumpToState($state);
    }

    /**
     * Another example of debug function, to easily test the zombie code.
     */
    public function debug_playOneMove() {
        $this->debug->playUntil(fn(int $count) => $count == 1);
    }

    /*
    Another example of debug function, to easily create situations you want to test.
    Here, put a card you want to test in your hand (assuming you use the Deck component).

    public function debug_setCardInHand(int $cardType, int $playerId) {
        $card = array_values($this->cards->getCardsOfType($cardType))[0];
        $this->cards->moveCard($card['id'], 'hand', $playerId);
    }
    */
}
