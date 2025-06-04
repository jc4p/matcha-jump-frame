# Matcha Jump - Development Plan

## 🎮 Current State (December 2024)

### ✅ What We've Built So Far

#### Core Game Architecture
- **Event-driven system** using `mitt` for decoupled communication between game components
- **Game Engine** (`GameEngine.js`) - Handles game loop with deltaTime capping, rendering pipeline
- **Camera System** (`Camera.js`) - Implements upward-scrolling viewport that follows the player
- **Asset Loader** (`AssetLoader.js`) - Preloads all game images with progress tracking
- **Farcaster Frame Integration** - Set up with proper meta tags, SDK initialization, and haptic feedback

#### Game Entities
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

3. **Collectibles** (`Coin.js`)
   - Animated coins with rotation and floating motion
   - Magnetic attraction when player is near
   - Collection particles on pickup
   - Score rewards with combo multipliers

4. **Power-ups** (`PowerUp.js`, `PowerUpManager.js`)
   - **Five types implemented:**
     - **Rocket** - Continuous upward boost (3 seconds)
     - **Shield** - One-time fall protection
     - **Magnet** - Attracts coins from greater distance (5 seconds)
     - **Score Boost** - 2x score multiplier (10 seconds)
     - **Slow Time** - Time dilation effect (visual only, mechanics not implemented)
   - Visual indicators for active power-ups
   - Duration timers and proper cleanup

#### Game Systems

1. **Combo System** (`ComboManager.js`)
   - Tracks consecutive perfect landings on platforms
   - Combo multipliers affect scoring (1x, 1.5x, 2x, 3x)
   - Milestone bonuses at 5, 10, 20+ combos
   - Visual feedback with particles for milestones
   - Combo breaks on missed platforms

2. **Audio System** (`AudioManager.js`, `GameSynth.js`)
   - **Sophisticated synthesizer-based sound effects using Tone.js:**
     - Jump sounds with pitch variation based on velocity
     - Landing thuds with low-frequency impact
     - Coin collection jingles
     - Spring bounce with characteristic "boing"
     - Platform break sounds
     - Power-up collection fanfares
     - Game over sequence
     - Ambient background chords
   - Web Audio API for better mobile performance
   - Automatic audio context resume on user interaction

3. **Particle System** (`ParticleManager.js`, `Particle.js`)
   - Jump dust particles
   - Landing impact particles
   - Platform break particles (red debris)
   - Coin collection sparkles (yellow)
   - Rocket boost trails (orange/red)
   - Shield break effects (blue)
   - Combo milestone celebrations (rainbow colors)
   - Performance-optimized with automatic cleanup

#### Game States & UI
- **Menu** - Shows game title and tap to start
- **Playing** - Active gameplay with score tracking
- **Game Over** - Shows final score and high score
- **Score persistence** using localStorage
- **Mobile-optimized UI** with fading touch instructions

#### Mobile & Frame Features
- Touch controls with subtle text hint that fades after 3 seconds
- Prevented zoom and scroll on mobile devices
- Haptic feedback integration:
  - Light haptic on normal platform landing
  - Heavy haptic on spring platform and game over
- Responsive canvas sizing with proper DPI scaling
- Frame V2 ready state signaling

## 📋 What Still Needs to Be Done

### 1. Visual Enhancements 🎨
- [ ] **Background System**
  - Parallax layers with clouds
  - Different themes at different heights (Sky → Clouds → Space)
  - Enhanced gradient backgrounds
  - Atmospheric effects

- [ ] **Screen Effects**
  - Screen shake on heavy impacts
  - Smooth transitions between game states
  - Visual feedback for height milestones

### 2. Game Features 🎯
- [ ] **Difficulty Progression**
  - Platforms spawn further apart as you go higher
  - More moving/breakable platforms at higher scores
  - Wind effects at extreme heights
  - Speed increases with altitude

- [ ] **Enemy/Obstacle System**
  - Birds that knock you sideways
  - Black holes that pull you
  - Spikes on some platforms
  - Moving hazards to avoid

- [ ] **Additional Platform Types**
  - Disappearing platforms (fade after X seconds)
  - Conveyor platforms (move player left/right)
  - Sticky platforms (slow jump charge)
  - Teleport platforms (warp to other side)

