import React, { useState, useEffect } from "react";
import { X, Brain, RotateCcw, Check, Zap, FileText, ChevronRight } from "lucide-react";
import { Flashcard } from "../flashcards";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  dueCards: Flashcard[];
  onReviewCard: (card: Flashcard, grade: "hard" | "good" | "easy") => void;
  onNavigateToNote: (noteId: string) => void;
}

export default function ReviewModal({ isOpen, onClose, dueCards, onReviewCard, onNavigateToNote }: ReviewModalProps) {
  const [sessionCards, setSessionCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [typeInInputs, setTypeInInputs] = useState<string[]>([]);

  // Reset state and snapshot due cards when modal opens
  useEffect(() => {
    if (isOpen) {
      setSessionCards([...dueCards]);
      setCurrentIndex(0);
      setShowAnswer(false);
      setSelectedOption(null);
      setTypeInInputs([]);
    } else {
      setSessionCards([]);
    }
  }, [isOpen]);

  const card = sessionCards[currentIndex];

  useEffect(() => {
    if (card) {
      setTypeInInputs(card.answers ? new Array(card.answers.length).fill("") : []);
    }
  }, [currentIndex, card]);

  if (!isOpen) return null;

  const handleGrade = (grade: "hard" | "good" | "easy") => {
    const card = sessionCards[currentIndex];
    onReviewCard(card, grade);
    
    if (currentIndex < sessionCards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
      setSelectedOption(null);
    } else {
      // Finished: trigger finished screen show
      setCurrentIndex(currentIndex + 1);
    }
  };

  const isFinished = sessionCards.length === 0 || currentIndex >= sessionCards.length;

  const renderClozeAnswer = (answerText: string) => {
    const parts = answerText.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return (
          <span key={i} className="text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-1 rounded border-b-2 border-amber-500 font-bold mx-1">
            {part}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  // Renders a cloze sentence with each blank shown as a highlighted, fixed-width
  // pill. Before the answer is revealed the pill shows a masked placeholder;
  // once revealed it cross-fades into the actual word (no layout shift).
  const renderCloze = (answerText: string, revealed: boolean) => {
    const parts = answerText.split(/\*\*(.*?)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        const maskLength = Math.min(Math.max(part.length, 3), 10);
        return (
          <span
            key={i}
            className="relative inline-block mx-1 align-middle h-7"
            style={{ minWidth: `${maskLength * 0.62 + 1.6}rem` }}
          >
            <span
              className={`absolute inset-0 flex items-center justify-center px-2 rounded border-b-2 font-bold bg-amber-50 dark:bg-amber-900/30 border-amber-500 text-amber-400/70 dark:text-amber-500/60 tracking-widest transition-all duration-300 ease-out ${
                revealed ? "opacity-0 scale-75" : "opacity-100 scale-100"
              }`}
            >
              {"_".repeat(maskLength)}
            </span>
            <span
              className={`absolute inset-0 flex items-center justify-center px-2 rounded border-b-2 font-bold bg-amber-50 dark:bg-amber-900/30 border-amber-500 text-amber-600 dark:text-amber-400 transition-all duration-300 ease-out delay-150 ${
                revealed ? "opacity-100 scale-100" : "opacity-0 scale-75"
              }`}
            >
              {part}
            </span>
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const renderTypeInQuestion = () => {
    if (!card || !card.answers) return "";
    
    // We split card.question by [__input_N__]
    // The structure is e.g. "Столица Франции - [__input_0__], а Германии - [__input_1__]."
    const regex = /\[__input_(\d+)__\]/g;
    const parts = card.question.split(regex);
    
    return parts.map((part, i) => {
      // Every odd element is the index of the input
      if (i % 2 === 1) {
        const inputIdx = parseInt(part, 10);
        const isCorrect = typeInInputs[inputIdx]?.trim().toLowerCase() === card.answers?.[inputIdx]?.trim().toLowerCase();
        
        let borderClass = "border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 focus:border-indigo-500 focus:ring-indigo-500";
        if (showAnswer) {
          if (isCorrect) {
            borderClass = "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400";
          } else {
            borderClass = "border-red-500 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400";
          }
        }

        return (
          <span key={i} className="inline-flex flex-col items-center mx-1 align-middle">
            <input
              type="text"
              disabled={showAnswer}
              value={typeInInputs[inputIdx] || ""}
              onChange={(e) => {
                const newInputs = [...typeInInputs];
                newInputs[inputIdx] = e.target.value;
                setTypeInInputs(newInputs);
              }}
              placeholder="..."
              className={`px-2 py-0.5 rounded text-sm font-semibold border focus:outline-none transition-all duration-200 w-28 text-center ${borderClass}`}
            />
            {showAnswer && !isCorrect && (
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                (правильно: {card.answers?.[inputIdx]})
              </span>
            )}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col h-[500px]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 shrink-0">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-500" />
            <h2 className="text-sm font-bold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
              Review Session
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 flex flex-col items-center justify-center relative overflow-y-auto">
          {isFinished ? (
            <div className="text-center space-y-4 animate-in fade-in zoom-in duration-300">
              <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-100">All caught up!</h3>
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                You have reviewed all due cards for today.
              </p>
              <button 
                onClick={onClose}
                className="mt-4 px-6 py-2 bg-slate-800 dark:bg-zinc-100 text-white dark:text-slate-900 rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col">
              <div className="text-xs text-slate-400 dark:text-zinc-500 mb-2 text-center uppercase tracking-widest font-semibold flex items-center justify-center gap-2">
                <span>Card {currentIndex + 1} of {sessionCards.length}</span>
                {card.isReverseDirection && (
                  <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">Reversed</span>
                )}
              </div>
              
              <div className="flex justify-center mb-6">
                <button
                  onClick={() => {
                    onNavigateToNote(card.noteId);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300 font-semibold hover:underline bg-transparent border-none cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Go to note: {card.noteTitle}</span>
                </button>
              </div>
              
              <div className="flex-1 flex flex-col justify-center">
                <div className="text-lg md:text-xl font-medium text-slate-800 dark:text-zinc-100 text-center leading-relaxed whitespace-pre-wrap">
                  {card.type === "type-in"
                    ? renderTypeInQuestion()
                    : card.type === "cloze"
                    ? renderCloze(card.answer, showAnswer)
                    : card.question}
                </div>

                {card.type === "mcq" ? (
                  <div className="mt-8 flex flex-col gap-3 w-full max-w-sm mx-auto animate-in fade-in duration-300">
                    {card.options?.map((opt, i) => {
                      const isSelected = selectedOption === opt;
                      const isCorrect = opt === card.answer;
                      let btnClass = "px-4 py-3 rounded-xl border text-left font-medium transition-all duration-200 shadow-sm ";
                      
                      if (!selectedOption) {
                        btnClass += "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20";
                      } else {
                        if (isCorrect) {
                          btnClass += "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400";
                        } else if (isSelected && !isCorrect) {
                          btnClass += "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400";
                        } else {
                          btnClass += "border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-400 dark:text-zinc-600 opacity-50 cursor-not-allowed";
                        }
                      }
                      
                      return (
                        <button
                          key={i}
                          disabled={!!selectedOption}
                          onClick={() => setSelectedOption(opt)}
                          className={btnClass}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                              selectedOption 
                                ? (isCorrect ? 'border-emerald-500 bg-emerald-500 text-white' : isSelected ? 'border-red-500 bg-red-500 text-white' : 'border-slate-200 dark:border-zinc-700')
                                : 'border-slate-300 dark:border-zinc-600'
                            }`}>
                              {selectedOption && isCorrect && <Check className="w-3.5 h-3.5" />}
                              {selectedOption && isSelected && !isCorrect && <X className="w-3.5 h-3.5" />}
                            </div>
                            <span>{opt}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : card.type === "type-in" ? (
                  showAnswer && (
                    <>
                      <hr className="my-8 border-slate-200 dark:border-zinc-800 w-1/2 mx-auto" />
                      <div className="text-base md:text-lg text-slate-600 dark:text-zinc-300 text-center leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-300 whitespace-pre-wrap">
                        {renderClozeAnswer(card.answer)}
                      </div>
                    </>
                  )
                ) : card.type === "cloze" ? null : (
                  showAnswer && (
                    <>
                      <hr className="my-8 border-slate-200 dark:border-zinc-800 w-1/2 mx-auto" />
                      <div className="text-base md:text-lg text-slate-600 dark:text-zinc-300 text-center leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-300 whitespace-pre-wrap">
                        {card.answer}
                      </div>
                    </>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer / Controls */}
        {!isFinished && (
          <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 shrink-0 min-h-[72px]">
            {card.type === "mcq" ? (
              selectedOption ? (
                <button
                  onClick={() => handleGrade(selectedOption === card.answer ? "good" : "hard")}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm flex items-center justify-center gap-2 animate-in slide-in-from-bottom-2 fade-in duration-300"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : null
            ) : !showAnswer ? (
              <button
                onClick={() => setShowAnswer(true)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                Show Answer
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2 animate-in slide-in-from-bottom-2 fade-in duration-300">
                <button
                  onClick={() => handleGrade("hard")}
                  className="flex flex-col items-center justify-center p-2 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/30 transition-colors"
                >
                  <RotateCcw className="w-4 h-4 mb-1" />
                  <span className="text-xs font-bold uppercase">Hard</span>
                </button>
                <button
                  onClick={() => handleGrade("good")}
                  className="flex flex-col items-center justify-center p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/10 dark:hover:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 transition-colors"
                  autoFocus
                >
                  <Check className="w-4 h-4 mb-1" />
                  <span className="text-xs font-bold uppercase">Good</span>
                </button>
                <button
                  onClick={() => handleGrade("easy")}
                  className="flex flex-col items-center justify-center p-2 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/10 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/30 transition-colors"
                >
                  <Zap className="w-4 h-4 mb-1" />
                  <span className="text-xs font-bold uppercase">Easy</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
