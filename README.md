### create-cotton-app CLI tool

##### Get the CLI tool

```bash
npm install -g create-cotton-app
```

##### Using the CLI tool to create a new app

```bash
create-cotton-app .
create-cotton-app my-awesome-project
```

CottonJS project will be created with basic template.

##### Go into your project directory and run

```bash
npm run dev
```

Development mode will also run a web socket server that watches files for changes. CottonJS will automatically reload the web browser for you.

##### To run your app in production

```bash
npm run prod
```

Production mode minifies the files. No web socket servers will be run.

##### Docker

If you have Docker desktop installed

```bash
docker compose build
docker compose up
```

##### Route Configuration

Routes can be configured in the route.config.js
Route parameters are also supported. Ex: user/:id
File extension will be automatically resolved (pages: .jsx or .tsx, loader: .js or .ts)

```js
{
    "/": {
        name: "home",
        page: "src/pages/Home"
        loader: "src/pages/Home.loader"
    },
    "/user/:id": {
        name: "user",
        page: "src/pages/User"
    }
}
```

##### Cotton Configuration

Configurations including port, hosts, build folder names can be configured in cotton.config.js

```js
export default {
  port: 3000,
  host: "localhost",
  build_folder: "build", //update .gitignore if changed
  static_assets_folder: "public",
  dev_env_websocket_port: 4522,
};
```
