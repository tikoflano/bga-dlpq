#!/bin/bash

node .devcontainer/generate-sftp-config.js
npm install
npm run watch