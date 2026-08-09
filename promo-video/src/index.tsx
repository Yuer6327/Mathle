import React from 'react';
import {Composition, Folder, registerRoot} from 'remotion';
import {MathleVideo, WIDTH, HEIGHT, FPS, SCENE, TOTAL_SECONDS} from './MathleVideo';
import {Scene1Title} from './scenes/Scene1Title';
import {Scene2HowToPlay} from './scenes/Scene2HowToPlay';
import {Scene3Feedback} from './scenes/Scene3Feedback';
import {Scene4Difficulty} from './scenes/Scene4Difficulty';
import {Scene5Modes} from './scenes/Scene5Modes';
import {Scene6Online} from './scenes/Scene6Online';
import {Scene7Architecture} from './scenes/Scene7Architecture';
import {Scene8CTA} from './scenes/Scene8CTA';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MathleVideo"
        component={MathleVideo}
        durationInFrames={TOTAL_SECONDS * FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />

      <Folder name="Scenes">
        <Composition id="Scene1Title" component={Scene1Title} durationInFrames={SCENE.title} fps={FPS} width={WIDTH} height={HEIGHT} />
        <Composition id="Scene2HowToPlay" component={Scene2HowToPlay} durationInFrames={SCENE.howToPlay} fps={FPS} width={WIDTH} height={HEIGHT} />
        <Composition id="Scene3Feedback" component={Scene3Feedback} durationInFrames={SCENE.feedback} fps={FPS} width={WIDTH} height={HEIGHT} />
        <Composition id="Scene4Difficulty" component={Scene4Difficulty} durationInFrames={SCENE.difficulty} fps={FPS} width={WIDTH} height={HEIGHT} />
        <Composition id="Scene5Modes" component={Scene5Modes} durationInFrames={SCENE.modes} fps={FPS} width={WIDTH} height={HEIGHT} />
        <Composition id="Scene6Online" component={Scene6Online} durationInFrames={SCENE.online} fps={FPS} width={WIDTH} height={HEIGHT} />
        <Composition id="Scene7Architecture" component={Scene7Architecture} durationInFrames={SCENE.architecture} fps={FPS} width={WIDTH} height={HEIGHT} />
        <Composition id="Scene8CTA" component={Scene8CTA} durationInFrames={SCENE.cta} fps={FPS} width={WIDTH} height={HEIGHT} />
      </Folder>
    </>
  );
};

registerRoot(RemotionRoot);
