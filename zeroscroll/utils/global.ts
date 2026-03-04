import { Buffer } from "buffer";

// Polyfill for Buffer in React Native, required by some libraries (e.g., crypto)   
global.Buffer = global.Buffer || Buffer;