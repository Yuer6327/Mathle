import React from 'react';
import {TransitionSeries, springTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {Scene1Title} from './scenes/Scene1Title';
import {Scene2HowToPlay} from './scenes/Scene2HowToPlay';
import {Scene3Feedback} from './scenes/Scene3Feedback';
import {Scene4Difficulty} from './scenes/Scene4Difficulty';
import {Scene5Modes} from './scenes/Scene5Modes';
import {Scene6Online} from './scenes/Scene6Online';
import {Scene7Expert} from './scenes/Scene7Expert';
import {Scene8CTA} from './scenes/Scene8CTA';

// 60fps：动画更丝滑。场景内部动画关键帧按 30fps 参考系书写（useNormFrame 归一化），
// 因此这里的帧数全部基于 30fps 参考，乘 F 得到真实帧数。
export const FPS = 60;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// 各场景时长（30fps 参考帧）
export const SCENE = {
  title: 150,
  howToPlay: 195,
  feedback: 195,
  difficulty: 210,
  modes: 150,
  online: 195,
  expert: 270,
  cta: 135,
};

const F = FPS / 30; // 2

// 转场：springTiming 更自然的缓入缓出；时长 15 帧(参考) × F
const TRANSITION = 15;
const transTiming = springTiming({
  config: {damping: 200},
  durationInFrames: TRANSITION * F,
});

export const MathleVideo: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={SCENE.title * F}>
        <Scene1Title />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={transTiming} />
      <TransitionSeries.Sequence durationInFrames={SCENE.howToPlay * F}>
        <Scene2HowToPlay />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={transTiming} />
      <TransitionSeries.Sequence durationInFrames={SCENE.feedback * F}>
        <Scene3Feedback />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={transTiming} />
      <TransitionSeries.Sequence durationInFrames={SCENE.difficulty * F}>
        <Scene4Difficulty />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={transTiming} />
      <TransitionSeries.Sequence durationInFrames={SCENE.modes * F}>
        <Scene5Modes />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={transTiming} />
      <TransitionSeries.Sequence durationInFrames={SCENE.online * F}>
        <Scene6Online />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={transTiming} />
      <TransitionSeries.Sequence durationInFrames={SCENE.expert * F}>
        <Scene7Expert />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={transTiming} />
      <TransitionSeries.Sequence durationInFrames={SCENE.cta * F}>
        <Scene8CTA />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};

// 实际内容时长：各场景时长之和 − 过渡时长之和（每个过渡从后续场景扣过渡时长）
// 直接给精确帧数，避免 round 造成末尾黑帧/裁切
export const TOTAL_FRAMES = (Object.values(SCENE).reduce((a, b) => a + b, 0) - 7 * TRANSITION) * F;
export const TOTAL_SECONDS = TOTAL_FRAMES / FPS;
