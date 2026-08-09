// MathWordle 介绍视频 —— 主题色（与游戏 UI 的暗色 + 绿/黄强调一致）
export const C = {
  bg: '#0a0a0a', // neutral-950
  panel: '#171717', // neutral-900
  panel2: '#1f1f1f',
  border: '#333333', // neutral-800
  borderLight: '#525252', // neutral-600
  text: '#f5f5f5', // neutral-100
  text2: '#a3a3a3', // neutral-400
  text3: '#737373', // neutral-500

  // 反馈三色
  green: '#4ade80',
  yellow: '#facc15',
  gray: '#3f3f46',
  blue: '#60a5fa',
  orange: '#fb923c',
  red: '#f87171',

  // 难度色
  diff: {
    beginner: '#4ade80', // 入门 绿
    easy: '#60a5fa', // 简单 蓝
    medium: '#facc15', // 中等 黄
    hard: '#fb923c', // 困难 橙
    expert: '#f87171', // 极难 红
  },
};

// 单行返回动画用的弹簧缓动
export const springEase = (damping = 200) => ({
  damping,
  stiffness: 100,
  mass: 1,
});
