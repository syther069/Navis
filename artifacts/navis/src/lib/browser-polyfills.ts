// Solana dependencies use both imported Buffer and the Node-style global.
// Supply the real browser implementation before evaluating the wallet modules.
import { Buffer } from "buffer";

if (typeof globalThis.Buffer === "undefined") {
  Object.assign(globalThis, { Buffer });
}