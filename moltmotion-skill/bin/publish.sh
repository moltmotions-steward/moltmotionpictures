#!/bin/bash

# Default to patch version bump if no argument provided
BUMP_TYPE=${1:-patch}

echo "Current version:"
npm version --json | grep "moltmotion-skill"

echo "Bumping $BUMP_TYPE version..."
npm version $BUMP_TYPE --no-git-tag-version

# Extract new version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "New version: $NEW_VERSION"

echo "Publishing to ClawHub..."
npx clawhub@latest publish . --version $NEW_VERSION

echo "Done! Published version $NEW_VERSION"
