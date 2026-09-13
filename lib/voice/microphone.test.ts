import { afterEach, expect, test, vi } from 'vitest';
import { MicrophoneCapture } from './voiceAudio';
afterEach(() => vi.unstubAllGlobals());
test('hanging up while audio resume is pending releases the late microphone', async () => {
  let resume!: () => void;
  let resumeStarted = false;
  const stop = vi.fn();
  const close = vi.fn(async () => undefined);
  const disconnect = vi.fn();
  vi.stubGlobal('navigator', {
    mediaDevices: {
      getUserMedia: async () => ({ getTracks: () => [{ stop }] }),
    },
  });
  vi.stubGlobal(
    'AudioContext',
    class {
      state = 'running';
      sampleRate = 48000;
      destination = {};
      audioWorklet = { addModule: async () => {} };
      createMediaStreamSource() {
        return { connect: vi.fn(), disconnect };
      }
      resume() {
        resumeStarted = true;
        return new Promise<void>((r) => {
          resume = r;
        });
      }
      close = close;
    },
  );
  vi.stubGlobal(
    'AudioWorkletNode',
    class {
      port = { onmessage: null };
      connect = vi.fn();
      disconnect = disconnect;
    },
  );
  const mic = new MicrophoneCapture();
  const start = mic.start(() => {});
  await vi.waitFor(() => expect(resumeStarted).toBe(true));
  await mic.stop();
  resume();
  await start;
  expect(stop).toHaveBeenCalled();
  expect(close).toHaveBeenCalled();
  expect(disconnect).toHaveBeenCalled();
});
