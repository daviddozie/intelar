"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, X, Send, Loader2 } from "lucide-react";
import type { LearningLesson } from "@/lib/learning-types";

interface TutorMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
}

interface LessonTutorDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    lesson: LearningLesson;
    courseId: string;
    theme?: "light" | "dark";
}

export default function LessonTutorDrawer({
    isOpen,
    onClose,
    lesson,
    courseId,
    theme = "dark",
}: LessonTutorDrawerProps) {
    const isDark = theme === "dark";
    const [messages, setMessages] = useState<TutorMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        // Reset or initialize welcoming greeting when lesson changes
        setMessages([
            {
                id: "welcome",
                role: "assistant",
                content: `Hello! I am your focused tutor for **${lesson.title}**.\n\nAsk me anything about the concepts, formulas, or practice questions in this lesson!`,
            },
        ]);
    }, [lesson.id, lesson.title]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, isLoading]);

    if (!isOpen) return null;

    async function handleSendMessage(textToSend?: string) {
        const query = (textToSend || input).trim();
        if (!query || isLoading) return;

        const userMsg: TutorMessage = { id: `u-${Date.now()}`, role: "user", content: query };
        const updatedHistory = [...messages, userMsg];
        setMessages(updatedHistory);
        setInput("");
        setIsLoading(true);

        const assistantMsgId = `a-${Date.now()}`;
        setMessages((prev) => [...prev, { id: assistantMsgId, role: "assistant", content: "" }]);

        try {
            const res = await fetch("/api/learning/tutor", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    pathId: courseId,
                    lessonId: lesson.id,
                    message: query,
                    history: messages
                        .filter((m) => m.id !== "welcome")
                        .map((m) => ({ role: m.role, content: m.content })),
                }),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Tutor service error (${res.status})`);
            }

            if (!res.body) throw new Error("No response stream");

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let accumulated = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                accumulated += decoder.decode(value, { stream: true });
                setMessages((prev) =>
                    prev.map((m) => (m.id === assistantMsgId ? { ...m, content: accumulated } : m))
                );
            }
        } catch (err: unknown) {
            const errorMsg = err instanceof Error ? err.message : "Tutor connection failed";
            setMessages((prev) =>
                prev.map((m) =>
                    m.id === assistantMsgId
                        ? { ...m, content: `*${errorMsg}. Please ensure you are connected.*` }
                        : m
                )
            );
        } finally {
            setIsLoading(false);
        }
    }

    const quickChips = [
        "Explain this in simpler terms",
        "Give me a hint for Question 1",
        "Can you share a campus example?",
    ];

    return (
        <aside
            aria-label={`Focused Lesson Tutor for ${lesson.title}`}
            className={`fixed inset-y-0 right-0 w-full sm:w-96 z-50 flex flex-col shadow-2xl border-l transition-transform ${
                isDark ? "bg-[#18181b] border-white/10 text-white" : "bg-white border-black/10 text-neutral-900"
            }`}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2.5">
                    <div className="flex items-center justify-center w-7 h-7 rounded-lg border border-border bg-muted/60 text-foreground">
                        <Bot className="w-4 h-4" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold">Focused Lesson Tutor</h2>
                        <span className="text-[11px] text-muted-foreground block truncate max-w-[200px]">
                            {lesson.title}
                        </span>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close tutor panel"
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs sm:text-sm">
                {messages.map((m) => (
                    <div
                        key={m.id}
                        className={`flex flex-col ${
                            m.role === "user" ? "items-end" : "items-start"
                        }`}
                    >
                        <div
                            className={`p-3 rounded-2xl max-w-[88%] leading-relaxed ${
                                m.role === "user"
                                    ? "bg-foreground text-background font-medium rounded-br-xs"
                                    : isDark
                                    ? "bg-muted/40 border border-border rounded-bl-xs text-neutral-200"
                                    : "bg-muted border border-border rounded-bl-xs text-neutral-800"
                            }`}
                        >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {m.content}
                            </ReactMarkdown>
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs py-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-foreground" />
                        <span className="ml-1">Tutor is thinking…</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggested Chips */}
            {messages.length <= 2 && (
                <div className="px-3 py-2 border-t border-border flex flex-wrap gap-1.5 bg-muted/20">
                    {quickChips.map((chip) => (
                        <button
                            key={chip}
                            type="button"
                            onClick={() => handleSendMessage(chip)}
                            className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                            {chip}
                        </button>
                    ))}
                </div>
            )}

            {/* Input Bar */}
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                }}
                className="p-3 border-t border-border flex items-center gap-2 bg-card"
            >
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`Ask about ${lesson.title}…`}
                    disabled={isLoading}
                    className="flex-1 rounded-xl px-3 py-2 text-xs border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    className="flex items-center justify-center p-2 rounded-xl bg-foreground text-background hover:opacity-85 disabled:opacity-40 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    aria-label="Send message"
                >
                    <Send className="w-3.5 h-3.5" />
                </button>
            </form>
        </aside>
    );
}
