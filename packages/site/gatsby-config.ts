import { GatsbyConfig } from "gatsby";
import * as path from "path";

const gatsbyRequiredRules = path.join(
  process.cwd(),
  "node_modules",
  "gatsby",
  "dist",
  "utils",
  "eslint-rules"
);

const config: GatsbyConfig = {
  // This is required to make use of the React 17+ JSX transform.
  jsxRuntime: "automatic",

  plugins: [
    "gatsby-plugin-svgr",
    "gatsby-plugin-styled-components",
    {
      resolve: "gatsby-plugin-eslint",
      options: {
        name: "Template Snap",
        icon: "src/assets/logo.svg",
        theme_color: "#6F4CFF",
        background_color: "#FFFFFF",
        display: "standalone",
      },
    },
    {
      resolve: "gatsby-plugin-eslint",
      options: {
        // Gatsby required rules directory
        rulePaths: [gatsbyRequiredRules],
        // Default settings that may be omitted or customized
        stages: ["develop"],
        extensions: ["js", "jsx", "ts", "tsx"],
        exclude: ["node_modules", "bower_components", ".cache", "public"],
        // Any additional eslint-webpack-plugin options below
        // ...
      },
    },
  ],
};

export default config;
