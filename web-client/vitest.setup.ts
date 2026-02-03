import '@testing-library/jest-dom/vitest';

// ---------------------------------------------------------------------------
// JSDOM stubs
// ---------------------------------------------------------------------------
// JSDOM doesn't implement media playback APIs. Some components (e.g. ClipCard)
// call video.play() on hover.
if (typeof window !== 'undefined' && typeof HTMLMediaElement !== 'undefined') {
	Object.defineProperty(HTMLMediaElement.prototype, 'play', {
		configurable: true,
		value: () => Promise.resolve(),
	});

	Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
		configurable: true,
		value: () => undefined,
	});
}
