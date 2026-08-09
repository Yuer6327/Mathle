import React from 'react';
import {interpolate} from 'remotion';
import {SceneFrame, useNormFrame} from '../components/ui';
import {Kicker, Headline, Tile, appear} from '../components/blocks';
import {C} from '../theme';
import {sans} from '../fonts';

// 答案参考行（暗）与一次猜测行（带反馈色）
// 答案 3×7=21；猜测 4×3=21 → 4灰(不在) ×绿(对) 3黄(位置错) 2绿 1绿
const ANSWER = [
  {symbol: '3', kind: 'number' as const},
  {symbol: '×', kind: 'operator' as const},
  {symbol: '7', kind: 'number' as const},
  {symbol: '=', kind: 'equal' as const},
  {symbol: '2', kind: 'number' as const},
  {symbol: '1', kind: 'number' as const},
];

const GUESS = [
  {symbol: '4', kind: 'number' as const, color: C.gray, hit: false},
  {symbol: '×', kind: 'operator' as const, color: C.green, hit: true},
  {symbol: '3', kind: 'number' as const, color: C.yellow, hit: false},
  {symbol: '=', kind: 'equal' as const, color: null, hit: false},
  {symbol: '2', kind: 'number' as const, color: C.green, hit: true},
  {symbol: '1', kind: 'number' as const, color: C.green, hit: true},
];

const LEGEND = [
  {label: '位置正确', color: C.green},
  {label: '包含 · 位置不对', color: C.yellow},
  {label: '不在此等式', color: C.gray},
];

export const Scene3Feedback: React.FC = () => {
  const frame = useNormFrame();
  const answerIn = appear(frame, 42, 14, 18);
  const legendIn = appear(frame, 150, 14, 20);
  const answerSize = 64;

  return (
    <SceneFrame>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 44}}>
        <Kicker start={0}>反馈</Kicker>
        <Headline start={12}>Wordle 式配色反馈</Headline>

        {/* 答案参考行（暗） */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            opacity: answerIn.opacity * 0.5,
            translate: answerIn.translate,
          }}
        >
          {ANSWER.map((t, i) => (
            <Tile key={i} symbol={t.symbol} kind={t.kind} size={answerSize} />
          ))}
        </div>

        {/* 猜测行：先弹出，再逐格翻色 */}
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          {GUESS.map((t, i) => {
            const isEq = t.kind === 'equal';
            const popAt = 62 + i * 4;
            const pop = interpolate(frame, [popAt, popAt + 12], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const popY = interpolate(frame, [popAt, popAt + 12], [26, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            // 翻色（等号跳过）
            const flipAt = isEq ? 40 : 104 + i * 9;
            const flip = isEq ? 1 : interpolate(frame, [flipAt, flipAt + 12], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const flipY = interpolate(frame, [flipAt, flipAt + 12], [70, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            return (
              <div
                key={i}
                style={{
                  opacity: pop,
                  translate: `${0}px ${popY}px`,
                }}
              >
                {isEq ? (
                  <Tile symbol="=" kind="equal" size={96} />
                ) : (
                  <div style={{position: 'relative'}}>
                    {/* 底层：中性已填 */}
                    <Tile symbol={t.symbol} kind={t.kind} size={96} />
                    {/* 上层：反馈色，flip 翻入 */}
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        opacity: flip,
                        transform: `perspective(600px) rotateX(${interpolate(flip, [0, 1], [88, 0])}deg)`,
                        backfaceVisibility: 'hidden',
                      }}
                    >
                      <Tile symbol={t.symbol} kind={t.kind} color={t.color!} size={96} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 图例 */}
        <div style={{display: 'flex', gap: 30, opacity: legendIn.opacity, translate: legendIn.translate}}>
          {LEGEND.map((l) => (
            <div key={l.label} style={{display: 'flex', alignItems: 'center', gap: 14}}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  backgroundColor: l.color,
                  boxShadow: `0 4px 16px ${l.color}66`,
                }}
              />
              <span style={{fontFamily: sans, fontSize: 28, fontWeight: 500, color: C.text}}>
                {l.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </SceneFrame>
  );
};
