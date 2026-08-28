import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';

/**
 * Tiny wrapper around expo-audio for short notification chimes.
 * One AudioPlayer per asset is created lazily and reused — creating a new
 * player for every event leaks memory and adds latency.
 *
 * Unlike the driver app, the manager chime RESPECTS the iOS silent switch
 * (`playsInSilentMode: false`) — a manager who flips their phone to silent
 * expects it to stay quiet. Users can also turn the chime off entirely from
 * Settings (the Sound toggle). We set the audio mode once on first use.
 */
const players: Record<string, AudioPlayer | null> = {};
let audioModeReady: Promise<void> | null = null;

function ensureAudioMode(): Promise<void> {
  if (audioModeReady) return audioModeReady;
  audioModeReady = setAudioModeAsync({
    // Honour the iOS ring/silent switch — no chime when the phone is silenced.
    playsInSilentMode: false,
    // Don't fight other apps' audio — chime over them briefly, then yield.
    interruptionMode: 'mixWithOthers',
  }).catch((e) => {
    console.warn('[sound] setAudioModeAsync failed', e);
  });
  return audioModeReady;
}

function getPlayer(key: 'message' | 'alarm'): AudioPlayer | null {
  if (players[key]) return players[key];
  try {
    const asset =
      key === 'message'
        ? require('../assets/sounds/is_message.mp3')
        : require('../assets/sounds/is_alarm.mp3');
    players[key] = createAudioPlayer(asset);
    return players[key];
  } catch (e) {
    console.warn(`[sound] failed to create ${key} player`, e);
    return null;
  }
}

function play(key: 'message' | 'alarm') {
  // Set audio mode once (resolves async); on cold first call the chime
  // might land before the mode is applied — acceptable for a one-frame race.
  void ensureAudioMode();
  try {
    const p = getPlayer(key);
    if (!p) return;
    p.seekTo(0);
    p.play();
  } catch (e) {
    // expo-audio may not be available in Expo Go on some platforms — fail silently.
    console.warn(`[sound] play ${key} failed`, e);
  }
}

/** Chat-message chime. Restarts if already playing. */
export function playMessageSound() {
  play('message');
}

/** Alarm / reminder chime — louder, used by PushNoticeOverlay on ALARM push. */
export function playAlarmSound() {
  play('alarm');
}
