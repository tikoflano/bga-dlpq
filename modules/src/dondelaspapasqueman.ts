/// <reference path="./types/bga-framework.d.ts" />
/// <reference path="./types/dondelaspapasqueman.d.ts" />
/// <reference path="./types/bga-libs.d.ts" />

import { Game } from "./client/Game";

const BgaAnimations = await importEsmLib("bga-animations", "1.x");
const BgaCards = await importEsmLib("bga-cards", "1.x");

Game.setBgaLibs(BgaAnimations, BgaCards);

export { Game };