### 3. Power-up Improvements 💪
- [ ] **Additional Power-ups**
  - Double Jump - Jump again in mid-air
  - Size Change - Become tiny or giant temporarily

- [ ] **Slow Time Mechanics**
  - Actually implement time dilation for gameplay
  - Slow down platform movement and enemy speeds

### 4. Farcaster Social Features 🌐
- [ ] **Leaderboard Integration**
  - Submit scores to global leaderboard
  - Show friend's high scores
  - Weekly/daily leaderboards

- [ ] **Social Features**
  - Share score as a cast with game thumbnail
  - Challenge friends directly
  - Multiplayer ghost mode (see friend's best run)

- [ ] **Frame-Specific Features**
  - Quick Auth implementation for user profiles
  - NFT rewards for achievements
  - Frame-specific power-ups
  - Achievement badges

### 5. Meta Features 🏆
- [ ] **Achievement System**
  - Height milestones
  - Combo achievements
  - Power-up mastery
  - Collectible challenges

- [ ] **Daily Challenges**
  - Specific goals each day
  - Bonus rewards
  - Streak tracking

- [ ] **Tutorial Mode**
  - Interactive tutorial for first-time players
  - Power-up explanations
  - Advanced technique demonstrations

### 6. Performance & Polish 🚀
- [ ] **Optimization**
  - Object pooling for platforms and particles
  - Frustum culling for off-screen objects
  - Batch rendering optimizations
  - Memory management improvements

- [ ] **Code Quality**
  - TypeScript migration
  - Constants file for game tuning
  - Comprehensive error handling
  - Unit tests for critical systems

## 🎯 Priority Roadmap

### Phase 1: Polish Current Features (1 week)
- [x] ~~Add local high score storage~~ ✅
- [x] ~~Implement particle effects~~ ✅
- [x] ~~Add coin collectibles~~ ✅
- [x] ~~Create audio system~~ ✅
- [x] ~~Implement power-ups~~ ✅
- [x] ~~Add combo system~~ ✅
- [ ] Fix slow time power-up mechanics
- [ ] Add difficulty progression

### Phase 2: Visual Enhancement (2 weeks)
- [ ] Implement parallax backgrounds
- [ ] Add themed zones (sky, clouds, space)
- [ ] Create screen shake effects
- [ ] Polish UI transitions

### Phase 3: Social Integration (2 weeks)
- [ ] Farcaster leaderboard integration
- [ ] Score sharing functionality
- [ ] Friend challenges
- [ ] Achievement system

### Phase 4: Advanced Features (1 month)
- [ ] Enemy/obstacle system
- [ ] Additional platform types
- [ ] Daily challenges
- [ ] Ghost mode multiplayer
- [ ] NFT rewards

## 📊 Current Progress Summary

**Core Gameplay: 90% Complete** ✅
- All basic mechanics implemented
- Four platform types working
- Player controls polished
- Basic game loop complete

**Collectibles & Rewards: 85% Complete** ✅
- Coins fully implemented
- Power-ups working (except time mechanics)
- Combo system active
- Score persistence done

**Audio/Visual: 70% Complete** 🔄
- Full audio system implemented
- Particle effects working
- Needs: backgrounds, themes, screen effects

**Social Features: 10% Complete** 📱
- Frame integration started
- Needs: leaderboards, sharing, multiplayer

**Meta Features: 5% Complete** 🎮
- Basic scoring done
- Needs: achievements, challenges, progression

## 🎮 Game Feel Assessment

The game has excellent "juice" with Disney-quality animations. Player movement feels responsive and alive with squash/stretch effects. The audio system adds satisfying feedback for every action. The combo system rewards skilled play, while power-ups add variety and excitement. Mobile controls are intuitive with haptic feedback enhancing the experience.

**What's Working Well:**
- Tight, responsive controls
- Satisfying audio-visual feedback
- Good variety in platform types
- Engaging combo system
- Smooth performance

**Areas for Improvement:**
- Visual variety (backgrounds, themes)
- Long-term progression hooks
- Social competition elements
- Difficulty curve refinement