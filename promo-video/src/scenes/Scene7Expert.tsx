import React from 'react';
import {interpolate} from 'remotion';
import {SceneFrame, useNormFrame} from '../components/ui';
import {Kicker, Headline, Tile, appear} from '../components/blocks';
import {C} from '../theme';
import {sans, mono} from '../fonts';

// 极难 Expert 真实等式（38 个隐藏槽位）：
//   abs(9−7)×3 + (sin(π÷3)+cos(π÷6))×√3 + (sin(π÷4)+cos(π÷4))×√2 + 3^3 = 38
//   计算：|9−7|×3=6，sin(π/3)+cos(π/6)=√3 → 乘 √3 =3，sin(π/4)+cos(π/4)=√2 → 乘 √2 =2，3^3=27，合计 38
type Tok = {s: string; k?: 'number' | 'operator' | 'function'; v?: boolean}; // v=可见(括号/等号)

const EQ: Tok[] = [
  {s: 'abs', k: 'function'}, {s: '(', v: true}, {s: '9', k: 'number'}, {s: '−', k: 'operator'}, {s: '7', k: 'number'}, {s: ')', v: true},
  {s: '×', k: 'operator'}, {s: '3', k: 'number'},
  {s: '+', k: 'operator'},
  {s: '(', v: true},
  {s: 'sin', k: 'function'}, {s: '(', v: true}, {s: 'π', k: 'number'}, {s: '÷', k: 'operator'}, {s: '3', k: 'number'}, {s: ')', v: true},
  {s: '+', k: 'operator'},
  {s: 'cos', k: 'function'}, {s: '(', v: true}, {s: 'π', k: 'number'}, {s: '÷', k: 'operator'}, {s: '6', k: 'number'}, {s: ')', v: true},
  {s: ')', v: true},
  {s: '×', k: 'operator'},
  {s: '√', k: 'function'}, {s: '(', v: true}, {s: '3', k: 'number'}, {s: ')', v: true},
  {s: '+', k: 'operator'},
  {s: '(', v: true},
  {s: 'sin', k: 'function'}, {s: '(', v: true}, {s: 'π', k: 'number'}, {s: '÷', k: 'operator'}, {s: '4', k: 'number'}, {s: ')', v: true},
  {s: '+', k: 'operator'},
  {s: 'cos', k: 'function'}, {s: '(', v: true}, {s: 'π', k: 'number'}, {s: '÷', k: 'operator'}, {s: '4', k: 'number'}, {s: ')', v: true},
  {s: ')', v: true},
  {s: '×', k: 'operator'},
  {s: '√', k: 'function'}, {s: '(', v: true}, {s: '2', k: 'number'}, {s: ')', v: true},
  {s: '+', k: 'operator'},
  {s: '3', k: 'number'}, {s: '^', k: 'operator'}, {s: '3', k: 'number'},
  {s: '=', v: true}, {s: '3', k: 'number'}, {s: '8', k: 'number'},
];

const SLOT_SIZE = 48;

export const Scene7Expert: React.FC = () => {
  const frame = useNormFrame();

  const hook = appear(frame, 196, 14, 22);
  const glowPulse = interpolate(frame % 70, [0, 35, 70], [0.3, 0.6, 0.3]);

  const totalSlots = EQ.filter((t) => !t.v).length; // 38
  const fillStart = 96;
  const resultGreenAt = fillStart + totalSlots * 2 + 10;

  let slotIdx = 0;

  return (
    <SceneFrame>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34}}>
        {/* 极难红色光晕 */}
        <div
          style={{
            position: 'absolute',
            width: 1500,
            height: 620,
            borderRadius: '50%',
            background: `radial-gradient(closest-side, ${C.diff.expert}22, transparent)`,
            filter: 'blur(24px)',
            opacity: glowPulse,
          }}
        />

        <Kicker start={0} color={C.diff.expert}>
          挑战自己
        </Kicker>
        <Headline start={8}>极难 · Expert</Headline>

        {/* 等式面板：空槽逐个出现 → 逐格翻出答案 → 结果变绿 */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 3,
            maxWidth: 1680,
            backgroundColor: C.panel,
            border: `1px solid ${C.border}`,
            borderRadius: 22,
            padding: '26px 30px',
            boxShadow: '0 24px 70px rgba(0,0,0,0.55)',
          }}
        >
          {EQ.map((t, i) => {
            if (t.v) {
              // 可见 token（括号 / 等号）
              const o = interpolate(frame, [34, 44], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              return (
                <div
                  key={i}
                  style={{
                    opacity: o,
                    width: t.s === '=' ? SLOT_SIZE * 0.62 : 26,
                    height: SLOT_SIZE,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: mono,
                    fontSize: SLOT_SIZE * 0.52,
                    fontWeight: 600,
                    color: C.text2,
                  }}
                >
                  {t.s}
                </div>
              );
            }
            const idx = slotIdx++;
            const popAt = 36 + idx * 1.4;
            const fillAt = fillStart + idx * 2;
            const filled = frame >= fillAt;
            const isResult = idx >= totalSlots - 2;
            const green = isResult && frame >= resultGreenAt;
            const flip = interpolate(frame, [fillAt, fillAt + 10], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const o = interpolate(frame, [popAt, popAt + 8], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const y = interpolate(frame, [popAt, popAt + 8], [14, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <div key={i} style={{opacity: o, translate: `0 ${y}px`, transformStyle: 'preserve-3d'}}>
                <div
                  style={{
                    transform: `perspective(600px) rotateX(${interpolate(flip, [0, 1], [88, 0])}deg)`,
                    backfaceVisibility: 'hidden',
                  }}
                >
                  <Tile
                    symbol={filled ? t.s : ''}
                    kind={t.k === 'number' ? 'number' : 'operator'}
                    color={green ? C.green : undefined}
                    size={SLOT_SIZE}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* 钩子文案 */}
        <div style={{opacity: hook.opacity, translate: hook.translate, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
          <div style={{fontFamily: sans, fontSize: 40, fontWeight: 600, color: C.text}}>
            30–45 个槽位 · 结果却总是整数
          </div>
          <div style={{fontFamily: sans, fontSize: 30, fontWeight: 500, color: C.text2}}>
            这么难的等式，你能猜出来吗？
          </div>
        </div>
      </div>
    </SceneFrame>
  );
};
