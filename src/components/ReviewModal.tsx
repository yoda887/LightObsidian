import React, { useState, useEffect } from "react";
import { X, Brain, RotateCcw, Check, Zap } from "lucide-react";
import { Flashcard } from "../flashcards";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  dueCards: Flashcard[];
  onReviewCard: (card: Flashcard, grade: "hard" | "good" | "easy") => void;
}

export default function ReviewModal({ isOpen, onClose, dueCards, onReviewCard }: ReviewModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setShowAnswer(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGrade = (grade: "hard" | "good" | "easy") => {
    const card = dueCards[currentIndex];
    onReviewCard(card, grade);
    
    if (currentIndex < dueCards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setShowAnswer(false);
    } else {
      // Finished
      onClose();
    }
  };

  const card = dueCards[currentIndex];
  const isFinished = dueCards.length === 0 || currentIndex >= dueCards.length;

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
              <div className="text-xs text-slate-400 dark:text-zinc-500 mb-6 text-center uppercase tracking-widest font-semibold">
                Card {currentIndex + 1} of {dueCards.length}
              </div>
              
              <div className="flex-1 flex flex-col justify-center">
                <div className="text-lg md:text-xl font-medium text-slate-800 dark:text-zinc-100 text-center leading-relaxed">
                  {card.question}
                </div>

                {showAnswer && (
                  <>
                    <hr className="my-8 border-slate-200 dark:border-zinc-800 w-1/2 mx-auto" />
                    <div className="text-base md:text-lg text-slate-600 dark:text-zinc-300 text-center leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-300">
                      {card.answer}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer / Controls */}
        {!isFinished && (
          <div className="p-4 border-t border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 shrink-0">
            {!showAnswer ? (
              <button
                onClick={() => setShowAnswer(true)}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                Show Answer
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2">
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
