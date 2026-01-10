# BGA Studio Game Dev Template

## Prerequisites

- VSCode
- Docker

## Setup

1. Clone this repo.
1. Make a copy of `.devcontainer/devcontainer.env.example`, name it `.devcontainer/devcontainer.env`
   and populate it with the required data. The values are case-sensitive, so take a close look at the example.
1. Start Docker and run the VSCode command `Dev Containers: Reopen in Container`.
1. Run the VSCode command `SFTP: Download Project`.
1. Run the VSCode command `Tasks: Run Build Task`. This wask will run in the background and generate your _.js and _.css built files everytime it detects changes.
1. Run the VSCode command `Tasks: Run Test Task` to open your BGA Studio game page and lunch your game!

## Docs

- https://github.com/NevinAF/bga-ts-template/blob/main/docs/typescript/index.md
- https://en.doc.boardgamearena.com/Game_interface_logic:_yourgamename.js
