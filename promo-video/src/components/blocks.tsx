import React from 'react';
import {interpolate} from 'remotion';
import {C} from '../theme';
import {sans, mono} from '../fonts';
import {appear, useNormFrame} from './ui';

export {appear};

// 场景顶部小标签（章节名）
export const Kicker: React.FC<{children: React.ReactNode; start?: number; color?: string}> = ({
  children,
  start = 0,
  color = C.text3,
}) => {
  const frame = useNormFrame();
  const a = appear(frame, start);
  return (
    <div
      style={{
        opacity: a.opacity,
        translate: a.translate,
        fontFamily: sans,
        fontSize: 28,
        fontWeight: 600,
        letterSpacing: 6,
        textTransform: 'uppercase',
        color,
      }}
    >
      {children}
    </div>
  );
};

// 场景主标题
export const Headline: React.FC<{children: React.ReactNode; start?: number}> = ({children, start = 0}) => {
  const frame = useNormFrame();
  const a = appear(frame, start, 14, 30);
  return (
    <div
      style={{
        opacity: a.opacity,
        translate: a.translate,
        fontFamily: sans,
        fontSize: 92,
        fontWeight: 700,
        color: C.text,
        letterSpacing: -1,
        textAlign: 'center',
      }}
    >
      {children}
    </div>
  );
};

// 场景副标题
export const Sub: React.FC<{children: React.ReactNode; start?: number}> = ({children, start = 0}) => {
  const frame = useNormFrame();
  const a = appear(frame, start);
  return (
    <div
      style={{
        opacity: a.opacity,
        translate: a.translate,
        fontFamily: sans,
        fontSize: 40,
        fontWeight: 500,
        color: C.text2,
        textAlign: 'center',
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
};

// 等式槽位瓦片 —— 复刻游戏 EquationBoard 视觉：
//   数字槽 = 下划线；运算符/函数槽 = 边框盒；= 号 = 纯文本
//   color 提供反馈色时变为实色块
export const Tile: React.FC<{
  symbol?: string; // '' => 空槽
  kind: 'number' | 'operator' | 'equal';
  color?: string; // 反馈色
  size?: number;
}> = ({symbol, kind, color, size = 92}) => {
  // 字号自适应：长符号（sin/cos/abs 等）缩小到能放进方块，避免溢出
  const font = symbol
    ? Math.min(
        symbol.length > 1 ? size * 0.5 : size * 0.56,
        (size - 10) / (symbol.length * 0.62)
      )
    : size * 0.56;

  if (kind === 'equal') {
    return (
      <div
        style={{
          width: size * 0.55,
          height: size,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: mono,
          fontSize: size * 0.56,
          fontWeight: 600,
          color: C.text2,
        }}
      >
        =
      </div>
    );
  }

  if (!symbol) {
    // 空槽
    const isNumber = kind === 'number';
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          backgroundColor: isNumber ? C.panel : C.panel2,
          borderBottom: isNumber ? `6px solid ${C.borderLight}` : `2px solid ${C.borderLight}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    );
  }

  const isColored = Boolean(color);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        backgroundColor: isColored ? color : C.panel2,
        border: isColored ? 'none' : `2px solid ${C.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: mono,
        fontSize: font,
        fontWeight: 700,
        color: isColored ? '#0a0a0a' : C.text,
        boxShadow: isColored ? `0 6px 24px ${color}55` : '0 4px 16px rgba(0,0,0,0.4)',
      }}
    >
      {symbol}
    </div>
  );
};

// 一行等式：tokens 数组（{symbol, kind?, color?}），逐个淡入 + 弹入
export const EqRow: React.FC<{
  tokens: {symbol: string; kind?: 'number' | 'operator' | 'equal'; color?: string}[];
  start?: number;
  gap?: number;
  size?: number;
}> = ({tokens, start = 0, gap = 10, size = 92}) => {
  const frame = useNormFrame();
  return (
    <div style={{display: 'flex', alignItems: 'center', gap, justifyContent: 'center'}}>
      {tokens.map((t, i) => {
        const a = appear(frame, start + i * 2.5, 10, 14);
        const scale = interpolate(frame, [start + i * 2.5, start + i * 2.5 + 12], [0.82, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        });
        return (
          <div key={i} style={{opacity: a.opacity, translate: a.translate, scale: String(scale)}}>
            <Tile symbol={t.symbol} kind={t.kind ?? 'number'} color={t.color} size={size} />
          </div>
        );
      })}
    </div>
  );
};

// 一个“符号池”小药丸
export const Chip: React.FC<{children: React.ReactNode; color?: string; size?: number}> = ({
  children,
  color = '#d4d4d4',
  size = 26,
}) => {
  return (
    <div
      style={{
        padding: `${size * 0.22}px ${size * 0.72}px`,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.14)',
        fontFamily: mono,
        fontSize: size,
        fontWeight: 600,
        color,
      }}
    >
      {children}
    </div>
  );
};
