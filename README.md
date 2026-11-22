# ORBIS

ORBIS is a mobile accessibility app built with Capacitor and plain JavaScript. It helps users describe their surroundings and access assistance features.

## Requirements

- Node.js and npm.
- Python 3 to run the local web server.
- JDK 21 and the Android SDK to build the Android app.

## Run and test

Install the JavaScript dependencies with `npm install`, then use these commands from the repository root:

```sh
npm run web
npm test
npm run android:debug
```

## Project structure

- `www/`: app HTML, stylesheets, and JavaScript modules.
- `tests/`: Playwright browser and screenshot tests.
- `android/`: Capacitor Android project.
- `apks/`: Android package files.
- `docs/`: project documentation and screenshots.
- `releases/`: release notes and installation information.
