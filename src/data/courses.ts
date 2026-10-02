export interface QuizQuestion {
  id: string;
  questionNumber: number; // 1, 2, 3
  prompt: string;
  hint: string;
  choices: [string, string, string]; // 0: Left [A], 1: Center [▲], 2: Right [D]
  correctIndex: 0 | 1 | 2;
  explanation: string;
}

export interface LogicCourse {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  difficulty: 'NORMAL' | 'HARD' | 'EXTREME';
  themeColor: string;
  questions: [QuizQuestion, QuizQuestion, QuizQuestion];
}

export interface PitfallZone {
  id: string;
  stageIndex: number;
  zStart: number;
  zEnd: number;
  uMin: number;
  uMax: number;
  label: string;
}

export interface StageObstacle {
  id: string;
  stageIndex: number;
  z: number;
  zDepth: number;
  uCenter: number;
  uWidth: number;
  height: number;
  kind: 'barrier' | 'pillar' | 'moving';
  moveSpeed?: number;
  moveRange?: number;
}

export const STAGE_LENGTH = 520;
export const SPLIT_APPROACH_Z = 350;
export const SPLIT_GATE_Z = 390;
export const SPLIT_JUDGE_Z = 450;
export const SPLIT_MERGE_Z = 500;

export const DEFAULT_COURSES: LogicCourse[] = [
  {
    id: 'course-mystery',
    code: 'FILE 01',
    title: '密室図書室のトリック',
    subtitle: '密室殺人の謎を3つの問いで論破せよ',
    difficulty: 'NORMAL',
    themeColor: '#06B6D4',
    questions: [
      {
        id: 'm-q1',
        questionNumber: 1,
        prompt: '第1問：内側から鍵が掛かった図書室で遺体を発見。窓は全て嵌め殺し。犯人はどうやって密室を作った？',
        hint: '通気ダクトの隙間と現場に残された繊維に注目',
        choices: [
          '換気ダクトから糸で内鍵を引いた',
          '壁を通り抜ける超能力を使った',
          '合鍵を外から差し込んで回した',
        ],
        correctIndex: 0,
        explanation: '内側からしか掛からないカンヌキ錠は、換気ダクトから細い糸を通して引くことで外から施錠偽装が可能だった。',
      },
      {
        id: 'm-q2',
        questionNumber: 2,
        prompt: '第2問：現場の床に落ちていた「割れた砂時計」の砂が、水で濡れて固まっていた理由は？',
        hint: '氷が溶ける時間差を利用した仕掛け',
        choices: [
          '被害者が花瓶の水をこぼしたから',
          '氷が溶ける時間差で犯行時刻を偽装したから',
          '最初から湿った砂の不良品だったから',
        ],
        correctIndex: 1,
        explanation: '砂時計の上に氷を載せ、溶けた水で重心が崩れて落下・破損。犯人はアリバイのある時間に音を立てさせた。',
      },
      {
        id: 'm-q3',
        questionNumber: 3,
        prompt: '第3問：以上のトリックから導かれる、犯行が可能な唯一の人物は誰か？',
        hint: '事件直前に食堂から氷を持ち出した人物',
        choices: [
          '事件発生時に体育館にいた生徒',
          '図書室の場所を知らない新入生',
          '事件前に食堂から製氷皿を持ち出した人物',
        ],
        correctIndex: 2,
        explanation: '時間差トリックに使われた氷を事前に持ち出した人物こそが、密室とアリバイを仕組んだ真犯人である！',
      },
    ],
  },
  {
    id: 'course-logic',
    code: 'FILE 02',
    title: '電脳論理パラドックス',
    subtitle: '直感の罠を見破り、論理的思考で進め',
    difficulty: 'HARD',
    themeColor: '#F59E0B',
    questions: [
      {
        id: 'l-q1',
        questionNumber: 1,
        prompt: '第1問：暗い部屋にマッチが1本ある。部屋には「ろうそく」「石油ランプ」「暖炉」がある。最初に火をつけるべきものは？',
        hint: '他のものに火をつける前に必ず必要なアクション',
        choices: ['マッチ', '石油ランプ', 'ろうそく'],
        correctIndex: 0,
        explanation: 'まず手元の「マッチ」に火をつけなければ、どれにも火をつけることはできない。',
      },
      {
        id: 'l-q2',
        questionNumber: 2,
        prompt: '第2問：5台の機械で5個の部品を作るのに5分かかる。100台の機械で100個の部品を作るには何分かかる？',
        hint: '1台が1個作るのにかかる時間を考えよう',
        choices: ['100分', '5分', '20分'],
        correctIndex: 1,
        explanation: '1台の機械は5分で1個作る。100台が同時に作れば同じく「5分」で100個完成する。',
      },
      {
        id: 'l-q3',
        questionNumber: 3,
        prompt: '第3問：池のスイレンは毎日2倍に増える。48日目に池全体を覆った場合、池の半分を覆っていたのは何日目？',
        hint: '「毎日2倍」なら前日はどれだけ？',
        choices: ['24日目', '36日目', '47日目'],
        correctIndex: 2,
        explanation: '毎日2倍になるため、全体（100%）覆う48日目の1日前「47日目」に池の半分（50%）を覆っていた。',
      },
    ],
  },
  {
    id: 'course-trivia',
    code: 'FILE 03',
    title: '科学・雑学サバイバル',
    subtitle: '宇宙・人体・自然の知識で突破せよ',
    difficulty: 'EXTREME',
    themeColor: '#EC4899',
    questions: [
      {
        id: 't-q1',
        questionNumber: 1,
        prompt: '第1問：太陽系の惑星の中で、自転軸が約98度傾いて横倒しで公転している惑星はどれ？',
        hint: '青緑色の氷の巨星',
        choices: ['木星 (Jupiter)', '天王星 (Uranus)', '海王星 (Neptune)'],
        correctIndex: 1,
        explanation: '天王星（Uranus）は自転軸が約98度傾いており、ほぼ横倒しの状態で公転している。',
      },
      {
        id: 't-q2',
        questionNumber: 2,
        prompt: '第2問：人間の体内で最も硬い組織（モース硬度約6〜7相当）は次のうちどれ？',
        hint: '歯の最表面を覆う組織',
        choices: ['歯のエナメル質', '大腿骨（太ももの骨）', '頭蓋骨'],
        correctIndex: 0,
        explanation: '歯の表面を覆うエナメル質は96%が無機質で、人体で最も硬い組織である。',
      },
      {
        id: 't-q3',
        questionNumber: 3,
        prompt: '第3問：光の三原色（赤・緑・青）をすべて最大の強さで重ね合わせると何色になる？',
        hint: '加法混色（ディスプレイの原理）',
        choices: ['黒色 (Black)', '黄色 (Yellow)', '白色 (White)'],
        correctIndex: 2,
        explanation: '光の三原色は混ぜるほど明るくなる加法混色で、RGBが等量最大で「白色」になる。',
      },
    ],
  },
];

