export class DebugManager {
    constructor() {
        this.logs = [];
        this.maxLogs = 500;
        this.isVisible = false;
        this.lastTapTime = 0;
        this.tapTimeout = null;
        this.originalConsole = {};
        
        this.debugButton = document.getElementById('debugButton');
        this.debugModal = document.getElementById('debugModal');
        this.debugLogs = document.getElementById('debugLogs');
        this.debugClose = document.getElementById('debugClose');
        this.debugClear = document.getElementById('debugClear');
        
        this.init();
        this.logFrameContext();
    }
    
    init() {
        this.interceptConsole();
        this.setupDoubleTap();
        this.setupUI();
    }
    
    interceptConsole() {
        const methods = ['log', 'error', 'warn', 'info', 'debug'];
        
        methods.forEach(method => {
            this.originalConsole[method] = console[method];
            
            console[method] = (...args) => {
                this.originalConsole[method](...args);
                
                this.addLog({
                    type: method,
                    message: args.map(arg => {
                        if (typeof arg === 'object') {
                            try {
                                return JSON.stringify(arg, null, 2);
                            } catch (e) {
                                return String(arg);
                            }
                        }
                        return String(arg);
                    }).join(' '),
                    timestamp: new Date().toLocaleTimeString()
                });
            };
        });
    }
    
    addLog(log) {
        this.logs.push(log);
        
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        if (this.isVisible && this.debugModal.style.display === 'flex') {
            this.renderLog(log);
        }
    }
    
    renderLog(log) {
        const logElement = document.createElement('div');
        logElement.style.marginBottom = '5px';
        logElement.style.wordBreak = 'break-all';
        
        const colorMap = {
            log: '#fff',
            error: '#ff5555',
            warn: '#ffff55',
            info: '#5555ff',
            debug: '#888'
        };
        
        logElement.style.color = colorMap[log.type] || '#fff';
        logElement.innerHTML = `<span style="color: #888">[${log.timestamp}]</span> <span style="color: ${colorMap[log.type]}; font-weight: bold;">[${log.type.toUpperCase()}]</span> ${this.escapeHtml(log.message)}`;
        
        this.debugLogs.appendChild(logElement);
        this.debugLogs.scrollTop = this.debugLogs.scrollHeight;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    setupDoubleTap() {
        document.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            const screenHeight = window.innerHeight;
            const tapZoneHeight = screenHeight * 0.1;
            
            if (touch.clientY > screenHeight - tapZoneHeight) {
                const currentTime = Date.now();
                const timeDiff = currentTime - this.lastTapTime;
                
                if (timeDiff < 300 && timeDiff > 0) {
                    this.toggleDebugButton();
                    clearTimeout(this.tapTimeout);
                }
                
                this.lastTapTime = currentTime;
                
                this.tapTimeout = setTimeout(() => {
                    this.lastTapTime = 0;
                }, 300);
            }
        });
        
        document.addEventListener('click', (e) => {
            const screenHeight = window.innerHeight;
            const clickZoneHeight = screenHeight * 0.1;
            
            if (e.clientY > screenHeight - clickZoneHeight) {
                const currentTime = Date.now();
                const timeDiff = currentTime - this.lastTapTime;
                
                if (timeDiff < 300 && timeDiff > 0) {
                    this.toggleDebugButton();
                    clearTimeout(this.tapTimeout);
                }
                
                this.lastTapTime = currentTime;
                
                this.tapTimeout = setTimeout(() => {
                    this.lastTapTime = 0;
                }, 300);
            }
        });
    }
    
    setupUI() {
        this.debugButton.addEventListener('click', () => {
            this.showModal();
        });
        
        this.debugClose.addEventListener('click', () => {
            this.hideModal();
        });
        
        this.debugClear.addEventListener('click', () => {
            this.clearLogs();
        });
        
        this.debugModal.addEventListener('click', (e) => {
            if (e.target === this.debugModal) {
                this.hideModal();
            }
        });
    }
    
    toggleDebugButton() {
        this.isVisible = !this.isVisible;
        this.debugButton.style.display = this.isVisible ? 'flex' : 'none';
        
        if (this.isVisible) {
            console.log('Debug mode activated!');
        }
    }
    
    showModal() {
        this.debugModal.style.display = 'flex';
        this.debugLogs.innerHTML = '';
        
        this.logs.forEach(log => {
            this.renderLog(log);
        });
    }
    
    hideModal() {
        this.debugModal.style.display = 'none';
    }
    
    clearLogs() {
        this.logs = [];
        this.debugLogs.innerHTML = '';
        console.log('Debug logs cleared');
    }
    
    async logFrameContext() {
        try {
            const frame = await import('@farcaster/frame-sdk');
            const context = await frame.sdk.context;
            console.log('Frame SDK Context Client:', context.client);
        } catch (error) {
            console.log('Frame SDK not available or error getting context:', error);
        }
    }
}