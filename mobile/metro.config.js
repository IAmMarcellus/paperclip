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

// @paperclipai/shared is consumed as TS source but its internal imports use ESM
// `.js` specifiers (e.g. `export ... from "./adapter-type.js"`). Metro won't map
// `.js` → `.ts`, so when we import a *runtime* value from shared (not just
// types) resolution fails. Rewrite `.js` → extensionless for relative imports
// originating inside packages/shared so Metro finds the `.ts` sibling.
const sharedSrc = path.resolve(workspaceRoot, "packages/shared/src");
const upstreamResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName.startsWith(".") &&
    moduleName.endsWith(".js") &&
    typeof context.originModulePath === "string" &&
    context.originModulePath.startsWith(sharedSrc)
  ) {
    try {
      return context.resolveRequest(context, moduleName.replace(/\.js$/, ""), platform);
    } catch {
      // fall through to default resolution
    }
  }
  return (upstreamResolve ?? context.resolveRequest)(context, moduleName, platform);
};

// IMPORTANT: keep hierarchical lookup ENABLED for pnpm. pnpm stores each
// package's deps as siblings in its `.pnpm` dir, found by walking up the tree —
// disabling it (the yarn/npm hoisted-monorepo trick) breaks transitive
// resolution (e.g. whatwg-fetch inside @expo/metro-runtime). Symlink support is
// on by default in SDK 56's Metro.

module.exports = config;
