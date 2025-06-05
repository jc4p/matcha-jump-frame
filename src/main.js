import './style.css';
import { Game } from './Game.js';
import { DebugManager } from './managers/DebugManager.js';

document.addEventListener('DOMContentLoaded', () => {
  window.debugManager = new DebugManager();
  const canvas = document.getElementById('gameCanvas');
  const game = new Game(canvas);
});