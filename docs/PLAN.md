# Matcha Jump - Development Plan

## 🎮 Current State (January 2025)

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
   - **NEW: Player height increased by 20% for better visibility**

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
     - **Shield** - One-time fall protection (threshold adjusted for better gameplay)
     - **Magnet** - Attracts coins from greater distance (5 seconds)
     - **Score Boost** - 2x score multiplier (10 seconds)
     - **Slow Time** - Time dilation effect (visual only, mechanics not implemented)
   - **NEW: Power-up selection menu system**
     - Players select power-ups before starting the game
     - Manual activation during gameplay with spacebar/tap
     - Visual inventory display showing available power-ups
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
  - **NEW: Animated bouncing player on landing page**
  - **NEW: Google Fonts integration for better typography**
  - **NEW: Prettier, more polished button designs**
- **Playing** - Active gameplay with score tracking
  - **NEW: Separate height score from bonus score display**
  - **NEW: Improved UI layout and visual hierarchy**
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

## 🚀 Recently Completed (January 2025)

### Landing Page Improvements ✅
- Added animated bouncing player that lands on platform
- Integrated Google Fonts for professional typography
- Redesigned buttons with modern, polished appearance
- Improved overall visual hierarchy and user experience

### Power-up System Revamp ✅
- Created power-up selection menu before game start
- Implemented manual activation system (spacebar/tap)
- Added visual inventory display during gameplay
- Players now have strategic control over power-up usage

### Scoring System Fixes ✅
- Separated height score from bonus score
- Clearer display of different score components
- Better visual feedback for scoring events

### UI/UX Improvements ✅
- Better button styling with hover states
- Improved font choices using Google Fonts
- More cohesive visual design throughout

### Gameplay Adjustments ✅
- Player height increased by 20% for better visibility
- Shield activation threshold adjusted for better gameplay balance

## 🚀 Recently Completed (January 2025 - Part 2)

### Monetization & Payment System ✅
- **Pay-to-Continue Feature**
  - One-click continue for 0.001 HYPE after game over
  - Direct wallet transaction without extra modals
  - Places player on safe platform with score preserved
  - Loading states for processing and verification
  
- **Power-up Purchase System**
  - Shop accessible from main menu and game over screen
  - Individual power-ups: 0.0005 HYPE each (3 uses)
  - Bundle option: 0.0015 HYPE for all power-ups
  - Real-time inventory updates after purchase
  - Integrated Frame SDK payment flow

### Visual Enhancements ✅
- **Parallax Background System**
  - Multi-layer cloud system with different speeds
  - Height-based themes (Sky → Clouds → Space)
  - Dynamic star generation in space theme
  - Reduced white intensity to prevent eye strain
  - Smooth transitions between themes

### Haptics Integration ✅
- **Dual Haptic Support**
  - Frame SDK haptics for Farcaster environment
  - Fallback to Vibration API for regular browsers
  - Custom patterns for different game events
  - Integrated throughout all interactions

### Backend Integration Preparation ✅
- Created comprehensive backend requirements documentation
- Mocked payment verification service
- Prepared for Quick Auth integration
- Ready for production API endpoints

## 📋 What Still Needs to Be Done

### 1. Visual Polish 🎨
- [ ] **Screen Effects**
  - Screen shake on heavy impacts
  - Smooth transitions between game states
  - Visual feedback for height milestones
  - Power-up activation animations

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

### Phase 1: Polish Current Features (1 week) ✅ COMPLETED
- [x] ~~Add local high score storage~~ ✅
- [x] ~~Implement particle effects~~ ✅
- [x] ~~Add coin collectibles~~ ✅
- [x] ~~Create audio system~~ ✅
- [x] ~~Implement power-ups~~ ✅
- [x] ~~Add combo system~~ ✅
- [x] ~~Landing page improvements~~ ✅
- [x] ~~Power-up system revamp~~ ✅
- [x] ~~Scoring system fixes~~ ✅
- [x] ~~UI/UX improvements~~ ✅

### Phase 2: Monetization & Core Features (1 week) ✅ COMPLETED
- [x] Pay-to-continue feature after game over ✅
- [x] Power-up purchase system ✅
- [ ] Fix slow time power-up mechanics
- [ ] Add difficulty progression
- [x] Implement haptics (JS and Frame SDK) ✅

### Phase 3: Visual Enhancement (2 weeks)
- [ ] Implement parallax backgrounds
- [ ] Add themed zones (sky, clouds, space)
- [ ] Create screen shake effects
- [ ] Polish UI transitions

### Phase 4: Social Integration (2 weeks)
- [ ] Farcaster leaderboard integration
- [ ] Score sharing functionality
- [ ] Friend challenges
- [ ] Achievement system

### Phase 5: Advanced Features (1 month)
- [ ] Enemy/obstacle system
- [ ] Additional platform types
- [ ] Daily challenges
- [ ] Ghost mode multiplayer
- [ ] NFT rewards

## 📊 Current Progress Summary

**Core Gameplay: 95% Complete** ✅
- All basic mechanics implemented
- Four platform types working
- Player controls polished with height adjustment
- Basic game loop complete
- Power-up system revamped with manual activation

**UI/UX: 90% Complete** ✅
- Landing page with animated player
- Google Fonts integration
- Polished button designs
- Improved score display
- Power-up selection menu

**Collectibles & Rewards: 90% Complete** ✅
- Coins fully implemented
- Power-ups working with new selection system
- Combo system active
- Score persistence done
- Separated height/bonus scoring

**Audio/Visual: 75% Complete** 🔄
- Full audio system implemented
- Particle effects working
- Landing page animations added
- Needs: backgrounds, themes, screen effects

**Monetization: 100% Complete** ✅
- Pay-to-continue system implemented
- Power-up purchase system complete
- Payment integration ready (mocked backend)

**Social Features: 10% Complete** 📱
- Frame integration started
- Needs: leaderboards, sharing, multiplayer

**Meta Features: 5% Complete** 🎮
- Basic scoring done
- Needs: achievements, challenges, progression

## 🎮 Game Feel Assessment

The game has excellent "juice" with Disney-quality animations. Player movement feels responsive and alive with squash/stretch effects. The audio system adds satisfying feedback for every action. The combo system rewards skilled play, while power-ups add variety and excitement. Mobile controls are intuitive with haptic feedback enhancing the experience.

**What's Working Well:**
- Tight, responsive controls with improved player visibility
- Satisfying audio-visual feedback
- Good variety in platform types
- Engaging combo system
- Smooth performance
- Polished landing page with animations
- Strategic power-up system with manual activation
- Clear score separation (height vs bonus)

**Areas for Improvement:**
- Long-term progression hooks
- Social competition elements
- Difficulty curve refinement
- Leaderboard integration (waiting for backend)
- Achievement system
- Daily challenges
- Additional platform types