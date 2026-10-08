"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  defaultPreferences,
  preferencesSchema,
  type UserPreferences,
} from "@/lib/user-preferences";
import { fetchSettings, saveSettings } from "@/lib/queries/settings";
import {
  readPreferencesCache,
  writePreferencesCache,
  type CachedPreferences,
} from "@/lib/preferences-storage";
import { queryKeys } from "@/lib/queries/keys";

type SaveStatus = "loading" | "saving" | "saved" | "local" | "error";
export const settingsSections = [
  "appearance",
  "account",
  "accessibility",
  "storage",
] as const;
export type SettingsSection = (typeof settingsSections)[number];
type PreferenceState = CachedPreferences & {
  status: SaveStatus;
  ready: boolean;
  storageAvailable: boolean;
};
type PreferenceContext = {
  preferences: UserPreferences;
  theme: "light" | "dark";
  reducedMotion: boolean;
  status: SaveStatus;
  storageAvailable: boolean;
  updatePreferences: (patch: Partial<UserPreferences>) => void;
  retry: () => void;
  openSettings: (trigger?: HTMLElement) => void;
  closeSettings: () => void;
  settingsOpen: boolean;
  settingsSection: SettingsSection;
  setSettingsSection: (section: SettingsSection) => void;
  settingsTrigger: React.RefObject<HTMLElement | null>;
};

const PreferencesContext = createContext<PreferenceContext | null>(null);
const SETTINGS_PARAM = "settings";
const SETTINGS_HISTORY_ENTRY = "__intelarSettingsEntry";

function getSettingsSection(value: string | null): SettingsSection | null {
  return settingsSections.find((section) => section === value) ?? null;
}

function updateSettingsUrl(section: SettingsSection | null, push = false) {
  const url = new URL(window.location.href);
  if (section) url.searchParams.set(SETTINGS_PARAM, section);
  else url.searchParams.delete(SETTINGS_PARAM);

  const currentState =
    window.history.state && typeof window.history.state === "object"
      ? window.history.state
      : {};
  const nextState = { ...currentState };
  if (push) nextState[SETTINGS_HISTORY_ENTRY] = true;
  else if (!section) delete nextState[SETTINGS_HISTORY_ENTRY];

  const method = push ? "pushState" : "replaceState";
  window.history[method](nextState, "", `${url.pathname}${url.search}${url.hash}`);
}

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const email =
    status === "authenticated" ? (session?.user?.email ?? null) : null;
  return (
    <AccountPreferences
      email={email}
      authLoading={status === "loading"}
    >
      {children}
    </AccountPreferences>
  );
}

