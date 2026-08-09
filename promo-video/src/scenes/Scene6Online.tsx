import React from 'react';
import {SceneFrame, useNormFrame} from '../components/ui';
import {Kicker, Headline, Bullet, Phone, appear} from '../components/blocks';
import {C} from '../theme';
import {sans} from '../fonts';

export const Scene6Online: React.FC = () => {
  const frame = useNormFrame();
  const capIn = appear(frame, 100, 14, 20);

  return (
    <SceneFrame>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40}}>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18}}>
          <Kicker start={0}>联机对战</Kicker>
          <Headline start={8}>实时匹配 · 与真人过招</Headline>
        </div>

        <div style={{display: 'flex', alignItems: 'center', gap: 100}}>
          {/* 真实房间截图 */}
          <Phone src="screens/room.png" width={350} delay={28} />

          {/* 讲解文字 */}
          <div style={{display: 'flex', flexDirection: 'column', gap: 30, width: 660}}>
            <Bullet icon="⚔️" title="1v1 对抗" desc="各自答案同时开猜，先破解者胜" accent={C.yellow} start={34} />
            <Bullet icon="🤝" title="合作模式" desc="共享等式轮流猜测，一起通关" accent={C.green} start={50} />
            <Bullet icon="🏠" title="好友房间" desc="6 位房号一键加入，N 人合作" accent={C.blue} start={66} />
            <div style={{opacity: capIn.opacity, translate: capIn.translate, marginTop: 4}}>
              <div style={{fontFamily: sans, fontSize: 28, fontWeight: 500, color: C.text3}}>
                真实房间页 · 输入房号即开即玩
              </div>
            </div>
          </div>
        </div>
      </div>
    </SceneFrame>
  );
};
