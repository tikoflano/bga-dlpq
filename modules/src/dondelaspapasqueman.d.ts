/*
 *------
 * BGA framework: Gregory Isabelli & Emmanuel Colin & BoardGameArena
 * DondeLasPapasQueman implementation : © tikoflano
 *
 * This code has been produced on the BGA studio platform for use on http://boardgamearena.com.
 * See http://en.boardgamearena.com/#!doc/Studio for more information.
 * -----
 */

interface Card {
  id: number;
  type: string;
  type_arg?: number;
}

interface DondeLasPapasQuemanPlayer extends Player {
  golden_potatoes?: number;
  handCount?: number;
}

interface DondeLasPapasQuemanGamedatas extends Gamedatas<DondeLasPapasQuemanPlayer> {
  hand?: Card[];
  deckCount?: number;
  discardCount?: number;
  discardTopCard?: Card | null;
  goldenPotatoPileCount?: number;
  winThreshold?: number;
  players: { [playerId: number]: DondeLasPapasQuemanPlayer };
}
