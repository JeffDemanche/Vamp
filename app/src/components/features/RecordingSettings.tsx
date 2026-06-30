import { Settings2 } from "lucide-react"

import { useAudioDevices } from "@/audio/AudioEngineProvider"
import { defaultAudioDeviceId } from "@/audio/audioDevices"
import { Button } from "@/components/primitives/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/primitives/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/primitives/select"
import { testIds } from "@/testIds"

/**
 * Popover beside the record button exposing recording-related settings. For now
 * that is input/output device selection wired to the editor's `AudioEngine`.
 */
export function RecordingSettings({
  disabled = false,
}: {
  /** Disable opening while a take is in progress. */
  disabled?: boolean
}) {
  const {
    inputs,
    outputs,
    inputDeviceId,
    outputDeviceId,
    setInputDeviceId,
    setOutputDeviceId,
    outputSelectionSupported,
  } = useAudioDevices()

  const defaultId = defaultAudioDeviceId()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label="Recording settings"
          title="Recording settings"
          disabled={disabled}
          data-testid={testIds.TimelineToolbar.recordingSettingsTrigger}
        >
          <Settings2 aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 space-y-4"
        data-testid={testIds.TimelineToolbar.recordingSettingsContent}
      >
        <div className="space-y-1">
          <h2 className="text-sm font-medium">Recording settings</h2>
          <p className="text-muted-foreground text-xs">
            Choose which devices to capture from and play back through.
          </p>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="recording-input-device"
            className="text-sm font-medium"
          >
            Input device
          </label>
          <Select
            value={inputDeviceId}
            onValueChange={setInputDeviceId}
          >
            <SelectTrigger
              id="recording-input-device"
              data-testid={testIds.TimelineToolbar.recordingInputSelect}
            >
              <SelectValue placeholder="System default" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={defaultId}>System default</SelectItem>
              {inputs.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="recording-output-device"
            className="text-sm font-medium"
          >
            Output device
          </label>
          <Select
            value={outputDeviceId}
            onValueChange={setOutputDeviceId}
            disabled={!outputSelectionSupported}
          >
            <SelectTrigger
              id="recording-output-device"
              data-testid={testIds.TimelineToolbar.recordingOutputSelect}
            >
              <SelectValue
                placeholder={
                  outputSelectionSupported
                    ? "System default"
                    : "Not supported in this browser"
                }
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={defaultId}>System default</SelectItem>
              {outputs.map((device) => (
                <SelectItem key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  )
}