export function generateCourseHazards(): {
  pitfalls: PitfallZone[];
  obstacles: StageObstacle[];
} {
  const pitfalls: PitfallZone[] = [];
  const obstacles: StageObstacle[] = [];

  for (let stage = 0; stage < 3; stage++) {
    const baseZ = stage * STAGE_LENGTH;

    // --- 低難易度 PITFALLS (落とし穴: 回避しやすく安全地帯が広い) ---
    // 1. 中央落とし穴 (左と右に広い安全な道あり、SPACEジャンプでも楽々通過)
    pitfalls.push({
      id: `pit-${stage}-1`,
      stageIndex: stage,
      zStart: baseZ + 175,
      zEnd: baseZ + 192,
      uMin: -0.32,
      uMax: 0.32,
      label: '中央落とし穴（左右に回避可能）',
    });

    // 2. 片側落とし穴 (反対側が丸ごと安全地帯)
    pitfalls.push({
      id: `pit-${stage}-2`,
      stageIndex: stage,
      zStart: baseZ + 270,
      zEnd: baseZ + 288,
      uMin: stage % 2 === 0 ? -1.0 : 0.05,
      uMax: stage % 2 === 0 ? -0.05 : 1.0,
      label: '片側落とし穴（反対側安全・SPACEジャンプ可能）',
    });

    // --- 低難易度 OBSTACLES (障害物壁: 当たっても死なない、スペース広め) ---
    // 障害物1: 中央の小さな低バリア壁 (左右が大きく開いており、跳び越えも容易)
    obstacles.push({
      id: `obs-${stage}-1`,
      stageIndex: stage,
      z: baseZ + 135,
      zDepth: 2.0,
      uCenter: 0.0,
      uWidth: 0.45,
      height: 1.5,
      kind: 'barrier',
    });

    // 障害物2: 片側の壁柱 (トラックの大部分が開いているため直進でも避けやすい)
    obstacles.push({
      id: `obs-${stage}-2`,
      stageIndex: stage,
      z: baseZ + 225,
      zDepth: 2.5,
      uCenter: stage % 2 === 0 ? 0.55 : -0.55,
      uWidth: 0.3,
      height: 3.2,
      kind: 'pillar',
    });
  }

  return { pitfalls, obstacles };
}
