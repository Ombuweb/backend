// @ts-check

import tseslint from 'typescript-eslint';

export default tseslint.config(
  tseslint.configs.recommended,
  {
    ignores: ["node_modules", ".serverless/build", "coverage", "babel.config.js", "jest.config.js"], // No need to lint these files as they are not part of the source code

  }
);