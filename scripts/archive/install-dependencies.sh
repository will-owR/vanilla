#!/bin/bash

echo "Installing dependencies for shared/"
cd /workspaces/AetherPressOther/shared/
npm install

echo "Installing dependencies for server/"
cd /workspaces/AetherPressOther/server/
npm install

echo "Installing dependencies for client/"
cd /workspaces/AetherPressOther/client/
npm install

echo "Dependencies installation complete"
