// Add any global test setup here

// Minimal Element.animate polyfill for JSDOM compatibility
if (typeof Element !== "undefined" && !Element.prototype.animate) {
  Element.prototype.animate = function (keyframes, options = {}) {
    // Return a no-op Animation object that satisfies the interface
    return {
      finished: Promise.resolve(),
      ready: Promise.resolve(),
      cancel: () => {},
      pause: () => {},
      play: () => {},
      reverse: () => {},
      finish: () => {},
      currentTime: 0,
      playbackRate: 1,
      playState: "finished",
    };
  };
}
