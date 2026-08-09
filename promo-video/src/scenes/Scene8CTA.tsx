import React from 'react';
import {interpolate} from 'remotion';
import {SceneFrame, useNormFrame} from '../components/ui';
import {Kicker, Chip, appear} from '../components/blocks';
import {C} from '../theme';
import {mono, sans} from '../fonts';

const URL = 'wordle.yuer6327.top';
const PILLS = ['5 档难度', '实时对战', '排行榜'];

export const Scene8CTA: React.FC = () => {
  const frame = useNormFrame();
  const subIn = appear(frame, 60, 14, 20);
  const pillsIn = appear(frame, 76, 14, 20);
  const glowPulse = interpolate(frame % 70, [0, 35, 70], [0.45, 0.85, 0.45]);

  return (
    <SceneFrame>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 44}}>
        {/* 背景光晕 */}
        <div
          style={{
            position: 'absolute',
            width: 1100,
            height: 420,
            borderRadius: '50%',
            background: 'radial-gradient(closest-side, rgba(74,222,128,0.22), transparent)',
            filter: 'blur(24px)',
            opacity: glowPulse,
          }}
        />

        <div style={{position: 'relative'}}>
          <Kicker start={0} color={C.green}>
            在线试玩
          </Kicker>
        </div>

        <div style={{position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20}}>
          <div
            style={{
              fontFamily: mono,
              fontSize: 132,
              fontWeight: 700,
              color: C.text,
              letterSpacing: -3,
              display: 'flex',
            }}
          >
            {URL.split('').map((ch, i) => {
              const at = 14 + i * 2;
              const o = interpolate(frame, [at, at + 12], [0, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              const s = interpolate(frame, [at, at + 14], [0.6, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              });
              return (
                <span
                  key={i}
                  style={{
                    opacity: o,
                    scale: String(s),
                    color: ch === '.' ? C.yellow : C.text,
                    display: 'inline-block',
                  }}
                >
                  {ch}
                </span>
              );
            })}
          </div>
        </div>

        <div style={{opacity: subIn.opacity, translate: subIn.translate}}>
          <div style={{fontFamily: sans, fontSize: 38, fontWeight: 500, color: C.text2}}>
            免费 · 无需下载 · 打开即玩
          </div>
        </div>

        <div style={{display: 'flex', gap: 18, opacity: pillsIn.opacity, translate: pillsIn.translate}}>
          {PILLS.map((p) => (
            <Chip key={p} color={C.green} size={26}>
              {p}
            </Chip>
          ))}
        </div>
      </div>
    </SceneFrame>
  );
};
