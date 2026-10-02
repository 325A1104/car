import React, { useState } from 'react';
import { LogicCourse, QuizQuestion } from '../data/courses';
import { X, Check, RotateCcw } from 'lucide-react';

interface CustomQuizModalProps {
  initialCourse: LogicCourse;
  onSave: (customCourse: LogicCourse) => void;
  onClose: () => void;
}

export const CustomQuizModal: React.FC<CustomQuizModalProps> = ({
  initialCourse,
  onSave,
  onClose,
}) => {
  const [title, setTitle] = useState(initialCourse.title);
  const [questions, setQuestions] = useState<[QuizQuestion, QuizQuestion, QuizQuestion]>(() => [
    { ...initialCourse.questions[0], choices: [...initialCourse.questions[0].choices] as [string, string, string] },
    { ...initialCourse.questions[1], choices: [...initialCourse.questions[1].choices] as [string, string, string] },
    { ...initialCourse.questions[2], choices: [...initialCourse.questions[2].choices] as [string, string, string] },
  ]);
  const [activeTab, setActiveTab] = useState<0 | 1 | 2>(0);

  const currentQ = questions[activeTab];

  const updateQuestionField = <K extends keyof QuizQuestion>(field: K, value: QuizQuestion[K]) => {
    const next = [...questions] as [QuizQuestion, QuizQuestion, QuizQuestion];
    next[activeTab] = {
      ...next[activeTab],
      [field]: value,
    };
    setQuestions(next);
  };

  const updateChoice = (choiceIdx: 0 | 1 | 2, text: string) => {
    const nextChoices = [...currentQ.choices] as [string, string, string];
    nextChoices[choiceIdx] = text;
    updateQuestionField('choices', nextChoices);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...initialCourse,
      id: 'course-custom',
      code: 'CUSTOM',
      title: title.trim() || 'カスタムコース',
      subtitle: 'オリジナル全3問コース',
      questions,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-2xl bg-slate-900 border border-white/15 rounded-xl p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h2 className="text-xl font-bold font-display tracking-tight text-white">
              オリジナル3問クイズ作成・編集
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              全3問の問題文・3分岐の道（左・中央・右）・正解を設定できます
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              コースタイトル
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-950 border border-white/15 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-400"
              required
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-white/10">
            {([0, 1, 2] as const).map((idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveTab(idx)}
                className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-colors ${
                  activeTab === idx
                    ? 'bg-cyan-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                第{idx + 1}問
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                第{activeTab + 1}問の問題文
              </label>
              <textarea
                rows={2}
                value={currentQ.prompt}
                onChange={(e) => updateQuestionField('prompt', e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-white/15 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-400"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {(
                [
                  { idx: 0 as const, label: '左ルート [A]', color: 'text-cyan-400' },
                  { idx: 1 as const, label: '中央ルート [▲]', color: 'text-amber-400' },
                  { idx: 2 as const, label: '右ルート [D]', color: 'text-rose-400' },
                ]
              ).map(({ idx, label, color }) => {
                const isCorrect = currentQ.correctIndex === idx;
                return (
                  <div
                    key={idx}
                    className={`p-3 rounded-lg bg-slate-950 border ${
                      isCorrect ? 'border-emerald-400' : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={`text-xs font-semibold ${color}`}>{label}</span>
                      <button
                        type="button"
                        onClick={() => updateQuestionField('correctIndex', idx)}
                        className={`px-2 py-0.5 text-xs font-semibold rounded ${
                          isCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-white/10 text-slate-400'
                        }`}
                      >
                        {isCorrect ? '正解★' : '正解にする'}
                      </button>
                    </div>
                    <input
                      type="text"
                      value={currentQ.choices[idx]}
                      onChange={(e) => updateChoice(idx, e.target.value)}
                      className="w-full px-2 py-1 bg-slate-900 border border-white/10 rounded text-xs text-white"
                      required
                    />
                  </div>
                );
              })}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                ヒント
              </label>
              <input
                type="text"
                value={currentQ.hint}
                onChange={(e) => updateQuestionField('hint', e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-white/15 rounded-lg text-xs text-white"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-cyan-400 text-slate-950 text-xs font-bold rounded-lg hover:bg-cyan-300 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              この問題で決定
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
