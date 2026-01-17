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
            10 => "skip_draw_flag",
            11 => "reaction_data",
            12 => "alarm_flag",
            13 => "interrupt_played",
        ]);

        $this->playerEnergy = $this->counterFactory->createPlayerCounter("energy");
        $this->playerGoldenPotatoes = $this->counterFactory->createPlayerCounter("golden_potatoes");

        $this->cards = $this->deckFactory->createDeck("card");
        $this->cards->init("card");

        // Card types: type stored in card_type, name stored in card_type_arg
        // card_type values: 'potato', 'wildcard', 'action'
        // For potato cards, card_type_arg stores the name index: 1='papa', 2='papas duquesas', 3='papas fritas'
        // For action cards, card_type_arg stores the name index: 1='No Poh', 2='Te Dije Que No Poh', etc.
        // value and isAlarm stored in card_type_arg structure (we'll use JSON or separate fields)
        // For now, we'll store: card_type_arg = name_index, and use globals or additional fields for value/isAlarm
        // Actually, BGA Deck uses card_type_arg as int, so we need to encode: name_index * 1000 + value * 10 + isAlarm
        // Or better: use card_type_arg for name index, and store value/isAlarm in a custom way
        // Let's use a simpler approach: card_type_arg encodes: name_index (0-999), value (0-99), isAlarm (0-1)
        // Format: name_index * 10000 + value * 100 + isAlarm
        // But that's complex. Let's use card_type_arg for name index and add helper methods

        // Card data structure: card_type_arg encodes name_index, value, and isAlarm
        // Format: name_index * 10000 + value * 100 + (isAlarm ? 1 : 0)
        // This allows: name_index 0-999, value 0-99, isAlarm 0-1
        self::$CARD_TYPES = [
            // Helper: get card name by type and type_arg
            "names" => [
                "potato" => [
                    1 => clienttranslate("papa"),
                    2 => clienttranslate("papas duquesas"),
                    3 => clienttranslate("papas fritas"),
                ],
                "action" => [
                    1 => clienttranslate("No Poh"),
                    2 => clienttranslate("Te Dije Que No Poh"),
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
     * Decode card_type_arg to get name_index, value, and isAlarm
     * Format: name_index * 10000 + value * 100 + (isAlarm ? 1 : 0)
     */
    public static function decodeCardTypeArg(int $typeArg): array {
        $isAlarm = $typeArg % 100 == 1;
        $value = intval(($typeArg % 10000) / 100);
        $nameIndex = intval($typeArg / 10000);
        return ["name_index" => $nameIndex, "value" => $value, "isAlarm" => $isAlarm];
    }

    /**
     * Encode name_index, value, and isAlarm into card_type_arg
     */
    public static function encodeCardTypeArg(int $nameIndex, int $value, bool $isAlarm): int {
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

        // Get current player's hand (empty array if no current player)
        // Use array_values() to ensure it's a numeric array, not an associative array (which becomes an object in JSON)
        $hand = $current_player_id > 0 ? $this->cards->getPlayerHand($current_player_id) : [];
        $result["hand"] = array_values($hand);

        // Get deck count (visible to all)
        $result["deckCount"] = $this->cards->countCardInLocation("deck");

        // Get discard count (visible to all)
        $result["discardCount"] = $this->cards->countCardInLocation("discard");

        // Get golden potato pile count (visible to all)
        $result["goldenPotatoPileCount"] = $this->cards->countCardInLocation("golden_potato_pile");

        return $result;
    }

    /**
     * This method is called only once, when a new game is launched. In this method, you must setup the game
     *  according to the game rules, so that the game is ready to be played.
     */
    protected function setupNewGame($players, $options = []) {
        $playerIds = array_keys($players);
        $playerCount = count($players);

        $this->playerEnergy->initDb($playerIds, initialValue: 2);
        $this->playerGoldenPotatoes->initDb($playerIds, initialValue: 0);

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
        // Total: 103 cards
        // Distribution (example - adjust as needed):
        // - Potato cards: papa (30), papas duquesas (25), papas fritas (20) = 75
        // - Wildcards: 15
        // - Action cards: No Poh (10), Te Dije Que No Poh (3) = 13
        // Total: 75 + 15 + 13 = 103

        $cardsToCreate = [];

        // Create potato cards
        // papa (name_index=1): 30 cards with various values
        for ($i = 0; $i < 30; $i++) {
            $value = rand(1, 10); // Random value 1-10 for now
            $cardsToCreate[] = [
                "type" => "potato",
                "type_arg" => self::encodeCardTypeArg(1, $value, false),
                "nbr" => 1,
            ];
        }

        // papas duquesas (name_index=2): 25 cards
        for ($i = 0; $i < 25; $i++) {
            $value = rand(1, 10);
            $cardsToCreate[] = [
                "type" => "potato",
                "type_arg" => self::encodeCardTypeArg(2, $value, false),
                "nbr" => 1,
            ];
        }

        // papas fritas (name_index=3): 20 cards
        for ($i = 0; $i < 20; $i++) {
            $value = rand(1, 10);
            $cardsToCreate[] = [
                "type" => "potato",
                "type_arg" => self::encodeCardTypeArg(3, $value, false),
                "nbr" => 1,
            ];
        }

        // Wildcards: 15 cards
        for ($i = 0; $i < 15; $i++) {
            $value = rand(1, 10);
            $cardsToCreate[] = [
                "type" => "wildcard",
                "type_arg" => self::encodeCardTypeArg(1, $value, false),
                "nbr" => 1,
            ];
        }

        // No Poh (name_index=1): 10 cards
        for ($i = 0; $i < 10; $i++) {
            $cardsToCreate[] = [
                "type" => "action",
                "type_arg" => self::encodeCardTypeArg(1, 0, false),
                "nbr" => 1,
            ];
        }

        // Te Dije Que No Poh (name_index=2): 3 cards
        for ($i = 0; $i < 3; $i++) {
            $cardsToCreate[] = [
                "type" => "action",
                "type_arg" => self::encodeCardTypeArg(2, 0, false),
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
