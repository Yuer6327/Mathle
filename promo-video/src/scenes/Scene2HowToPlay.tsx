import React from 'react';
import {SceneFrame, useNormFrame} from '../components/ui';
import {Kicker, Headline, Bullet, Phone, appear} from '../components/blocks';
import {C} from '../theme';
import {sans} from '../fonts';

export const Scene2HowToPlay: React.FC = () => {
  const frame = useNormFrame();
  const hint = appear(frame, 78, 14, 20);

  return (
    <SceneFrame>
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 38}}>
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18}}>
          <Kicker start={0}>玩法</Kicker>
          <Headline start={8}>猜一条隐藏的等式</Headline>
        </div>

        <div style={{display: 'flex', alignItems: 'center', gap: 100}}>
          {/* 讲解文字 */}
          <div style={{display: 'flex', flexDirection: 'column', gap: 34, width: 660}}>
            <Bullet icon="🎲" title="隐藏等式" desc="每局生成一条等式，只有括号和 = 可见，其余全是空槽" accent={C.green} start={34} />
            <Bullet icon="⌨️" title="符号池填空" desc="从下方符号池选数字 / 运算 / 函数，填入每个槽位" accent={C.blue} start={50} />
            <Bullet icon="⚡" title="难度升级" desc="难度越高，式子越长、符号池越丰富" accent={C.yellow} start={66} />
          </div>

          {/* 真实游戏截图：正在填词 */}
          <Phone src="screens/game-fill.png" width={350} delay={30} />
        </div>

        <div style={{opacity: hint.opacity, translate: hint.translate}}>
          <div style={{fontFamily: sans, fontSize: 28, fontWeight: 500, color: C.text3}}>
            真实游戏画面 · 正在从底部符号池填入等式
          </div>
        </div>
      </div>
    </SceneFrame>
  );
};
