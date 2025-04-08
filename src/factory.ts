import fs from "node:fs";
import path from "node:path";
import type { Plugin, BuildResult, BuildOptions } from "esbuild";
import { build, context } from "esbuild";

import betterLogging from "./plugins/betterLogging.js";
import webpackImports from "./plugins/webpackImports.js";
import copyFile from "./plugins/copyFile.js";

const prod = process.env.NODE_ENV === "production";

const external = [
  "electron",
  "fs",
  "path",
  "module",
  "events",
  "original-fs",
  "discord" // mappings
];
const sides = ["index", "webpackModules", "node", "host"] as const;
const fileExts = ["js", "jsx", "ts", "tsx"];

export interface ESBuildFactoryOptions {
  /**
   * The name of your extension.
   * @remarks This is used for logging purposes, and should match the ID in your `manifest.json` file.
   */
  name: string;
  /**
   * The name of your extension.
   * @remarks This is used for logging purposes, and should match the ID in your `manifest.json` file.
   * @deprecated Use {@link name} instead. This will be removed in a major version.
   */
  ext: string;
  /**
   * The input directory containing your extension's source (e.g. `./src`).
   * @remarks If you use moonlight's `create-extension`, this is automatically generated.
   */
  entry: string;
  /**
   * The input directory containing your extension's source (e.g. `./src`).
   * @remarks If you use moonlight's `create-extension`, this is automatically generated.
   * @deprecated Use {@link entry} instead. This will be removed in a major version.
   */
  src: string;
  /**
   * The output directory containing your compiled extension (e.g. `./dist`).
   * @remarks If you use moonlight's `create-extension`, this is automatically generated.
   */
  output: string;
  /**
   * The output directory containing your compiled extension (e.g. `./dist`).
   * @remarks If you use moonlight's `create-extension`, this is automatically generated.
   * @deprecated Use {@link output} instead. This will be removed in a major version.
   */
  dst: string;
  /**
   * A string determining what target to compile your extension to.
   * @remarks In utility functions other than {@link defineConfig}, this is automatically generated.
   */
  side: typeof sides[number];
  /**
   * A list of extra "external" dependencies, (i.e., dependencies that the
   * {@link side}'s runtime already provides and thus doesn't need to be bundled)
   */
  extraExternal?: string[];
  /**
   * A list of extra ESBuild {@link Plugin}s to be applied after the default ones.
   */
  extraPlugins?: Plugin[],
  /**
   * Extra {@link BuildOptions} to append to the finalized ESBuild config.
   * Alternatively, you can destructure {@link defineConfig} and override default options.
   */
  extraConfig?: BuildOptions,
  /**
   * Whether or not to compile the extension's source code to ESM.
   */
  esm?: boolean;
}

export function defineConfig({
  name,
  entry,
  output,
  side,
  extraExternal = [],
  extraPlugins = [],
  extraConfig = {},
  esm = false
}: ESBuildFactoryOptions): BuildOptions | null {
  const entryPoints: Array<{ in: string; out: string } | string> = [];
  if (side !== "webpackModules") {
    for (const fileExt of fileExts) {
      const filePath = path.join(entry, `${side}.${fileExt}`);
      if (fs.existsSync(filePath)) entryPoints.push(filePath);
    }
  }

  const wpModulesDir = path.join(entry, "webpackModules");
  if (side === "webpackModules" && fs.existsSync(wpModulesDir)) {
    const wpModules = fs.readdirSync(wpModulesDir);
    for (const wpModule of wpModules) {
      if (fs.statSync(path.join(wpModulesDir, wpModule)).isDirectory()) {
        for (const fileExt of fileExts) {
          const filePath = path.join(
            wpModulesDir,
            wpModule,
            `index.${fileExt}`
          );
          if (fs.existsSync(filePath))
            entryPoints.push({
              in: filePath,
              out: wpModule
            });
        }
      } else {
        entryPoints.push(path.join(wpModulesDir, wpModule));
      }
    }
  }

  if (entryPoints.length === 0) return null;

  return {
    entryPoints: entryPoints as BuildOptions["entryPoints"],
    outdir: side === "webpackModules" ? path.join(output, "webpackModules") : output,

    format: esm && side === "index" ? "esm" : "iife",
    globalName: "module.exports",
    platform: ["index", "webpackModules"].includes(side) ? "browser" : "node",

    treeShaking: true,
    bundle: true,
    minify: prod,
    sourcemap: "inline",

    external: [...external, ...extraExternal],
    plugins: [
      copyFile(path.join(entry, "manifest.json"), path.join(output, "manifest.json")),
      copyFile(path.join(entry, "style.css"), path.join(output, "style.css")),
      webpackImports,
      betterLogging(`${name}/${side}`),
      ...extraPlugins
    ],

    ...extraConfig
  };
}

export function defineConfigs(options: Omit<ESBuildFactoryOptions, "side">): BuildOptions[] {
  return sides
    .map((side) => defineConfig({ ...options, side }))
    .filter((config) => config != null);
}

export async function buildExtension(options: Omit<ESBuildFactoryOptions, "side">): Promise<BuildResult[]> {
  const configs = defineConfigs(options);
  const builds: BuildResult[] = [];
  configs.forEach(async config => builds.push(await build(config)))

  return builds;
}

export async function watchExtension(options: Omit<ESBuildFactoryOptions, "side">) {
  const buildConfigs = defineConfigs(options);
  const watchers = [];

  for (const config of buildConfigs) {
    const ctx = await context(config);
    async function rebuild() {
      try {
        await ctx.rebuild();
      } catch {
        // esbuild will log errors, we just need to not do anything
      }
    }

    await rebuild();
    const watcher = fs.watch(options.entry, { recursive: true }, async () => await rebuild());
    watchers.push(watcher);
  }

  return watchers;
}

// Backwards Compatibility
export {
  defineConfig as makeExtConfig,
  defineConfigs as makeExtConfigs,
  buildExtension as buildExt,
  watchExtension as watchExt,
  betterLogging as deduplicatedLogging,
  webpackImports as wpImport,
};
