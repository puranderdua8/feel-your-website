import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

const meta: Meta<typeof Dialog> = {
  title: "Registry/Dialog",
  component: Dialog,
};
export default meta;

type Story = StoryObj<typeof Dialog>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open dialog</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dialog title</DialogTitle>
          <DialogDescription>Dialog description goes here.</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  ),
};
