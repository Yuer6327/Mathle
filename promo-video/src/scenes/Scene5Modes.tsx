import React from 'react';
import {interpolate} from 'remotion';
import {SceneFrame, useNormFrame} from '../components/ui';
import {Kicker, Headline, appear} from '../components/blocks';
import {C} from '../theme';
import {sans} from '../fonts';

const MODES = [
  {icon: '🎯', title: '单人挑战', sub: '选难度 · 独自破解', accent: C.green},
  {icon: '🤖', title: '人机对战', sub: '与 AI 竞速抢答', accent: C.yellow},
  {icon: '🌐', title: '联机对战', sub: '匹配真人 · 实时对抗', accent: C.blue},
];

export const Scene5Modes: React.FC = () => {
  const frame = useNormFrame();
  const subIn = appear(frame, 108, 14, 20);

  return (
    <SceneFrame>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 56}}>
        <Kicker start={0}>模式</Kicker>
        <Headline start={10}>三种玩法</Headline>

        <div style={{display: 'flex', gap: 36}}>
          {MODES.map((m, i) => {
            const a = appear(frame, 40 + i * 14, 14, 34);
            const s = interpolate(frame, [40 + i * 14, 40 + i * 14 + 22], [0.92, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            return (
              <div
                key={m.title}
                style={{
                  width: 400,
                  padding: '44px 36px',
                  borderRadius: 28,
                  backgroundColor: C.panel,
                  border: `1px solid ${C.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 22,
                  opacity: a.opacity,
                  translate: a.translate,
                  scale: String(s),
                  boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
                }}
              >
                <div
                  style={{
                    width: 116,
                    height: 116,
                    borderRadius: 30,
                    backgroundColor: `${m.accent}22`,
                    border: `2px solid ${m.accent}55`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 60,
                  }}
                >
                  {m.icon}
                </div>
                <div style={{fontFamily: sans, fontSize: 46, fontWeight: 700, color: C.text}}>
                  {m.title}
                </div>
                <div style={{fontFamily: sans, fontSize: 26, fontWeight: 500, color: C.text2}}>
                  {m.sub}
                </div>
              </div>
            );
          })}
        </div>

        <div style={{opacity: subIn.opacity, translate: subIn.translate}}>
          <div style={{fontFamily: sans, fontSize: 34, fontWeight: 500, color: C.text2}}>
            单机练手，或呼朋唤友来一场数学对决
          </div>
        </div>
      </div>
    </SceneFrame>
  );
};
