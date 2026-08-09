import React from 'react';
import {SceneFrame, useNormFrame} from '../components/ui';
import {Kicker, Headline, Bullet, Phone, appear} from '../components/blocks';
import {C} from '../theme';
import {sans} from '../fonts';

export const Scene5Modes: React.FC = () => {
  const frame = useNormFrame();
  const capIn = appear(frame, 96, 14, 20);

  return (
    <SceneFrame>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40}}>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18}}>
          <Kicker start={0}>模式</Kicker>
          <Headline start={8}>三种玩法 · 想怎么玩都行</Headline>
        </div>

        <div style={{display: 'flex', alignItems: 'center', gap: 100}}>
          {/* 讲解文字 */}
          <div style={{display: 'flex', flexDirection: 'column', gap: 30, width: 640}}>
            <Bullet icon="🎯" title="单人挑战" desc="选难度，独自破解等式" accent={C.green} start={34} />
            <Bullet icon="🤖" title="人机对战" desc="与 AI 竞速，看谁先解出来" accent={C.yellow} start={50} />
            <Bullet icon="🌐" title="联机对战" desc="匹配真人，实时对抗" accent={C.blue} start={66} />
            <div style={{opacity: capIn.opacity, translate: capIn.translate, marginTop: 4}}>
              <div style={{fontFamily: sans, fontSize: 28, fontWeight: 500, color: C.text3}}>
                还内置统计与排行榜，见证你的成长
              </div>
            </div>
          </div>

          {/* 真实游戏截图 */}
          <Phone src="screens/game-fresh.png" width={350} delay={28} />
        </div>
      </div>
    </SceneFrame>
  );
};
