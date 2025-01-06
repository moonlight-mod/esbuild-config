const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hour12: false
});

/** @type {import("esbuild").Plugin} */
const taggedBuildLog = (tag) => ({
  name: "build-log",
  setup(build) {
    build.onEnd(() => {
      console.log(
        `[${timeFormatter.format(new Date())}] [${tag}] build finished`
      );
    });
  }
});

export default taggedBuildLog;
