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
  beginner: 'text-green-600 dark:text-green-400',
  easy: 'text-blue-600 dark:text-blue-400',
  medium: 'text-yellow-600 dark:text-yellow-400',
  hard: 'text-orange-600 dark:text-orange-400',
  expert: 'text-red-600 dark:text-red-400'
};

// 各难度的符号池（与生成器用到的符号保持一致）
export const SYMBOL_POOLS = {
  beginner: {
    numbers: ['0','1','2','3','4','5','6','7','8','9'],
    operators: ['+', '-', '×', '^', '%'],
    functions: ['sqrt']
  },
  easy: {
    numbers: ['0','1','2','3','4','5','6','7','8','9','pi'],
    operators: ['+', '-', '×', '÷'],
    functions: ['sin', 'cos', 'log']
  },
  medium: {
    numbers: ['0','1','2','3','4','5','6','7','8','9','pi'],
    operators: ['+', '-', '×', '÷', '^'],
    functions: ['sqrt', 'sin', 'cos', 'log']
  },
  hard: {
    numbers: ['0','1','2','3','4','5','6','7','8','9'],
    operators: ['+', '-', '×', '^'],
    functions: ['sqrt']
  },
  expert: {
    numbers: ['0','1','2','3','4','5','6','7','8','9','pi'],
    operators: ['+', '-', '×', '÷', '^'],
    functions: ['sqrt', 'sin', 'cos']
  }
};

// 各难度的槽位数量范围
export const SLOT_RANGES = {
  beginner: [6, 8],
  easy: [7, 10],
  medium: [8, 12],
  hard: [6, 10],
  expert: [10, 18]
};

// 各难度限时（秒）—— 倒计时用；困难/极难表达式更长，时间放宽
export const DIFFICULTY_TIME_LIMIT = {
  beginner: 3 * 60,
  easy: 4 * 60,
  medium: 5 * 60,
  hard: 7 * 60,
  expert: 10 * 60
};

// 反馈颜色
export const FEEDBACK = {
  CORRECT: 'correct',
  PRESENT: 'present',
  ABSENT: 'absent'
};

export const FEEDBACK_COLORS = {
  correct: 'bg-wgreen text-white dark:bg-wgreenDark',
  present: 'bg-wyellow text-white dark:bg-wyellowDark',
  absent: 'bg-wgray text-white dark:bg-wgrayDark'
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
  'log': 'log'
};

// 符号类型分类
export function getSymbolType(symbol) {
  if (['+', '-', '×', '÷', '^', '%'].includes(symbol)) return 'operator';
  if (['sqrt', 'sin', 'cos', 'tan', 'log'].includes(symbol)) return 'function';
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
  'log': 'S.log10'
};
