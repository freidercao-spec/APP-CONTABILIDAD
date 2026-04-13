// Defensive shims for Node.js modules in the browser
export const spawn = () => ({ on: () => {}, stdout: { on: () => {} }, stderr: { on: () => {} } });
export const exec = () => {};
export const writeFile = () => {};
export const readFile = () => {};
export const resolve = () => "";
export const join = () => "";
export const dirname = () => "";

export default {
  spawn,
  exec,
  writeFile,
  readFile,
  resolve,
  join,
  dirname
};
