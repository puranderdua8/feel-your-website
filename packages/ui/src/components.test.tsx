import { render } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
// Type-only side effect: augments Vitest's Assertion interface with
// `toHaveNoViolations` (the runtime matcher itself is registered globally by
// @feel-your-website/config's shared Vitest setup file).
import "vitest-axe/extend-expect";

import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Checkbox } from "./components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./components/ui/dropdown-menu";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { RadioGroup, RadioGroupItem } from "./components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import { Switch } from "./components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Textarea } from "./components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "./components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/ui/tooltip";

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

  it("Textarea", async () => {
    const { container } = render(<Textarea aria-label="Example textarea" />);
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });

  it("Checkbox", async () => {
    const { container } = render(
      <div>
        <Checkbox id="terms" />
        <Label htmlFor="terms">Accept terms</Label>
      </div>,
    );
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });

  it("Switch", async () => {
    const { container } = render(<Switch aria-label="Enable notifications" />);
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });

  it("RadioGroup", async () => {
    const { container } = render(
      <RadioGroup defaultValue="one" aria-label="Pick one">
        <div>
          <RadioGroupItem value="one" id="r-one" />
          <Label htmlFor="r-one">One</Label>
        </div>
        <div>
          <RadioGroupItem value="two" id="r-two" />
          <Label htmlFor="r-two">Two</Label>
        </div>
      </RadioGroup>,
    );
    expect(await axe(container, axeOptions)).toHaveNoViolations();
  });

  it("ToggleGroup", async () => {
    const { container } = render(
      <ToggleGroup type="single" defaultValue="bold" aria-label="Text style">
        <ToggleGroupItem value="bold" aria-label="Bold">
          B
        </ToggleGroupItem>
        <ToggleGroupItem value="italic" aria-label="Italic">
          I
        </ToggleGroupItem>
      </ToggleGroup>,
    );
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
