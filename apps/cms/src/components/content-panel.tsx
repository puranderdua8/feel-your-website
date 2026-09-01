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
  deleteContentItem,
  deleteMessage,
  listContentItems,
  listMessages,
  saveContentItem,
  saveMessage,
} from "@/server/bff";
import type { Content } from "@feel-your-website/content-core";

import { LockedNotice } from "./locked-notice.js";

/**
 * Content items and messages, together: they are the same "CMS content"
 * concept from an author's point of view, even though `content-core` keeps
 * them as two separate tables and two separate `ContentWriter` methods (see
 * that interface's own doc). One panel, two lists.
 */
export function ContentPanel() {
  return (
    <Can permission="manage:content" fallback={<LockedNotice permission="manage:content" />}>
      <div className="flex flex-col gap-6">
        <ContentItems />
        <Messages />
      </div>
    </Can>
  );
}

function ContentItems() {
  const [items, setItems] = useState<readonly Content[]>([]);
  const [templateKey, setTemplateKey] = useState("");
  const [locale, setLocale] = useState("en");
  const [fieldsJson, setFieldsJson] = useState("{}");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function refresh() {
    setItems(await listContentItems());
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    let fields: Record<string, unknown>;
    try {
      fields = JSON.parse(fieldsJson) as Record<string, unknown>;
    } catch {
      setError("Fields must be valid JSON.");
      return;
    }

    setPending(true);
    try {
      await saveContentItem({ data: { templateKey, locale, fields } });
      setTemplateKey("");
      setFieldsJson("{}");
      await refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Save failed.");
    } finally {
      setPending(false);
    }
  }

  async function remove(item: Content) {
    await deleteContentItem({ data: { templateKey: item.templateKey, locale: item.locale } });
    await refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Content items</CardTitle>
        <CardDescription>
          One row per (template key, locale). `fields` is whatever the template renders.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {items.length === 0 && <li className="text-muted-foreground text-sm">No content yet.</li>}
          {items.map((item) => (
            <li
              key={`${item.templateKey}:${item.locale}`}
              className="border-border flex items-start justify-between gap-4 rounded-[var(--radius)] border p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {item.templateKey} <span className="text-muted-foreground">· {item.locale}</span>
                </p>
                <pre className="text-muted-foreground mt-1 max-w-full overflow-x-auto text-xs">
                  {JSON.stringify(item.fields)}
                </pre>
              </div>
              <Button variant="outline" size="sm" onClick={() => void remove(item)}>
                Delete
              </Button>
            </li>
          ))}
        </ul>

        <form className="flex flex-col gap-3" onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="content-template-key">Template key</Label>
              <Input
                id="content-template-key"
                required
                value={templateKey}
                onChange={(event) => setTemplateKey(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="content-locale">Locale</Label>
              <Input
                id="content-locale"
                required
                value={locale}
                onChange={(event) => setLocale(event.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="content-fields">Fields (JSON)</Label>
            <textarea
              id="content-fields"
              className="bg-background min-h-24 rounded-[var(--radius)] border border-[var(--input-border)] p-2 font-mono text-xs"
              value={fieldsJson}
              onChange={(event) => setFieldsJson(event.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending} className="self-start">
            Save item
          </Button>
        </form>
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
