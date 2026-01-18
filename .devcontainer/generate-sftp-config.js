const fs = require("fs");

const projectName = (process.env.BGA_PROJECT_NAME || "MyGame").toLowerCase();

const config = {
  name: `BGA - ${projectName}`,
  host: "1.studio.boardgamearena.com",
  protocol: "sftp",
  port: 2022,
  username: process.env.BGA_USERNAME || "",
  privateKeyPath: process.env.BGA_PRIVATE_KEY_PATH || "",
  remotePath: `/${projectName}`,
  useTempFile: false,
  openSsh: false,
  uploadOnSave: true,
  ignore: [".vscode", ".devcontainer", "node_modules", ".git", ".DS_Store", ".cursorrules", ".cursor"],
  syncOption: {
    skipCreate: false,
    delete: true,
  },
  watcher: {
    files: `{img/**,gameinfos.inc.php,game*.json,stats.json,dbmodel.sql,${projectName}.css,modules/js/Game.js,modules/php/**}`,
    autoUpload: true,
    autoDelete: true,
  },
};

fs.writeFileSync(".vscode/sftp.json", JSON.stringify(config, null, 2));
