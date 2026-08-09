// 难度配置 & 符号池

export const DIFFICULTIES = ['beginner', 'easy', 'medium', 'hard', 'expert'];

export const DIFFICULTY_LABELS = {
  beginner: '入门',
  easy: '简单',
  medium: '中等',
  hard: '困难',
  expert: '极难'
};

export const DIFFICULTY_COLORS = {
  beginner: 'text-green-400',
  easy: 'text-blue-400',
  medium: 'text-yellow-400',
  hard: 'text-orange-400',
  expert: 'text-red-400'
};

// 难度选中态（难度选择器 / 排行榜 Tab 的“当前项”样式）
export const DIFFICULTY_ACTIVE = {
  beginner: 'bg-green-500/15 text-green-300 border-green-400/70',
  easy: 'bg-blue-500/15 text-blue-300 border-blue-400/70',
  medium: 'bg-yellow-500/15 text-yellow-300 border-yellow-400/70',
  hard: 'bg-orange-500/15 text-orange-300 border-orange-400/70',
  expert: 'bg-red-500/15 text-red-300 border-red-400/70'
};

// 各难度的符号池 —— 严格递增（每档都是上一档的超集，只增不减）
//   保证“符号池越往上越多”，且生成器产出的每个符号都必然可猜
export const SYMBOL_POOLS = {
  beginner: {
    numbers: ['0','1','2','3','4','5','6','7','8','9'],
    operators: ['+', '-', '×', '^', '%'],
    functions: ['sqrt']
  },
  easy: {
    numbers: ['0','1','2','3','4','5','6','7','8','9','pi'],
    operators: ['+', '-', '×', '÷', '^', '%'],
    functions: ['sqrt', 'sin', 'cos', 'log']
  },
  medium: {
    numbers: ['0','1','2','3','4','5','6','7','8','9','pi'],
    operators: ['+', '-', '×', '÷', '^', '%'],
    functions: ['sqrt', 'sin', 'cos', 'log', 'tan']
  },
  hard: {
    numbers: ['0','1','2','3','4','5','6','7','8','9','pi','e'],
    operators: ['+', '-', '×', '÷', '^', '%'],
    functions: ['sqrt', 'sin', 'cos', 'log', 'tan', 'ln']
  },
  expert: {
    numbers: ['0','1','2','3','4','5','6','7','8','9','pi','e'],
    operators: ['+', '-', '×', '÷', '^', '%'],
    functions: ['sqrt', 'sin', 'cos', 'log', 'tan', 'ln', 'abs']
  }
};

// 各难度的槽位数量范围 —— 生成器据此重试，保证命中范围
export const SLOT_RANGES = {
  beginner: [5, 8],
  easy: [7, 11],
  medium: [10, 21],
  hard: [20, 31],
  expert: [30, 45]
};

// 各难度限时（秒）—— 倒计时用；困难/极难表达式更长，时间放宽
export const DIFFICULTY_TIME_LIMIT = {
  beginner: 3 * 60,
  easy: 4 * 60,
  medium: 5 * 60,
  hard: 10 * 60,
  expert: 15 * 60
};

// 反馈颜色
export const FEEDBACK = {
  CORRECT: 'correct',
  PRESENT: 'present',
  ABSENT: 'absent'
};

export const FEEDBACK_COLORS = {
  correct: 'bg-green-600 text-white',
  present: 'bg-yellow-500 text-white',
  absent: 'bg-neutral-700 text-white'
};

// 符号显示文本
export const SYMBOL_DISPLAY = {
  'pi': 'π',
  'e': 'e',
  '×': '×',
  '÷': '÷',
  '^': '^',
  '%': '%',
  '+': '+',
  '-': '−',
  'sqrt': '√',
  'sin': 'sin',
  'cos': 'cos',
  'tan': 'tan',
  'log': 'lg', // 以 10 为底的对数，显示为 lg 更清晰；内部符号仍为 'log'
  'ln': 'ln',  // 以 e 为底的自然对数
  'abs': 'abs' // 绝对值 |a|
};

// 符号类型分类
export function getSymbolType(symbol) {
  if (['+', '-', '×', '÷', '^', '%'].includes(symbol)) return 'operator';
  if (['sqrt', 'sin', 'cos', 'tan', 'log', 'ln', 'abs'].includes(symbol)) return 'function';
  return 'number'; // 0-9, pi, e
}

// 符号转为 eval 用字符串
export const SYMBOL_TO_EVAL = {
  'pi': 'Math.PI',
  'e': 'Math.E',
  '×': '*',
  '÷': '/',
  '^': '^', // 在 parser 里特殊处理
  '%': '%',
  '+': '+',
  '-': '-',
  'sqrt': 'S.sqrt',
  'sin': 'S.sin',
  'cos': 'S.cos',
  'tan': 'S.tan',
  'log': 'S.log10',
  'ln': 'S.ln',
  'abs': 'S.abs'
};
