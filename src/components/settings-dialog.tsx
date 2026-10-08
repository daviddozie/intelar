"use client";

import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import {
  Monitor,
  Moon,
  Sun,
  UserRound,
  Eye,
  HardDrive,
  Palette,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  settingsSections,
  usePreferences,
  type SettingsSection,
} from "@/context/preferences-context";
import {
  getPendingAttempts,
  listStudyPacks,
} from "@/lib/offline-learning-store";

const sections: { id: SettingsSection; label: string; icon: typeof Palette }[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "account", label: "Account", icon: UserRound },
  { id: "accessibility", label: "Accessibility", icon: Eye },
  { id: "storage", label: "Data & storage", icon: HardDrive },
];

function SettingsSections() {
  const { data: session } = useSession();
  const {
    preferences,
    updatePreferences,
    status,
    retry,
    storageAvailable,
    closeSettings,
    settingsSection: section,
    setSettingsSection,
  } = usePreferences();
  const email = session?.user?.email ?? null;
  const storage = useQuery({
    queryKey: ["settings-storage", email ?? "guest"],
    queryFn: async () => {
      const [packs, attempts] = await Promise.all([
        listStudyPacks(email),
        getPendingAttempts(email),
      ]);
      return { packs: packs.length, attempts: attempts.length };
    },
    refetchInterval: false,
    staleTime: 0,
  });
  const statusText =
    status === "saving"
      ? "Saving…"
      : status === "saved"
        ? "Saved"
        : status === "local"
          ? storageAvailable
            ? "Saved on this device"
            : "Changes apply for this visit"
          : status === "loading"
            ? "Loading preferences…"
            : "Couldn’t sync";
  const choice =
    "cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current";
  const selected = "bg-foreground text-background border-foreground";
  const unselected = "border-foreground/15 hover:bg-foreground/5";
  return (
    <>
      <header className="border-b border-foreground/10 px-6 py-5 pr-14">
        <DialogTitle className="text-xl font-semibold">Settings</DialogTitle>
        <DialogDescription className="mt-2">
          Make Intelar feel right for you.
        </DialogDescription>
      </header>
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
        <nav
          aria-label="Settings sections"
          className="hidden w-48 shrink-0 space-y-1 border-r border-foreground/10 p-4 sm:block"
        >
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSettingsSection(id)}
              aria-current={section === id ? "page" : undefined}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-full px-3 py-2.5 text-left text-sm focus-visible:outline-2 ${section === id ? "bg-foreground/10 font-medium" : "text-muted-foreground hover:bg-foreground/5"}`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
        <div className="border-b border-foreground/10 px-6 py-3 sm:hidden">
          <label htmlFor="settings-section" className="sr-only">
            Settings section
          </label>
          <Select
            value={section}
            onValueChange={(value) => {
              if (settingsSections.some((item) => item === value)) {
                setSettingsSection(value as SettingsSection);
              }
            }}
          >
            <SelectTrigger
              id="settings-section"
              className="cursor-pointer rounded-full border-foreground/15 px-4"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent
              side="bottom"
              align="start"
              sideOffset={6}
              className="border-foreground/15 bg-background text-foreground"
            >
              {sections.map(({ id, label }) => (
                <SelectItem
                  key={id}
                  value={id}
                  className="cursor-pointer focus:bg-foreground/10 focus:text-foreground"
                >
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <section
          aria-label={sections.find((item) => item.id === section)?.label}
          className="min-w-0 flex-1 overflow-y-auto p-6 sm:p-8"
        >
          <h2 className="text-lg font-semibold">
            {sections.find((item) => item.id === section)?.label}
          </h2>
          {section === "appearance" && (
            <>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Choose a theme, or let Intelar follow your device.
              </p>
              <div
                role="group"
                aria-label="Theme"
                className="mt-6 grid grid-cols-3 gap-3"
              >
                {(
                  [
                    { value: "light", label: "Light", icon: Sun },
                    { value: "dark", label: "Dark", icon: Moon },
                    { value: "system", label: "System", icon: Monitor },
                  ] as const
                ).map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    aria-pressed={preferences.theme === value}
                    onClick={() => updatePreferences({ theme: value })}
                    className={`cursor-pointer rounded-2xl border p-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-4 ${preferences.theme === value ? "border-foreground ring-1 ring-foreground" : "border-foreground/15 hover:border-foreground/40"}`}
                  >
                    <div
                      aria-hidden="true"
                      className={`mb-3 h-20 overflow-hidden rounded-lg border border-black/10 p-2 ${value === "light" ? "bg-[#f5f5f5]" : value === "dark" ? "bg-[#111]" : "bg-[linear-gradient(90deg,#f5f5f5_50%,#111_50%)]"}`}
                    >
                      <div
                        className={`h-full w-1/4 rounded ${value === "dark" ? "bg-white/15" : "bg-black/15"}`}
                      />
                    </div>
                    <span className="flex items-center justify-center gap-2">
                      <Icon size={15} />
                      {label}
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
          {section === "account" && (
            <div className="mt-6 space-y-4">
              {session?.user ? (
                <>
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-foreground/10">
                      {session.user.image ? (
                        <Image
                          src={session.user.image}
                          alt="Your avatar"
                          width={56}
                          height={56}
                          unoptimized
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <UserRound size={24} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium">
                        {session.user.name ?? "Intelar user"}
                      </p>
                      <p className="break-all text-sm text-muted-foreground">
                        {session.user.email}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Your name, email, and avatar come from your sign-in account.
                    Manage these details with your sign-in provider.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm leading-6 text-muted-foreground">
                    You’re using Intelar as a guest. Sign in to sync your
                    preferences across devices and access your saved research.
                  </p>
                  <Link
                    href="/login"
                    onClick={closeSettings}
                    className={`${choice} inline-flex ${selected}`}
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>
          )}
          {section === "accessibility" && (
            <>
              <h3 className="mt-6 text-sm font-medium">Motion</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Reduce decorative animations and use instant scrolling. Loading
                and progress feedback will remain visible.
              </p>
              <div
                role="group"
                aria-label="Motion preference"
                className="mt-5 flex flex-wrap gap-2"
              >
                {(
                  [
                    { value: "system", label: "Follow device" },
                    { value: "reduced", label: "Reduced" },
                    { value: "full", label: "Full" },
                  ] as const
                ).map(({ value, label }) => (
                  <button
                    key={value}
                    aria-pressed={preferences.motion === value}
                    onClick={() => updatePreferences({ motion: value })}
                    className={`${choice} ${preferences.motion === value ? selected : unselected}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
          {section === "storage" && (
            <div className="mt-5 space-y-6 text-sm leading-6">
              <div>
                <h3 className="font-medium">Saved to your account</h3>
                <p className="mt-1 text-muted-foreground">
                  When signed in, your saved conversations, uploaded resources,
                  and personal preferences are associated with your account.
                </p>
              </div>
              <div>
                <h3 className="font-medium">On this device</h3>
                <p className="mt-1 text-muted-foreground">
                  Downloaded study packs and pending offline practice attempts
                  stay in this browser. Guest preferences are also stored here.
                </p>
              </div>
              {storage.isPending ? (
                <p role="status">Checking offline storage…</p>
              ) : storage.isError ? (
                <p role="alert">
                  Couldn’t read offline storage.{" "}
                  <button
                    className="cursor-pointer underline"
                    onClick={() => void storage.refetch()}
                  >
                    Retry
                  </button>
                </p>
              ) : (
                <dl className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
                  <div className="flex justify-between gap-3 py-3">
                    <dt>Downloaded study packs</dt>
                    <dd className="font-medium">{storage.data.packs}</dd>
                  </div>
                  <div className="flex justify-between gap-3 py-3">
                    <dt>Pending offline attempts</dt>
                    <dd className="font-medium">{storage.data.attempts}</dd>
                  </div>
                </dl>
              )}
              <p className="text-muted-foreground">
                Pending attempts sync through the existing learning flow when
                you’re online. Browser storage availability can affect
                downloads.
              </p>
              <Link
                href="/learn"
                onClick={closeSettings}
                className={`${choice} inline-flex ${unselected}`}
              >
                Manage downloads in Learn
              </Link>
            </div>
          )}
          {(section === "appearance" || section === "accessibility") && (
            <div
              aria-live="polite"
              className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
            >
              <span>{statusText}</span>
              {status === "error" && (
                <button
                  className="cursor-pointer rounded-full border border-foreground/20 px-3 py-1 text-foreground focus-visible:outline-2"
                  onClick={retry}
                >
                  Retry
                </button>
              )}
              {!storageAvailable && email && (
                <span>Browser caching is unavailable.</span>
              )}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default function SettingsDialog() {
  const { settingsOpen, closeSettings, settingsTrigger } = usePreferences();
  return (
    <Dialog
      open={settingsOpen}
      onOpenChange={(open) => {
        if (!open) closeSettings();
      }}
    >
      <DialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          settingsTrigger.current?.focus();
        }}
        className="flex h-dvh max-h-dvh max-w-full flex-col gap-0 rounded-none bg-background p-0 text-foreground sm:h-[540px] sm:max-h-[85dvh] sm:max-w-[780px] sm:rounded-2xl"
      >
        {settingsOpen && <SettingsSections />}
      </DialogContent>
    </Dialog>
  );
}
