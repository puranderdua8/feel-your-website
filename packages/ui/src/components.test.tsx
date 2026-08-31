import { render } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
// Type-only side effect: augments Vitest's Assertion interface with
// `toHaveNoViolations` (the runtime matcher itself is registered globally by
// @feel-your-website/config's shared Vitest setup file).
import "vitest-axe/extend-expect";

import { Badge } from "./components/badge/badge";
import { Button } from "./components/button/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/card/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./components/dialog/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./components/dropdown-menu/dropdown-menu";
import { Input } from "./components/input/input";
import { Label } from "./components/label/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/select/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/tabs/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./components/tooltip/tooltip";

// jsdom doesn't implement these; Radix's positioning / scroll-into-view
// logic touches them even when a portal-based primitive is just mounted
// open, without any real interaction.
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  window.HTMLElement.prototype.setPointerCapture = vi.fn();
  window.ResizeObserver =
    window.ResizeObserver ??
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
});

afterEach(() => {
  vi.restoreAllMocks();
});

// These stubs are rendered in isolation (no surrounding <main>/landmarks,
// no real page layout), and jsdom can't compute real color contrast — both
// of which trip axe rules that are about full-page structure/rendering
// rather than the component itself.
const axeOptions = {
  rules: {
    region: { enabled: false },
    "color-contrast": { enabled: false },
  },
};

/**
 * One shared a11y smoke test for every stub in the registry, rather than
 * ten near-identical files: render each component's default usage and
 * assert vitest-axe finds no violations. This proves the pipeline (Radix +
 * Tailwind classes + axe) works end-to-end; it does not replace a real,
 * interaction-level a11y audit per component (future work).
 */
describe("registry components — default render has no axe violations", () => {
  it("Button", async () => {
    const { container } = render(<Button>Click me</Button>);
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });

  it("Input", async () => {
    const { container } = render(<Input aria-label="Example input" />);
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });

  it("Label", async () => {
    const { container } = render(
      <>
        <Label htmlFor="example-input">Example label</Label>
        <Input id="example-input" />
      </>,
    );
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });

  it("Card", async () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
        </CardHeader>
        <CardContent>Content</CardContent>
      </Card>,
    );
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });

  it("Badge", async () => {
    const { container } = render(<Badge>Badge</Badge>);
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });

  it("Dialog", async () => {
    render(
      <Dialog defaultOpen>
        <DialogTrigger asChild>
          <Button>Open</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog title</DialogTitle>
            <DialogDescription>Dialog description</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    expect(await axe(document.body, axeOptions)).toHaveNoViolations();
  });

  it("DropdownMenu", async () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger asChild>
          <Button>Open menu</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem>Profile</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    expect(await axe(document.body, axeOptions)).toHaveNoViolations();
  });

  it("Select", async () => {
    render(
      <Select defaultValue="apple" defaultOpen>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">Apple</SelectItem>
          <SelectItem value="banana">Banana</SelectItem>
        </SelectContent>
      </Select>,
    );
    expect(await axe(document.body, axeOptions)).toHaveNoViolations();
  });

  it("Tabs", async () => {
    const { container } = render(
      <Tabs defaultValue="tab1">
        <TabsList>
          <TabsTrigger value="tab1">Tab 1</TabsTrigger>
          <TabsTrigger value="tab2">Tab 2</TabsTrigger>
        </TabsList>
        <TabsContent value="tab1">Content 1</TabsContent>
        <TabsContent value="tab2">Content 2</TabsContent>
      </Tabs>,
    );
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });

  it("Tooltip", async () => {
    render(
      <TooltipProvider>
        <Tooltip defaultOpen>
          <TooltipTrigger asChild>
            <Button>Hover me</Button>
          </TooltipTrigger>
          <TooltipContent>Tooltip text</TooltipContent>
        </Tooltip>
      </TooltipProvider>,
    );
    expect(await axe(document.body, axeOptions)).toHaveNoViolations();
  });
});
