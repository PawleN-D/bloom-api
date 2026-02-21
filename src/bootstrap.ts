import { register } from "tsconfig-paths";

register({
  baseUrl: __dirname,
  paths: {
    "@/*": ["*"],
  },
});

import "./server";
