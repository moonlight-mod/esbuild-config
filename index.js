import * as esbuild from "esbuild";
import fs from "node:fs";
import path from "node:path";

import deduplicatedLogging from "./plugins/deduplicatedLogging.js";
import taggedBuildLog from "./plugins/taggedBuildLog.js";
import wpImport from "./plugins/wpImport.js";
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
const sides = ["index", "webpackModules", "node", "host"];
const fileExts = ["js", "jsx", "ts", "tsx"];

export function makeExtConfig({
  src,
  dst,
  ext,
  side,
  extraExternal = [],
  extraPlugins = [],
  esm = false
}) {
  const entryPoints = [];
  if (side !== "webpackModules") {
    for (const fileExt of fileExts) {
      const filePath = path.join(src, `${side}.${fileExt}`);
      if (fs.existsSync(filePath)) entryPoints.push(filePath);
    }
  }

  const wpModulesDir = path.join(src, "webpackModules");
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
    entryPoints,
    outdir: side === "webpackModules" ? path.join(dst, "webpackModules") : dst,

    format: esm && side === "index" ? "esm" : "iife",
    globalName: "module.exports",
    platform: ["index", "webpackModules"].includes(side) ? "browser" : "node",

    treeShaking: true,
    bundle: true,
    minify: prod,
    sourcemap: "inline",

    external: [...external, ...extraExternal],

    plugins: [
      copyFile(
        path.join(src, "manifest.json"),
        path.join(dst, "manifest.json")
      ),
      copyFile(path.join(src, "style.css"), path.join(dst, "style.css")),
      wpImport,
      deduplicatedLogging,
      taggedBuildLog(`${ext}/${side}`),
      ...extraPlugins
    ]
  };
}

export function makeExtConfigs(cfg) {
  return sides
    .map((side) => makeExtConfig({ ...cfg, side }))
    .filter((cfg) => cfg != null);
}

export async function buildExt(cfg) {
  const cfgs = makeExtConfigs(cfg);
  const builds = [];

  for (const cfg of cfgs) {
    builds.push(await esbuild.build(cfg));
  }

  return builds;
}

export async function watchExt(cfg) {
  const buildCfgs = makeExtConfigs(cfg);
  const watchers = [];

  for (const buildCfg of buildCfgs) {
    const ctx = await esbuild.context(buildCfg);
    await ctx.rebuild();
    const watcher = fs.watch(cfg.src, { recursive: true }, async () => {
      await ctx.rebuild();
    });
    watchers.push(watcher);
  }

  return watchers;
}

export { deduplicatedLogging, taggedBuildLog, wpImport };
