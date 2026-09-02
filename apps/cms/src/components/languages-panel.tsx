import type { SiteLocale } from "@feel-your-website/content-core";
import { Can } from "@feel-your-website/rbac/react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@feel-your-website/ui";
import { useEffect, useState, type FormEvent } from "react";

import {
  listMessages,
  listSiteLocales,
  saveMessage,
  deleteMessage,
  saveSiteLocales,
} from "@/server/bff";

import { LockedNotice } from "./locked-notice.js";

/**
 * Languages: the configured content-locale set (the header switcher and the
 * publish gate iterate it) and the UI-chrome message catalog. Both are
 * `manage:content`.
 */
export function LanguagesPanel() {
  return (
    <Can permission="manage:content" fallback={<LockedNotice permission="manage:content" />}>
      <div className="flex flex-col gap-6">
        <ContentLocales />
        <Messages />
      </div>
    </Can>
  );
}

function ContentLocales() {
  const [locales, setLocales] = useState<SiteLocale[]>([]);
  const [locale, setLocale] = useState("");
  const [label, setLabel] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void listSiteLocales().then((list) => setLocales([...list]));
  }, []);

  function addRow(event: FormEvent) {
    event.preventDefault();
    const tag = locale.trim();
    if (tag === "" || locales.some((l) => l.locale === tag)) return;
    setLocales((current) => [...current, { locale: tag, label: label.trim() || tag }]);
    setLocale("");
    setLabel("");
    setSaved(false);
  }

  function removeRow(tag: string) {
    setLocales((current) => current.filter((l) => l.locale !== tag));
    setSaved(false);
  }

  function move(index: number, delta: number) {
    setLocales((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
    setSaved(false);
  }

  async function save() {
    setPending(true);
    setError(null);
    try {
      const persisted = await saveSiteLocales({ data: { locales } });
      setLocales([...persisted]);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Content languages</CardTitle>
        <CardDescription>
          The first entry is the default. Every published route needs content in each of these.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {locales.map((entry, index) => (
            <li
              key={entry.locale}
              className="border-border flex items-center justify-between gap-3 rounded-[var(--radius)] border p-3"
            >
              <span className="text-sm">
                <code>{entry.locale}</code> · {entry.label}
                {index === 0 && <span className="text-muted-foreground"> — default</span>}
              </span>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label="Move up"
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={index === locales.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label="Move down"
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={locales.length === 1}
                  onClick={() => removeRow(entry.locale)}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>

        <form className="grid grid-cols-[1fr_1fr_auto] items-end gap-3" onSubmit={addRow}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="locale-tag">BCP-47 tag</Label>
            <Input
              id="locale-tag"
              placeholder="fr"
              value={locale}
              onChange={(event) => setLocale(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="locale-label">Label</Label>
            <Input
              id="locale-label"
              placeholder="Français"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline">
            Add
          </Button>
        </form>

        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <div className="flex items-center gap-3">
          <Button type="button" disabled={pending} onClick={() => void save()}>
            Save languages
          </Button>
          {saved && <span className="text-sm text-emerald-600">Saved.</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function Messages() {
  const [messages, setMessages] = useState<Readonly<Record<string, string>>>({});
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);

  async function refresh() {
    setMessages(await listMessages({ data: { locale: "en" } }));
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      await saveMessage({ data: { locale: "en", key, value } });
      setKey("");
      setValue("");
      await refresh();
    } finally {
      setPending(false);
    }
  }

  async function remove(messageKey: string) {
    await deleteMessage({ data: { locale: "en", key: messageKey } });
    await refresh();
  }

  const entries = Object.entries(messages).sort(([a], [b]) => a.localeCompare(b));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Messages</CardTitle>
        <CardDescription>UI chrome text — `en` only, for now.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {entries.length === 0 && (
            <li className="text-muted-foreground text-sm">No messages yet.</li>
          )}
          {entries.map(([messageKey, messageValue]) => (
            <li
              key={messageKey}
              className="border-border flex items-start justify-between gap-4 rounded-[var(--radius)] border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">{messageKey}</p>
                <p className="text-muted-foreground text-sm">{messageValue}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => void remove(messageKey)}>
                Delete
              </Button>
            </li>
          ))}
        </ul>

        <form
          className="grid grid-cols-[1fr_1fr_auto] items-end gap-3"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="message-key">Key</Label>
            <Input
              id="message-key"
              required
              value={key}
              onChange={(event) => setKey(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="message-value">Value</Label>
            <Input
              id="message-value"
              required
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </div>
          <Button type="submit" disabled={pending}>
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
