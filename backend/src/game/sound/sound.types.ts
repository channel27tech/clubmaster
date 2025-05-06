export interface PlayerSoundSettings {
  userId: string;
  soundEnabled: boolean;
}

export interface PlayerSoundSettingsWithError extends PlayerSoundSettings {
  error?: string;
} 