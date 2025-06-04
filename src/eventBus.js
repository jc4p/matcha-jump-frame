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
  PLAYER_SPRING: 'player:spring',
  
  PLATFORM_SPAWN: 'platform:spawn',
  PLATFORM_DESTROY: 'platform:destroy',
  
  POWERUP_SPAWN: 'powerup:spawn',
  POWERUP_COLLECT: 'powerup:collect',
  POWERUP_ACTIVATE: 'powerup:activate',
  POWERUP_EXPIRE: 'powerup:expire',
  POWERUP_USE: 'powerup:use',
  
  COIN_COLLECTED: 'coin:collected',
  
  COMBO_INCREMENT: 'combo:increment',
  COMBO_BREAK: 'combo:break',
  COMBO_MILESTONE: 'combo:milestone',
  
  SCORE_UPDATE: 'score:update',
  HIGH_SCORE: 'score:high',
  
  AUDIO_PLAY: 'audio:play',
  AUDIO_STOP: 'audio:stop',
  
  HAPTIC_TRIGGER: 'haptic:trigger',
  
  FRAME_AUTH: 'frame:auth',
  FRAME_READY: 'frame:ready'
};