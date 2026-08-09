import React from 'react';
import {interpolate} from 'remotion';
import {SceneFrame, useNormFrame} from '../components/ui';
import {Kicker, Headline, Sub, Tile, Chip, appear} from '../components/blocks';
import {C} from '../theme';

// 等式：3 × 7 = 21（= 号可见，其余全是隐藏槽位 —— 与游戏 buildEquation 一致）
const SLOTS = [
  {symbol: '3', kind: 'number' as const},
  {symbol: '×', kind: 'operator' as const},
  {symbol: '7', kind: 'number' as const},
  {symbol: '=', kind: 'equal' as const},
  {symbol: '2', kind: 'number' as const},
  {symbol: '1', kind: 'number' as const},
];

const POOL = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '−', '×', '÷', '^', '√'];

export const Scene2HowToPlay: React.FC = () => {
  const frame = useNormFrame();
  const size = 96;

  const chips = appear(frame, 118, 14, 20);
  const caption = appear(frame, 128, 14, 20);

  return (
    <SceneFrame>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 40,
        }}
      >
        <Kicker start={0}>玩法</Kicker>
        <Headline start={12}>猜一条隐藏的等式</Headline>

        {/* 等式板 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            backgroundColor: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 24,
            padding: '34px 40px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
        >
          {SLOTS.map((t, i) => {
            const isEmptyKind = t.kind === 'equal';
            // 空槽出现
            const emptyAt = isEmptyKind ? 40 : 40 + i * 3;
            const emptyIn = interpolate(frame, [emptyAt, emptyAt + 10], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            // 填值翻转（等号不参与）
            const revealAt = isEmptyKind ? 40 : 80 + i * 7;
            const revealed = frame >= revealAt;
            const flip = isEmptyKind ? 1 : interpolate(frame, [revealAt, revealAt + 12], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const rev = isEmptyKind ? 1 : interpolate(frame, [revealAt, revealAt + 10], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            return (
              <div
                key={i}
                style={{
                  opacity: emptyIn,
                  translate: `${0}px ${interpolate(frame, [emptyAt, emptyAt + 10], [20, 0], {
                    extrapolateLeft: 'clamp',
                    extrapolateRight: 'clamp',
                  })}px`,
                  transformStyle: 'preserve-3d',
                }}
              >
                {isEmptyKind ? (
                  <Tile symbol="=" kind="equal" size={size} />
                ) : (
                  <div
                    style={{
                      transform: `perspective(600px) rotateX(${interpolate(flip, [0, 1], [88, 0])}deg)`,
                      opacity: rev,
                      backfaceVisibility: 'hidden',
                    }}
                  >
                    <Tile symbol={revealed ? t.symbol : ''} kind={t.kind} size={size} />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 符号池 */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 12,
            maxWidth: 1500,
            opacity: chips.opacity,
            translate: chips.translate,
          }}
        >
          {POOL.map((s) => (
            <Chip key={s} color={C.text} size={24}>
              {s}
            </Chip>
          ))}
        </div>

        <div style={{opacity: caption.opacity, translate: caption.translate}}>
          <Sub start={0}>
            每局生成一条隐藏等式 —— 从符号池填入每个槽位，让等式成立
          </Sub>
        </div>
      </div>
    </SceneFrame>
  );
};
