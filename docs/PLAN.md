# Matcha Jump - Development Plan

## What We've Built So Far

### Core Game Architecture
- **Event-driven system** using `mitt` for decoupled communication between game components
- **Game Engine** (`GameEngine.js`) - Handles game loop with deltaTime capping, rendering pipeline
- **Camera System** (`Camera.js`) - Implements upward-scrolling viewport that follows the player
- **Farcaster Frame Integration** - Set up with proper meta tags, SDK initialization, and haptic feedback

### Game Entities
1. **Player** (`Player.js`)
   - Physics-based movement with gravity (800 units/s²) and jump mechanics
   - Velocity capped at 600 units/s for fall speed
   - Jump power of -500 units/s (normal) and -800 units/s (spring platforms)
   - **Advanced Animation System:**
     - Dramatic squash (1.5x wide, 0.5x tall) and stretch (0.7x wide, 1.4x tall)
     - Super jump has even more dramatic stretch (0.6x wide, 1.6x tall)
     - Rotation based on horizontal movement
     - Landing recovery with overshoot animation
     - Smooth easing functions for natural movement
   - Mobile controls: Touch left/right halves of screen
   - Desktop controls: Arrow keys
   - Automatic edge wrapping when moving off-screen

2. **Platforms** (`Platform.js`)
   - **Four types fully implemented:**
     - Normal (green) - Standard platform using `plate_rectangle_1.png`
     - Moving (blue) - Moves horizontally using `plate_rectangle_2.png`
     - Breakable (red) - Disappears after one bounce using `plate_rectangle_3.png`
     - Spring (yellow) - Super jump with bounce animation using `plate_circle.png`
   - Spring platforms animate when used (scale bounce effect)
   - Spawn rates: 10% moving, 5% breakable, 3% spring

### Game States
- **Menu** - Shows game title and tap to start
- **Playing** - Active gameplay with score tracking and minimal UI
- **Game Over** - Shows final score and high score

### Mobile Optimizations
- Touch controls with subtle text hint that fades after 3 seconds
- Prevented zoom and scroll on mobile devices
- Haptic feedback integration:
  - Light haptic on normal platform landing
  - Heavy haptic on spring platform and game over
- Responsive canvas sizing with proper DPI scaling

### Visual Polish Implemented
- **Disney Animation Principles:**
  - Squash and stretch on jump/land
  - Follow-through with landing recovery
  - Secondary action with rotation
  - Anticipation system (built but not used in automatic jumping)
  - Exaggeration in animation values
- Shadow effect when jumping upward
- Spring platform bounce animation
- Clean, minimal UI with fading instructions

## What Needs to Be Done

### 1. Power-up System
- [ ] Design power-up architecture using event system
- [ ] Implement power-ups:
  - **Rocket/Jetpack** - Shoot up rapidly for X seconds
  - **Shield/Bubble** - One free fall protection
  - **Magnet** - Auto-collect nearby items
  - **Double Jump** - Jump again in mid-air
  - **Slow Motion** - Temporary time dilation
  - **Size Change** - Become tiny or giant temporarily
- [ ] Power-up spawn logic and rarity system
- [ ] Visual indicators for active power-ups
- [ ] Power-up duration timers

### 2. Scoring & Persistence
- [ ] Implement score multipliers
- [ ] Add combo system for consecutive perfect landings
- [ ] Store high scores in localStorage
- [ ] Add coin/collectible system for points
- [ ] Farcaster Frame integration:
  - Submit scores to leaderboard
  - Show friend's high scores
  - Achievement system

### 3. Audio System
- [ ] Create audio manager that listens to events
- [ ] Sound effects:
  - Jump sound (different for each platform type)
  - Landing sound with pitch variation
  - Spring bounce sound
  - Power-up collection
  - Background music (adaptive to height/speed)
  - Game over sound
  - Menu music
- [ ] Use Web Audio API for better mobile performance
- [ ] Volume controls

### 4. Enhanced Visual Effects
- [ ] Background parallax layers
- [ ] Clouds that move at different speeds
- [ ] Particle effects:
  - Jump dust clouds
  - Platform break particles
  - Power-up sparkles
  - Trail effects for fast movement
- [ ] Screen shake on heavy impacts
- [ ] Smooth transitions between game states
- [ ] Better background gradient based on height

