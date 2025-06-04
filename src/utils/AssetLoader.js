export class AssetLoader {
  constructor() {
    this.assets = new Map();
    this.loadedCount = 0;
    this.totalCount = 0;
  }

  loadImage(key, src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      this.totalCount++;
      
      img.onload = () => {
        this.assets.set(key, img);
        this.loadedCount++;
        resolve(img);
      };
      
      img.onerror = () => {
        console.error(`Failed to load image: ${src}`);
        reject(new Error(`Failed to load image: ${src}`));
      };
      
      img.src = src;
    });
  }

  async loadAll(assetList) {
    const promises = assetList.map(({ key, src }) => 
      this.loadImage(key, src)
    );
    
    try {
      await Promise.all(promises);
      return true;
    } catch (error) {
      console.error('Failed to load some assets:', error);
      return false;
    }
  }

  get(key) {
    return this.assets.get(key);
  }

  getProgress() {
    return this.totalCount > 0 ? this.loadedCount / this.totalCount : 0;
  }
}