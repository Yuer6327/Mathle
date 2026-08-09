import React from 'react';
import {Easing, interpolate} from 'remotion';
import {SceneFrame, useNormFrame} from '../components/ui';
import {C} from '../theme';
import {sans} from '../fonts';

// 标题逐字动画（M 绿 / W 黄，与游戏主菜单一致）
const WORD = 'MathWordle';
const CHARS = WORD.split('').map((ch, i) => ({
  ch,
  color: ch === 'M' ? C.green : ch === 'W' ? C.yellow : C.text,
}));

export const Scene1Title: React.FC = () => {
  const frame = useNormFrame();

  const fadeIn = interpolate(frame, [10, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const subIn = interpolate(frame, [55, 75], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const subY = interpolate(frame, [55, 75], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const glowPulse = interpolate(frame % 60, [0, 30, 60], [0.55, 0.9, 0.55]);

  return (
    <SceneFrame>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34}}>
        {/* 标题上方的发光 */}
        <div
          style={{
            position: 'absolute',
            width: 900,
            height: 340,
            borderRadius: '50%',
            background: 'radial-gradient(closest-side, rgba(74,222,128,0.20), transparent)',
            filter: 'blur(20px)',
            opacity: glowPulse,
            zIndex: 0,
          }}
        />
        <div style={{display: 'flex', opacity: fadeIn, position: 'relative', zIndex: 1}}>
          {CHARS.map((c, i) => {
            const delay = 8 + i * 3.2;
            const s = interpolate(frame, [delay, delay + 22], [0.4, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
              easing: Easing.spring({damping: 200, stiffness: 90}),
            });
            const o = interpolate(frame, [delay, delay + 14], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <span
                key={i}
                style={{
                  fontFamily: sans,
                  fontSize: 170,
                  fontWeight: 700,
                  letterSpacing: -6,
                  color: c.color,
                  opacity: o,
                  scale: String(s),
                  display: 'inline-block',
                }}
              >
                {c.ch}
              </span>
            );
          })}
        </div>

        <div
          style={{
            opacity: subIn,
            translate: subY,
            fontFamily: sans,
            fontSize: 46,
            fontWeight: 500,
            color: C.text2,
            letterSpacing: 2,
          }}
        >
          数学版 Wordle
        </div>
      </div>
    </SceneFrame>
  );
};
