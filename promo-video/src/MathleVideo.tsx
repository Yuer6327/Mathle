import React from 'react';
import {TransitionSeries, linearTiming} from '@remotion/transitions';
import {fade} from '@remotion/transitions/fade';
import {Easing} from 'remotion';
import {Scene1Title} from './scenes/Scene1Title';
import {Scene2HowToPlay} from './scenes/Scene2HowToPlay';
import {Scene3Feedback} from './scenes/Scene3Feedback';
import {Scene4Difficulty} from './scenes/Scene4Difficulty';
import {Scene5Modes} from './scenes/Scene5Modes';
import {Scene6Online} from './scenes/Scene6Online';
import {Scene7Architecture} from './scenes/Scene7Architecture';
import {Scene8CTA} from './scenes/Scene8CTA';

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

// 各场景帧长
export const SCENE = {
  title: 135,
  howToPlay: 180,
  feedback: 195,
  difficulty: 210,
  modes: 180,
  online: 210,
  architecture: 210,
  cta: 135,
};

const TRANSITION = 15;
const transTiming = linearTiming({durationInFrames: TRANSITION, easing: Easing.inOut(Easing.ease)});

export const MathleVideo: React.FC = () => {
  return (
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={SCENE.title}>
        <Scene1Title />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={transTiming} />
      <TransitionSeries.Sequence durationInFrames={SCENE.howToPlay}>
        <Scene2HowToPlay />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={transTiming} />
      <TransitionSeries.Sequence durationInFrames={SCENE.feedback}>
        <Scene3Feedback />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={transTiming} />
      <TransitionSeries.Sequence durationInFrames={SCENE.difficulty}>
        <Scene4Difficulty />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={transTiming} />
      <TransitionSeries.Sequence durationInFrames={SCENE.modes}>
        <Scene5Modes />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={transTiming} />
      <TransitionSeries.Sequence durationInFrames={SCENE.online}>
        <Scene6Online />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={transTiming} />
      <TransitionSeries.Sequence durationInFrames={SCENE.architecture}>
        <Scene7Architecture />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={transTiming} />
      <TransitionSeries.Sequence durationInFrames={SCENE.cta}>
        <Scene8CTA />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  );
};

// 总时长：TransitionSeries 里每个过渡从后续序列扣掉过渡时长，
// 实际内容 = 各场景时长之和 − 过渡时长之和（7 个过渡 × 15）
export const TOTAL_SECONDS = Math.round(
  (Object.values(SCENE).reduce((a, b) => a + b, 0) - 7 * TRANSITION) / FPS
);
