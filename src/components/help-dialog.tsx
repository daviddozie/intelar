"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ClipboardCheck,
  FileText,
  GraduationCap,
  MessageCircleQuestion,
  Search,
  UsersRound,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useHelp, type HelpTopic } from "@/context/help-context";

const guides: {
  id: HelpTopic;
  title: string;
  summary: string;
  icon: typeof BookOpen;
  searchText: string;
  steps: string[];
  actions: { label: string; href: string }[];
}[] = [
  {
    id: "overview",
    title: "Getting started",
    summary: "A quick guide to the main ways you can use Intelar.",
    icon: BookOpen,
    searchText: "start intro product research learn exams resources collaborate",
    steps: [
      "Research a question and follow the cited sources.",
      "Turn your course materials into a study path or practice exam.",
      "Save resources and collaborate with a group in a workspace.",
    ],
    actions: [
      { label: "Start researching", href: "/chat" },
      { label: "Explore learning", href: "/learn" },
    ],
  },
  {
    id: "research",
    title: "Research and chat",
    summary: "Ask questions, explore sources, and bring your own materials into a conversation.",
    icon: Search,
    searchText: "chat sources citations web upload documents conversation research",
    steps: [
      "Start a chat with a clear question; use follow-ups to narrow or compare ideas.",
      "Open cited sources to check important claims. AI-generated answers can be incorrect.",
      "Add a resource when you want Intelar to use your document as context.",
    ],
    actions: [
      { label: "Open chat", href: "/chat" },
      { label: "Browse resources", href: "/resources" },
    ],
  },
  {
    id: "learning",
    title: "Learning and study paths",
    summary: "Build a study path from your materials, then learn through lessons and practice.",
    icon: GraduationCap,
    searchText: "learn lessons course study path practice offline download progress",
    steps: [
      "Create a path from a learning goal and your course resources.",
      "Work through lessons and practice questions; revisit source references when you need context.",
      "Download supported lessons to continue studying offline. Live tutoring needs an internet connection.",
    ],
    actions: [
      { label: "Open learning", href: "/learn" },
      { label: "Find resources", href: "/resources" },
    ],
  },
  {
    id: "exam-prep",
    title: "Exam Prep",
    summary: "Create a timed practice exam grounded in your course materials.",
    icon: ClipboardCheck,
    searchText: "exam prep practice quiz questions timer difficulty course manual review score",
    steps: [
      "Choose a lecture manual or other course resource as the source.",
      "Select the question count, difficulty, and time limit, then create the practice exam.",
      "Answer before the timer ends, submit, and review your score with grounded explanations.",
    ],
    actions: [
      { label: "Open Exam Prep", href: "/exam-prep" },
      { label: "Browse resources", href: "/resources" },
    ],
  },
  {
    id: "resources",
    title: "Resources",
    summary: "Keep your materials organized and ready for research or study.",
    icon: FileText,
    searchText: "resource files upload documents pdf csv word organize folders study path",
    steps: [
      "Add documents you have permission to use, then organize them for easy access.",
      "Use a resource as context in a chat, learning path, or practice exam.",
      "Check that a document is the right course material before generating study content from it.",
    ],
    actions: [
      { label: "Open resources", href: "/resources" },
      { label: "Start a chat", href: "/chat" },
    ],
  },
  {
    id: "workspaces",
    title: "Workspaces",
    summary: "Share a place for your group’s resources and conversations.",
    icon: UsersRound,
    searchText: "workspace group collaborate invite people shared resources messages",
    steps: [
      "Open or create a workspace for your group.",
      "Invite collaborators and share relevant materials with the workspace.",
      "Use the shared conversation to discuss ideas with the workspace context.",
    ],
    actions: [{ label: "Open workspaces", href: "/workspaces" }],
  },
  {
    id: "account",
    title: "Account and privacy",
    summary: "Understand sign-in, saved preferences, and responsible use.",
    icon: MessageCircleQuestion,
    searchText: "account login sign in guest privacy data settings preferences theme",
    steps: [
      "You can try research chat and sample learning content without signing in; saved conversations and collaboration need an account.",
      "Appearance and accessibility preferences can be changed in Settings.",
      "Only upload materials you are authorized to use, and verify important AI-generated claims against their sources.",
    ],
    actions: [{ label: "Open chat", href: "/chat" }],
  },
];

export default function HelpDialog() {
  const {
    helpOpen,
    helpTopic,
    setHelpTopic,
    closeHelp,
    dismissHelpForNavigation,
  } = useHelp();
  const [search, setSearch] = useState("");
  const activeGuide = guides.find((guide) => guide.id === helpTopic) ?? guides[0];
  const filteredGuides = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return guides;
    return guides.filter((guide) =>
      `${guide.title} ${guide.summary} ${guide.searchText} ${guide.steps.join(" ")}`
        .toLowerCase()
        .includes(query),
    );
  }, [search]);

  return (
    <Dialog
      open={helpOpen}
      onOpenChange={(open) => {
        if (!open) closeHelp();
      }}
    >
      <DialogContent className="flex h-dvh max-h-dvh max-w-full flex-col gap-0 rounded-none bg-background p-0 text-foreground sm:h-140 sm:max-h-[85dvh] sm:max-w-200 sm:rounded-2xl">
        <header className="border-b border-foreground/10 px-6 py-5 pr-14">
          <DialogTitle className="text-xl font-semibold">Help</DialogTitle>
          <DialogDescription className="mt-2">
            Find a quick guide for using Intelar.
          </DialogDescription>
        </header>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <aside className="flex min-h-0 flex-col border-b border-foreground/10 sm:w-60 sm:shrink-0 sm:border-b-0 sm:border-r">
            <div className="p-4">
              <label htmlFor="help-search" className="sr-only">
                Search help topics
              </label>
              <div className="relative">
                <Search
                  size={16}
                  aria-hidden="true"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  id="help-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search help"
                  className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 pl-9 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
                />
              </div>
            </div>
            <nav
              aria-label="Help topics"
              className="flex gap-1 overflow-x-auto px-3 pb-3 sm:flex-1 sm:flex-col sm:overflow-y-auto"
            >
              {filteredGuides.map(({ id, title, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setHelpTopic(id)}
                  aria-current={helpTopic === id ? "page" : undefined}
                  className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-full px-3 py-2 text-left text-sm focus-visible:outline-2 sm:w-full ${helpTopic === id ? "bg-foreground/10 font-medium" : "text-muted-foreground hover:bg-foreground/5"}`}
                >
                  <Icon size={16} />
                  {title}
                </button>
              ))}
              {filteredGuides.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  No matching topics.
                </p>
              )}
            </nav>
          </aside>
          <section
            aria-label={activeGuide.title}
            className="min-w-0 flex-1 overflow-y-auto p-6 sm:p-8"
          >
            <h2 className="text-lg font-semibold">{activeGuide.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {activeGuide.summary}
            </p>
            <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-6">
              {activeGuide.steps.map((step) => (
                <li key={step} className="pl-1">
                  {step}
                </li>
              ))}
            </ol>
            <div className="mt-7 flex flex-wrap gap-2">
              {activeGuide.actions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  onClick={(event) => {
                    if (
                      event.button !== 0 ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    ) {
                      return;
                    }
                    dismissHelpForNavigation();
                  }}
                  className="inline-flex items-center justify-center rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
