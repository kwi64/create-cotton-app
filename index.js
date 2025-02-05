#!/usr/bin/env node

import { execSync } from "child_process";
import {
  readFileSync,
  existsSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
} from "fs";
import { join, dirname, resolve, basename } from "path";
import { Command } from "commander";
import chalk from "chalk";
import { fileURLToPath } from "url";

const program = new Command();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, "package.json");
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));

const TEMPLATE_DIR = resolve(__dirname, "templates", "basic");

program
  .name("create-cotton-app")
  .version(packageJson.version)
  .argument("[appName]", "Project name (default: current directory)")
  .description("Create a new Cotton app")
  .action((appName) => {
    const appPath = resolve(
      appName === "." || !appName ? process.cwd() : appName
    );
    const finalAppName =
      appName === "." || !appName ? basename(process.cwd()) : appName;

    console.log(chalk.green(`Creating a new Cotton app in ${appPath}...`));

    if (existsSync(appPath) && appPath !== process.cwd()) {
      console.error(chalk.red(`Error: Directory "${appName}" already exists.`));
      process.exit(1);
    }

    console.log(chalk.blue("Copying template files..."));
    copyDirectory(TEMPLATE_DIR, appPath);

    console.log(chalk.blue("Customizing project files..."));

    const packageJsonPath = join(appPath, "package.json");
    const packageJsonContent = readFileSync(packageJsonPath, "utf8").replace(
      /{{appName}}/g,
      finalAppName
    );
    writeFileSync(packageJsonPath, packageJsonContent);

    console.log(chalk.blue("Installing dependencies..."));

    execSync("npm install", { cwd: appPath, stdio: "inherit" });

    console.log(chalk.green("CottonJS app created successfully!"));
    console.log(
      chalk.yellow(`\nNext steps:\n  cd ${appPath}\n  npm run dev\n`)
    );
  });

program.parse(process.argv);

function copyDirectory(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}
