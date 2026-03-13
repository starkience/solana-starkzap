// Make Metro's require available globally for polyfills that expect it
if (typeof globalThis !== 'undefined' && globalThis.__r && typeof globalThis.require === 'undefined') {
  globalThis.require = globalThis.__r;
}
if (typeof global !== 'undefined' && global.__r && typeof global.require === 'undefined') {
  global.require = global.__r;
}
