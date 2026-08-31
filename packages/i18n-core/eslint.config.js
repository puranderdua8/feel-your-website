import { reactConfig } from "@feel-your-website/config/eslint/react";

export default [...reactConfig, { ignores: ["dist/**"] }];
