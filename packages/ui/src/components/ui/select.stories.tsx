import type { Meta, StoryObj } from "@storybook/react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

const meta: Meta<typeof Select> = {
  title: "Registry/Select",
  component: Select,
};
export default meta;

type Story = StoryObj<typeof Select>;

export const Default: Story = {
  render: () => (
    <Select defaultValue="apple">
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
        <SelectItem value="cherry">Cherry</SelectItem>
      </SelectContent>
    </Select>
  ),
};
