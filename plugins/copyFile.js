import fs from "node:fs";
import path from "node:path";

/** @type {import("esbuild").Plugin} */
const copyFile = (src, dst) => ({
  name: "webpackImports",
  setup(build) {
    build.onEnd(() => {
      if (fs.existsSync(src)) {
        const dir = path.dirname(dst);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.copyFileSync(src, dst);
      }
    });
  }
});

export default copyFile;