function AccountPreferences({
  email,
  authLoading,
  children,
}: {
  email: string | null;
  authLoading: boolean;
  children: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(
    (current: PreferenceState, patch: Partial<PreferenceState>) => ({
      ...current,
      ...patch,
    }),
    {
      preferences: defaultPreferences,
      pending: false,
      status: "loading",
      ready: false,
      storageAvailable: true,
    },
  );
  const latest = useRef(defaultPreferences);
  const revision = useRef(0);
  const pendingPatch = useRef<Partial<UserPreferences>>({});
  const initialized = useRef(false);
  const mounted = useRef(true);
  const [systemDark, setSystemDark] = useState(false);
  const [systemReduced, setSystemReduced] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSectionState] =
    useState<SettingsSection>("appearance");
  const settingsTrigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const syncSettingsFromUrl = () => {
      const section = getSettingsSection(
        new URL(window.location.href).searchParams.get(SETTINGS_PARAM),
      );
      setSettingsOpen(section !== null);
      if (section) setSettingsSectionState(section);
    };
    syncSettingsFromUrl();
    window.addEventListener("popstate", syncSettingsFromUrl);
    return () => window.removeEventListener("popstate", syncSettingsFromUrl);
  }, []);
  const key = queryKeys.settings.detail(email ?? "guest");
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => fetchSettings(signal),
    enabled: Boolean(email) && !authLoading,
    refetchOnWindowFocus: true,
  });
  const mutation = useMutation({
    scope: { id: `settings:${email ?? "guest"}` },
    mutationFn: async (input: {
      preferences: UserPreferences;
      revision: number;
      patch?: Partial<UserPreferences>;
    }) => {
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      if (!mounted.current) throw new Error("Account changed");
      return saveSettings(input.patch ?? input.preferences);
    },
    onSuccess: (preferences, input) => {
      if (!mounted.current || input.revision !== revision.current) return;
      pendingPatch.current = {};
      latest.current = preferences;
      queryClient.setQueryData(key, preferences);
      const storageAvailable = writePreferencesCache(email, {
        preferences,
        pending: false,
      });
      dispatch({
        preferences,
        pending: false,
        status: "saved",
        storageAvailable,
      });
    },
    onError: (_error, input) => {
      if (mounted.current && input.revision === revision.current)
        dispatch({ status: "error" });
    },
  });
  const mutate = mutation.mutate;

  useEffect(() => {
    mounted.current = true;
    const cached = readPreferencesCache(email);
    latest.current = cached.preferences;
    pendingPatch.current = cached.pending
      ? (cached.patch ?? cached.preferences)
      : {};
    dispatch({
      ...cached,
      ready: true,
      status: email ? (cached.pending ? "error" : "loading") : "local",
    });
    return () => {
      mounted.current = false;
    };
  }, [email]);

  useEffect(() => {
    const dark = window.matchMedia("(prefers-color-scheme: dark)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateDark = () => setSystemDark(dark.matches);
    const updateReduced = () => setSystemReduced(reduced.matches);
    updateDark();
    updateReduced();
    dark.addEventListener("change", updateDark);
    reduced.addEventListener("change", updateReduced);
    return () => {
      dark.removeEventListener("change", updateDark);
      reduced.removeEventListener("change", updateReduced);
    };
  }, []);

  useEffect(() => {
    if (!email || !state.ready || query.data === undefined || state.pending)
      return;
    if (query.data === null) {
      if (initialized.current) return;
      initialized.current = true;
      revision.current += 1;
      pendingPatch.current = latest.current;
      const storageAvailable = writePreferencesCache(email, {
        preferences: latest.current,
        pending: true,
      });
      dispatch({ pending: true, status: "saving", storageAvailable });
      mutate({ preferences: latest.current, revision: revision.current });
    } else {
      latest.current = query.data;
      const storageAvailable = writePreferencesCache(email, {
        preferences: query.data,
        pending: false,
      });
      dispatch({ preferences: query.data, status: "saved", storageAvailable });
    }
  }, [email, state.ready, state.pending, query.data, mutate]);

  useEffect(() => {
    if (query.error && !state.pending) dispatch({ status: "error" });
  }, [query.error, state.pending]);

  const theme =
    state.preferences.theme === "system"
      ? systemDark
        ? "dark"
        : "light"
      : state.preferences.theme;
  const reduced =
    state.preferences.motion === "reduced" ||
    (state.preferences.motion === "system" && systemReduced);
  useEffect(() => {
    if (!state.ready) return;
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.add("theme-transition");
    root.style.colorScheme = theme;
    root.dataset.motion = state.preferences.motion;
    root.dataset.reducedMotion = String(reduced);
  }, [theme, reduced, state.preferences.motion, state.ready]);

  const updatePreferences = useCallback(
    (patch: Partial<UserPreferences>) => {
      const preferences = preferencesSchema.parse({
        ...latest.current,
        ...patch,
      });
      latest.current = preferences;
      pendingPatch.current = { ...pendingPatch.current, ...patch };
      revision.current += 1;
      const storageAvailable = writePreferencesCache(email, {
        preferences,
        pending: Boolean(email),
        patch: email ? pendingPatch.current : undefined,
      });
      dispatch({
        preferences,
        pending: Boolean(email),
        status: email ? "saving" : "local",
        storageAvailable,
      });
      if (email)
        mutate({
          preferences,
          revision: revision.current,
          patch: { ...pendingPatch.current },
        });
    },
    [email, mutate],
  );

  const retry = () => {
    if (state.pending && email) {
      revision.current += 1;
      dispatch({ status: "saving" });
      mutate({
        preferences: latest.current,
        revision: revision.current,
        patch: { ...pendingPatch.current },
      });
    } else {
      dispatch({ status: "loading" });
      void query.refetch();
    }
  };

  return (
    <PreferencesContext.Provider
      value={{
        preferences: state.preferences,
        theme,
        reducedMotion: reduced,
        status: state.status,
        storageAvailable: state.storageAvailable,
        updatePreferences,
        retry,
        settingsOpen,
        settingsSection,
        setSettingsSection: (section) => {
          setSettingsSectionState(section);
          if (settingsOpen) updateSettingsUrl(section);
        },
        settingsTrigger,
        openSettings: (trigger) => {
          settingsTrigger.current =
            trigger ?? (document.activeElement as HTMLElement);
          updateSettingsUrl(settingsSection, !settingsOpen);
          setSettingsOpen(true);
        },
        closeSettings: () => {
          setSettingsOpen(false);
          if (window.history.state?.[SETTINGS_HISTORY_ENTRY]) {
            window.history.back();
          } else {
            updateSettingsUrl(null);
          }
        },
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context)
    throw new Error("usePreferences must be used within PreferencesProvider");
  return context;
}
