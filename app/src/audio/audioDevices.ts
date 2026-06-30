/** A browser-reported audio input or output device. */
export type AudioDevice = {
  deviceId: string;
  label: string;
};

const DEFAULT_DEVICE_ID = "default";

/** Sentinel value for the system default input/output device. */
export function defaultAudioDeviceId(): string {
  return DEFAULT_DEVICE_ID;
}

/** User-facing label for a device, with a stable fallback when labels are hidden. */
export function audioDeviceLabel(
  device: MediaDeviceInfo,
  index: number,
  kind: "input" | "output",
): string {
  if (device.label.trim()) return device.label;
  const noun = kind === "input" ? "Microphone" : "Speaker";
  return `${noun} ${index + 1}`;
}

/** Lists audio inputs and outputs from `enumerateDevices`. */
export async function enumerateAudioDevices(): Promise<{
  inputs: AudioDevice[];
  outputs: AudioDevice[];
}> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return { inputs: [], outputs: [] };
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs: AudioDevice[] = [];
  const outputs: AudioDevice[] = [];
  for (const device of devices) {
    if (device.kind === "audioinput") {
      if (!device.deviceId) continue;
      inputs.push({
        deviceId: device.deviceId,
        label: audioDeviceLabel(device, inputs.length, "input"),
      });
    } else if (device.kind === "audiooutput") {
      if (!device.deviceId) continue;
      outputs.push({
        deviceId: device.deviceId,
        label: audioDeviceLabel(device, outputs.length, "output"),
      });
    }
  }
  return { inputs, outputs };
}

type AudioContextWithSinkId = AudioContext & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

/** Whether the browser can route `AudioContext` playback to a chosen output device. */
export function audioOutputSelectionSupported(): boolean {
  return typeof (AudioContext.prototype as AudioContextWithSinkId).setSinkId ===
    "function";
}

export async function applyAudioOutputDevice(
  context: AudioContext,
  deviceId: string | null,
): Promise<void> {
  const setSinkId = (context as AudioContextWithSinkId).setSinkId;
  if (!setSinkId) return;
  try {
    await setSinkId.call(context, deviceId ?? "");
  } catch (err) {
    console.warn("Failed to set audio output device", err);
  }
}
