import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "util";

// jsdom does not provide TextEncoder/TextDecoder, which react-router v7 relies
// on at import time. Polyfill them from Node's `util` before tests run.
const globalWithEncoders = globalThis as typeof globalThis & {
  TextEncoder?: typeof TextEncoder;
  TextDecoder?: typeof TextDecoder;
};
globalWithEncoders.TextEncoder ??= TextEncoder;
globalWithEncoders.TextDecoder ??= TextDecoder as typeof globalWithEncoders.TextDecoder;
