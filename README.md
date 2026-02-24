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

## Known Issues

- **Extensions not installing automatically**: When starting the devcontainer, the defined extensions (e.g. BGA extension pack, SFTP) may not install automatically. As a result, file transfer to BGA via SFTP will not work until you manually install the extensions: open the Extensions view, search for "BGA extension pack" (or the specific SFTP extension), and install them. You may need to reload the window after installation.

## Docs

- [BGA Using TypeScript and SCSS](https://en.doc.boardgamearena.com/Using_Typescript_and_Scss)
- [BGA Game Interface Logic](https://en.doc.boardgamearena.com/Game_interface_logic:_yourgamename.js)
