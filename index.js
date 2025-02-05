#!/usr/bin/env node

const { execSync } = require("child_process");
const {
  readFileSync,
  existsSync,
  writeFileSync,
  mkdirSync,
  copyFileSync,
  readdirSync,
} = require("fs");
const { join, dirname, resolve } = require("path");
const { Command } = require("commander");
const { green, red, blue, yellow } = require("chalk");
const { fileURLToPath } = require("url");

const program = new Command();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEMPLATE_DIR = resolve(__dirname, "templates", "basic");

program
  .name("create-cotton-app")
  .version("1.0.0")
  .arguments("<appName>")
  .description("Create a new Cotton app")
  .action((appName) => {
    const appPath = resolve(appName);

    console.log(green(`Creating a new Cotton app in ${appPath}...`));

    if (existsSync(appPath)) {
      console.error(red(`Error: Directory "${appName}" already exists.`));
      process.exit(1);
    }

    console.log(blue("Copying template files..."));
    copyDirectory(TEMPLATE_DIR, appPath);

    console.log(blue("Customizing project files..."));
    const packageJsonPath = join(appPath, "package.json");
    const packageJsonContent = readFileSync(packageJsonPath, "utf8").replace(
      /{{appName}}/g,
      appName
    );
    writeFileSync(packageJsonPath, packageJsonContent);

    console.log(blue("Installing dependencies..."));
    execSync("npm install", { cwd: appPath, stdio: "inherit" });

    console.log(green("Cotton app created successfully!"));
    console.log(yellow(`\nNext steps:\n  cd ${appName}\n  npm run dev\n`));
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
