"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";

export const helpTopics = [
  "overview",
  "research",
  "learning",
  "exam-prep",
  "resources",
  "workspaces",
  "account",
] as const;
export type HelpTopic = (typeof helpTopics)[number];

type HelpContextValue = {
  helpOpen: boolean;
  helpTopic: HelpTopic;
  openHelp: (topic?: HelpTopic) => void;
  setHelpTopic: (topic: HelpTopic) => void;
  closeHelp: () => void;
  dismissHelpForNavigation: () => void;
};

const HelpContext = createContext<HelpContextValue | null>(null);
const HELP_PARAM = "help";
const HELP_HISTORY_ENTRY = "__intelarHelpEntry";
const HELP_CHANGE_EVENT = "intelar-help-change";

function readHelpTopic(value: string | null): HelpTopic | null {
  return helpTopics.find((topic) => topic === value) ?? null;
}

function topicForPath(pathname: string): HelpTopic {
  if (pathname.startsWith("/learn")) return "learning";
  if (pathname.startsWith("/exam-prep")) return "exam-prep";
  if (pathname.startsWith("/resources")) return "resources";
  if (pathname.startsWith("/workspaces")) return "workspaces";
  if (pathname.startsWith("/chat") || pathname.startsWith("/c/")) {
    return "research";
  }
  return "overview";
}

function updateHelpUrl(topic: HelpTopic | null, push = false) {
  const url = new URL(window.location.href);
  if (topic) url.searchParams.set(HELP_PARAM, topic);
  else url.searchParams.delete(HELP_PARAM);

  const state =
    window.history.state && typeof window.history.state === "object"
      ? window.history.state
      : {};
  const nextState = { ...state };
  if (push) nextState[HELP_HISTORY_ENTRY] = true;
  else if (!topic) delete nextState[HELP_HISTORY_ENTRY];

  window.history[push ? "pushState" : "replaceState"](
    nextState,
    "",
    `${url.pathname}${url.search}${url.hash}`,
  );
  window.dispatchEvent(new Event(HELP_CHANGE_EVENT));
}

function getHelpSnapshot(): HelpTopic | null {
  return readHelpTopic(
    new URL(window.location.href).searchParams.get(HELP_PARAM),
  );
}

function subscribeToHelpUrl(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  window.addEventListener(HELP_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(HELP_CHANGE_EVENT, onChange);
  };
}

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const urlTopic = useSyncExternalStore(
    subscribeToHelpUrl,
    getHelpSnapshot,
    () => null,
  );
  const helpOpen = urlTopic !== null;
  const helpTopic = urlTopic ?? "overview";

  const openHelp = useCallback(
    (topic?: HelpTopic) => {
      const selectedTopic =
        topic ?? topicForPath(window.location.pathname);
      updateHelpUrl(selectedTopic, !helpOpen);
    },
    [helpOpen],
  );

  const setHelpTopic = useCallback((topic: HelpTopic) => {
    updateHelpUrl(topic);
  }, []);

  const closeHelp = useCallback(() => {
    if (window.history.state?.[HELP_HISTORY_ENTRY]) {
      window.history.back();
    } else {
      updateHelpUrl(null);
    }
  }, []);

  const dismissHelpForNavigation = useCallback(() => {
    updateHelpUrl(null);
  }, []);

  return (
    <HelpContext.Provider
      value={{
        helpOpen,
        helpTopic,
        openHelp,
        setHelpTopic,
        closeHelp,
        dismissHelpForNavigation,
      }}
    >
      {children}
    </HelpContext.Provider>
  );
}

export function useHelp() {
  const context = useContext(HelpContext);
  if (!context) throw new Error("useHelp must be used within HelpProvider");
  return context;
}
