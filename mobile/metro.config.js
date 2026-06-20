// Metro config tuned for the Paperclip pnpm monorepo.
//
// The app lives at vendor/paperclip/mobile and consumes @paperclipai/shared
// (TS source, resolved via the package "exports" map). Metro must watch the
// workspace root and honor pnpm's symlinked node_modules.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "..");

const config = getDefaultConfig(projectRoot);

// Watch the whole Paperclip workspace so changes to @paperclipai/shared reload.
config.watchFolders = [workspaceRoot];

// Resolve modules from the app first, then the workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Honor the "exports" field so `@paperclipai/shared` resolves to ./src/index.ts.
config.resolver.unstable_enablePackageExports = true;

// IMPORTANT: keep hierarchical lookup ENABLED for pnpm. pnpm stores each
// package's deps as siblings in its `.pnpm` dir, found by walking up the tree —
// disabling it (the yarn/npm hoisted-monorepo trick) breaks transitive
// resolution (e.g. whatwg-fetch inside @expo/metro-runtime). Symlink support is
// on by default in SDK 56's Metro.

module.exports = config;
