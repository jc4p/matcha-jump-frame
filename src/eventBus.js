import mitt from 'mitt';

export const eventBus = mitt();

export const Events = {
  GAME_START: 'game:start',
  GAME_OVER: 'game:over',
  GAME_PAUSE: 'game:pause',
  GAME_RESUME: 'game:resume',
  
  PLAYER_JUMP: 'player:jump',
  PLAYER_LAND: 'player:land',
  PLAYER_FALL: 'player:fall',
  
  PLATFORM_SPAWN: 'platform:spawn',
  PLATFORM_DESTROY: 'platform:destroy',
  
  POWERUP_SPAWN: 'powerup:spawn',
  POWERUP_COLLECT: 'powerup:collect',
  
  SCORE_UPDATE: 'score:update',
  HIGH_SCORE: 'score:high',
  
  AUDIO_PLAY: 'audio:play',
  AUDIO_STOP: 'audio:stop',
  
  HAPTIC_TRIGGER: 'haptic:trigger',
  
  FRAME_AUTH: 'frame:auth',
  FRAME_READY: 'frame:ready'
};