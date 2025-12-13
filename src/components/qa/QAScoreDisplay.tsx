'use client';

interface QAReport {
    totalScore: number;
    scores: {
        layout: number;
        style: number;
        content: number;
    };
    improvements: string[];
    isPass: boolean;
}

interface QAScoreDisplayProps {
    report: QAReport | null;
    isLoading: boolean;
    onRetry?: () => void;
}

export function QAScoreDisplay({ report, isLoading, onRetry }: QAScoreDisplayProps) {
    if (isLoading) {
        return (
            <div className="p-4 rounded-2xl bg-black/40 border border-white/5 backdrop-blur-md animate-pulse">
                <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-zinc-400 font-medium">Analyzing Similarity...</span>
                </div>
            </div>
        );
    }

    if (!report) return null;

    const getColor = (score: number) => {
        if (score >= 85) return 'text-green-400';
        if (score >= 60) return 'text-yellow-400';
        return 'text-red-400';
    };

    const getBgColor = (score: number) => {
        if (score >= 85) return 'bg-green-500/20 border-green-500/30';
        if (score >= 60) return 'bg-yellow-500/20 border-yellow-500/30';
        return 'bg-red-500/20 border-red-500/30';
    };

    return (
        <div className="p-5 rounded-2xl bg-black/40 border border-white/5 backdrop-blur-md shadow-xl animate-fade-in-up">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-2">
                    <span>🔍</span> Similarity Score
                </h3>
                <div className={`px-3 py-1 rounded-full border text-sm font-bold font-mono ${getBgColor(report.totalScore)} ${getColor(report.totalScore)}`}>
                    {report.totalScore}%
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4">
                <ScoreItem label="Layout" score={report.scores.layout} />
                <ScoreItem label="Style" score={report.scores.style} />
                <ScoreItem label="Content" score={report.scores.content} />
            </div>

            {!report.isPass && (
                <div className="space-y-2 overflow-hidden animate-slide-down">
                    <div className="text-xs font-bold text-red-400 uppercase tracking-widest mb-2">Areas for Improvement</div>
                    <ul className="space-y-1">
                        {report.improvements.map((imp, i) => (
                            <li key={i} className="text-xs text-zinc-400 flex items-start gap-2">
                                <span className="mt-0.5 text-red-500">•</span>
                                {imp}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

function ScoreItem({ label, score }: { label: string, score: number }) {
    return (
        <div className="text-center p-2 rounded-lg bg-white/5 border border-white/5">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">{label}</div>
            <div className={`text-sm font-bold ${score < 80 ? 'text-zinc-400' : 'text-white'}`}>{score}</div>
        </div>
    );
}
