// Define sound effect paths
const SOUND_EFFECTS = {
  MOVE: '/sounds/move.mp3',
  CAPTURE: '/sounds/capture.mp3',
  CHECK: '/sounds/check.mp3',
  CHECKMATE: '/sounds/checkmate.mp3',
  DRAW: '/sounds/draw.mp3',
  GAME_START: '/sounds/game-start.mp3',
  GAME_END: '/sounds/game-end.mp3',
  BUTTON_CLICK: '/sounds/button-click.mp3',
  TIME_LOW: '/sounds/time-low.mp3',
  NOTIFICATION: '/sounds/notification.mp3',
};

// List of UI elements that should play sounds
// Only sound toggle buttons should play sounds
const SOUND_ENABLED_BUTTONS = ['Enable Sound', 'Disable Sound'];

// Store load success status to avoid repeated failed loads
const loadSuccessStatus: { [key: string]: boolean } = {};

// Cache for audio elements
const audioCache: { [key: string]: HTMLAudioElement } = {};

// Track sound availability to avoid repeated errors
const soundAvailabilityCheck = async (soundPath: string): Promise<boolean> => {
  // If we've already checked this sound, return the cached result
  if (loadSuccessStatus[soundPath] !== undefined) {
    return loadSuccessStatus[soundPath];
  }
  
  // Don't check on server side
  if (typeof window === 'undefined') return false;

  try {
    // Check if the sound file exists and is valid
    const response = await fetch(soundPath, {
      method: 'HEAD',
      cache: 'no-cache',
    });
    
    // Check response status and content length
    const isValid = response.ok && 
                    (response.headers.get('Content-Length') !== '0');
    
    // Cache the result
    loadSuccessStatus[soundPath] = isValid;
    return isValid;
  } catch (error) {
    console.warn(`Sound file check failed for ${soundPath}:`, error);
    loadSuccessStatus[soundPath] = false;
    return false;
  }
};

/**
 * Play a sound effect if sound is enabled
 * @param soundName The name of the sound to play
 * @param isSoundEnabled Whether sound is enabled
 * @param volume The volume (0.0 to 1.0)
 * @param buttonLabel Optional - for UI elements, provide the button label to check if sound should be allowed
 */
export const playSound = (
  soundName: keyof typeof SOUND_EFFECTS, 
  isSoundEnabled: boolean = true, 
  volume: number = 1.0,
  buttonLabel?: string
): void => {
  // Don't play if sound is disabled
  if (!isSoundEnabled) return;
  
  // Don't play on server-side
  if (typeof window === 'undefined') return;
  
  // If a button label is provided, check if it's in the allowed list
  if (buttonLabel && !SOUND_ENABLED_BUTTONS.some(allowedLabel => 
    buttonLabel.includes(allowedLabel) || allowedLabel.includes(buttonLabel)
  )) {
    return; // Skip sounds for buttons not in the allowed list
  }
  
  // Use specific sounds for Enable vs Disable
  if (buttonLabel) {
    if (buttonLabel.includes('Enable Sound')) {
      // Higher pitched "on" sound for enabling
      generateClickSound(volume, 1000); // Higher frequency for enable sound
      return;
    } else if (buttonLabel.includes('Disable Sound')) {
      // Lower pitched "off" sound for disabling
      generateClickSound(volume, 600); // Lower frequency for disable sound 
      return;
    }
  }
  
  // For other buttons, use the default sound generation
  try {
    generateClickSound(volume);
    return; // If successful, we're done
  } catch (error) {
    console.warn("Failed to generate click sound:", error);
    // Continue to try the file-based approach as fallback
  }
  
  try {
    const soundPath = SOUND_EFFECTS[soundName];
    
    // Skip sounds that failed to load
    if (loadSuccessStatus[soundPath] === false) {
      return;
    }
    
    // Create or get from cache
    if (!audioCache[soundPath]) {
      // Create audio element
      audioCache[soundPath] = new Audio(soundPath);
      
      // Add error handler
      audioCache[soundPath].addEventListener('error', (e) => {
        console.warn(`Failed to load sound ${soundName}:`, e);
        loadSuccessStatus[soundPath] = false;
        
        // Remove from cache to save memory
        delete audioCache[soundPath];
      });
      
      // Add success handler
      audioCache[soundPath].addEventListener('canplaythrough', () => {
        loadSuccessStatus[soundPath] = true;
      });
    }
    
    const audio = audioCache[soundPath];
    
    // Set volume
    audio.volume = Math.min(1.0, Math.max(0.0, volume));
    
    // Reset to beginning if already playing
    audio.currentTime = 0;
    
    // Play the sound with error handling
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(error => {
        // Silently fail - we don't need to log this as it's already handled
        // This prevents filling the console with errors
        loadSuccessStatus[soundPath] = false;
      });
    }
  } catch (error) {
    // Silently fail - no need to log this as we've already tried the direct approach
  }
};

/**
 * Generate a click sound directly using AudioContext 
 * This avoids file loading issues completely
 * @param volume Volume level (0.0 to 1.0)
 * @param frequency Tone frequency in Hz (default: 800)
 */
const generateClickSound = (volume: number = 1.0, frequency: number = 800): void => {
  // Create a new Audio Context for direct sound generation
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) {
    throw new Error('AudioContext not supported');
  }
  
  const audioContext = new AudioContext();
  
  // Create a short "click" oscillator sound
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  
  gainNode.gain.setValueAtTime(volume * 0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.1);
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.1);
};

/**
 * Preload all sound effects for better performance
 * @param isSoundEnabled Whether sound is enabled
 */
export const preloadSoundEffects = (isSoundEnabled: boolean = true): void => {
  // Skip preloading if sound is disabled or running server-side
  if (!isSoundEnabled || typeof window === 'undefined') return;
  
  try {
    // Check if audio context is supported
    if (typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined') {
      console.log('WebAudio is supported, proceeding with preload');
      
      // We'll use direct audio generation instead of file loading
      // So no need to preload anything
    } else {
      console.warn('WebAudio not supported in this browser');
    }
  } catch (error) {
    console.error('Error preloading sound effects:', error);
  }
}; 