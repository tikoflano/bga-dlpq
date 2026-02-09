# First steps with BGA Studio

**Summary:** How to connect to BGA Studio, create a project, set up SFTP/sync and your IDE, run a game, and commit. Condensed from the official “First steps” page.

**Source:** [First steps with BGA Studio](https://boardgamearena.com/doc/First_steps_with_BGA_Studio)

---

## 1. Connect to the BGA Studio website

- Go to **https://studio.boardgamearena.com**
- Log in with your dev account (e.g. `myusername0`; password was in the welcome email).
- No account yet: [How to join BGA developer team?](https://boardgamearena.com/doc/How_to_join_BGA_developer_team%3F)

## 2. Create a new game project

- **Control Panel → Manage games** (or profile icon → Control Panel).
- Create a new project (e.g. name like `tutorialbob`, Board Game Geek ID = 0), then click “Create Project”.
- Refresh the page to see the new project.

Useful links:

- Control panel: https://studio.boardgamearena.com/controlpanel
- Studio projects: https://studio.boardgamearena.com/projects
- Available licenses: https://studio.boardgamearena.com/licensing

## 3. Set up dev environment (IDE, editor, file sync)

You need **automated sync** between your machine and the server (manual FTP is not practical).

- Use the **SFTP** login/password from the Studio email (separate from your dev account).
- You can upload an SSH key in the [control panel](https://studio.boardgamearena.com/controlpanel).
- Connect with an SFTP client or IDE integration; see [Tools and tips – File Sync](https://boardgamearena.com/doc/Tools_and_tips_of_BGA_Studio#File_sync) and [Setting up BGA Development environment using VSCode](https://boardgamearena.com/doc/Setting_up_BGA_Development_environment_using_VSCode).
- Download the remote project folder to a local folder and work from there.
- For read-only access to other games (e.g. Reversi): [Projects](https://studio.boardgamearena.com/projects) → “Already published” → search game → “[Get readonly access]”. The game folder then appears in your SFTP home.

## 4. Run and test your game

1. **Play now** (Studio menu) to open a table.
2. Use **Express start** to start with the max number of players using dev accounts (avoid “Start game” with multiple logins). For Solo mode you may need “Start game” instead.
3. Use **Training mode** when creating the table.
4. To open your game: **Control Panel → Manage games → [your game] → Play**, or: `https://studio.boardgamearena.com/studiogame?game=YOURGAMEID`
5. **Express STOP** (menu) ends the game and returns to the table screen.
6. Red arrow next to a test account switches view to that player.
7. Edit your `.js` (or source), save, refresh the browser to see changes (if sync is set up).

## 5. Commit your changes

- **Control Panel → Manage games → [your game] → Commit my modifications now**
- Add a commit message and submit. Check the log for errors; you should see something like “Committed revision #… / HAL says: done.”
- Note: the first commit may need to be done by an admin. Prefer keeping your own version control (e.g. local Git/GitHub) as well; see [Tools and tips – Version Control](https://boardgamearena.com/doc/Tools_and_tips_of_BGA_Studio#Version_Control).

## Next

- Do a tutorial: [Tutorial reversi](https://boardgamearena.com/doc/Tutorial_reversi) or [Tutorial hearts](https://boardgamearena.com/doc/Tutorial_hearts).
- Full doc index: [Studio](https://boardgamearena.com/doc/Studio) (local: [README](README.md)).
