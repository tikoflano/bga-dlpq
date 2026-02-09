# Framework reference – Game logic (server side)

**Summary:** Server-side pieces of the BGA framework: main game logic, state classes, database, material, and statistics. This doc lists what each part is and links to the full reference.

**Source:** [Studio • Board Game Arena – Game logic (Server side)](https://boardgamearena.com/doc/Studio)

---

## Main game logic: Game.php

- **Doc:** [Main game logic: yourgamename.game.php](https://boardgamearena.com/doc/Main_game_logic:_yourgamename.game.php)
- Core PHP class that runs the game: state transitions, actions, database updates, notifications.

## Your game state classes: States directory

- **Doc:** [State classes: State directory](https://boardgamearena.com/doc/State_classes:_State_directory)
- One PHP class per game state (e.g. `PlayerTurn`, `ReactionPhase`). States define possible actions and transitions.

## Your game state machine: states.inc.php

- **Doc:** [Your game state machine: states.inc.php](https://boardgamearena.com/doc/Your_game_state_machine:_states.inc.php)
- Declares all states and transitions (state machine definition).

## Game database model: dbmodel.sql

- **Doc:** [Game database model: dbmodel.sql](https://boardgamearena.com/doc/Game_database_model:_dbmodel.sql)
- SQL schema for game-specific tables (e.g. cards, tokens, board).

## Game material description: material.inc.php

- **Doc:** [Game material description: material.inc.php](https://boardgamearena.com/doc/Game_material_description:_material.inc.php)
- Static data: card types, token types, labels, etc., used by both server and client.

## Game statistics: stats.json

- **Doc:** [Game statistics: stats.inc.php](https://boardgamearena.com/doc/Game_statistics:_stats.inc.php) (wiki may say stats.json; the doc covers game statistics)
- Definition of in-game statistics (e.g. points, resources) displayed in the UI and in logs.

## Player actions: X.action.php

- **Doc:** [Players actions: yourgamename.action.php](https://boardgamearena.com/doc/Players_actions:_yourgamename.action.php)
- PHP handlers for player actions (e.g. playCard, pass). Called from the client via the framework.
