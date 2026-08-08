// 种子伪随机数生成器 (mulberry32)
// 确保相同种子产生相同序列，用于联机同步

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 从种子生成随机数生成器
export function createRNG(seed) {
  // 如果 seed 是字符串，转为数字
  if (typeof seed === 'string') {
    let h = 1779033703 ^ seed.length;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    seed = (h ^ (h >>> 16)) >>> 0;
  }
  return mulberry32(seed);
}

// RNG 辅助方法
export function makeRNGHelpers(rng) {
  return {
    next: () => rng(),
    int: (min, max) => Math.floor(rng() * (max - min + 1)) + min,
    pick: (arr) => arr[Math.floor(rng() * arr.length)],
    shuffle: (arr) => {
      const a = [...arr];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    bool: (prob = 0.5) => rng() < prob
  };
}

// 生成随机种子字符串
export function generateSeed() {
  return Math.random().toString(36).substring(2, 12).toUpperCase();
}