### 5. Game Features
- [ ] Difficulty progression:
  - Platforms spawn further apart as you go higher
  - More moving/breakable platforms at higher scores
  - Wind effects at extreme heights
- [ ] Enemy/obstacle system:
  - Birds that knock you sideways
  - Black holes that pull you
  - Spikes on some platforms
- [ ] Different themes/worlds as you progress:
  - Sky theme (0-1000)
  - Cloud theme (1000-5000)
  - Space theme (5000+)
- [ ] Daily challenges with specific goals
- [ ] Tutorial mode for first-time players

### 6. Platform Improvements
- [ ] More platform types:
  - Disappearing platforms (fade after X seconds)
  - Conveyor platforms (move player left/right)
  - Sticky platforms (slow jump charge)
  - Teleport platforms (warp to other side)
- [ ] Platform patterns/formations
- [ ] Boss platforms at milestones

### 7. Farcaster Frame Features
- [ ] Quick auth integration for user profiles
- [ ] Share score as a cast with game thumbnail
- [ ] Multiplayer ghost mode (see friend's best run)
- [ ] NFT rewards for achievements
- [ ] Frame-specific power-ups that use blockchain
- [ ] Leaderboard with weekly resets
- [ ] Social features (challenge friends)

## Technical Improvements Needed

1. **Performance**
   - [ ] Object pooling for platforms and particles
   - [ ] Optimize rendering (frustum culling)
   - [ ] Reduce garbage collection with object reuse
   - [ ] Batch draw calls

2. **Code Organization**
   - [ ] Create managers:
     - AudioManager
     - PowerUpManager
     - ParticleManager
     - ScoreManager
   - [ ] Implement proper state machine for game states
   - [ ] Add TypeScript for better type safety
   - [ ] Create constants file for game tuning

3. **Testing & Polish**
   - [ ] Add collision detection improvements
   - [ ] Test on various mobile devices and frames
   - [ ] Performance profiling
   - [ ] Accessibility features
   - [ ] Save system for progress

## Event Bus Events to Add
```javascript
// Power-ups
POWERUP_SPAWN: 'powerup:spawn'
POWERUP_ACTIVATE: 'powerup:activate'
POWERUP_EXPIRE: 'powerup:expire'

// Combos & Scoring
COMBO_START: 'combo:start'
COMBO_INCREMENT: 'combo:increment'
COMBO_BREAK: 'combo:break'
SCORE_MILESTONE: 'score:milestone'

// Effects
PARTICLE_SPAWN: 'particle:spawn'
SCREEN_SHAKE: 'effect:screenShake'
TIME_SLOW: 'effect:timeSlow'

// UI
UI_SHOW_MESSAGE: 'ui:showMessage'
UI_UPDATE_MULTIPLIER: 'ui:updateMultiplier'

// Achievements
ACHIEVEMENT_UNLOCK: 'achievement:unlock'
ACHIEVEMENT_PROGRESS: 'achievement:progress'

// Social
LEADERBOARD_UPDATE: 'social:leaderboardUpdate'
GHOST_DATA: 'social:ghostData'
```

## Next Steps Priority
1. **Immediate** (This Week):
   - [ ] Add local high score storage
   - [ ] Implement basic particle effects for jumps
   - [ ] Add coin collectibles for extra points
   - [ ] Create AudioManager with basic sounds

2. **Short Term** (Next 2 Weeks):
   - [ ] Implement 2-3 power-ups (rocket, shield, magnet)
   - [ ] Add combo system
   - [ ] Background parallax layers
   - [ ] Farcaster leaderboard integration

3. **Medium Term** (Month):
   - [ ] Full audio implementation
   - [ ] All power-ups complete
   - [ ] Enemy/obstacle system
   - [ ] Achievement system
   - [ ] Social features

4. **Long Term**:
   - [ ] Multiple themes/worlds
   - [ ] Daily challenges
   - [ ] Multiplayer ghost mode
   - [ ] NFT integration

## Current Game Feel
The game now has excellent "juice" with Disney-quality animations. The player feels responsive and alive with squash/stretch, rotation, and bounce effects. Platform variety keeps gameplay interesting, and the spring platforms provide exciting moments. Mobile controls are intuitive with clean visual design.