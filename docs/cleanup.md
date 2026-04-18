You are working on my existing project repository and you must do a **safe cleanup only**.
Goal: reduce project size significantly **without breaking the project**.

## Very important rules

* Do **NOT** delete source code.
* Do **NOT** delete `package.json`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`.
* Do **NOT** delete `.env`, `.env.*`, secrets, config files, migrations, assets, uploaded images, docs, database scripts, or any business logic files.
* Do **NOT** refactor code.
* Do **NOT** change runtime behavior.
* Do **NOT** remove anything unless it is clearly a generated/cache/build artifact that can be recreated safely.
* Before deleting anything, first inspect and list what is taking space.
* After cleanup, provide a report of exactly what was deleted and why.
* If there is any doubt about a folder, keep it.

## Cleanup scope

My repo has at least:

* `mobile-app`
* `web-panel`

Focus on removing only safe generated folders such as:

* `node_modules`
* `.next`
* `.expo`
* `.expo-shared`
* `dist`
* `build`
* temporary cache folders
* Android generated build/cache folders inside mobile app such as:

  * `android/.gradle`
  * `android/build`
  * `android/app/build`

## Safety-first workflow

1. Scan the repository and identify the largest directories/files.
2. Show me a short categorized summary before making destructive changes.
3. Clean only safe-to-regenerate files/folders.
4. Add or improve `.gitignore` rules so these generated folders are not tracked again.
5. Do **NOT** remove files already needed by the app at runtime unless they are generated artifacts.
6. Do **NOT** delete `android/` itself. Only generated subfolders inside it if safe.
7. Do **NOT** touch iOS/Android native source files except `.gradle` and generated build folders.
8. Preserve lockfiles and dependency manifests so reinstall is possible.

## Required .gitignore coverage

Ensure `.gitignore` includes appropriate entries like:

* `node_modules/`
* `.next/`
* `.expo/`
* `.expo-shared/`
* `dist/`
* `build/`
* `android/.gradle/`
* `android/build/`
* `android/app/build/`

But be careful not to ignore important source folders by mistake.

## Validation after cleanup

After cleanup:

* verify the repo structure still makes sense
* verify package manifests still exist
* tell me which install commands I should run later if needed
* give me a final before/after summary

## Output format

Return:

1. what you found
2. what you deleted
3. what you kept intentionally
4. updated `.gitignore` changes
5. exact commands I should run next to reinstall/regenerate safely

Proceed conservatively. Protect project integrity over aggressive cleanup.


If you are unsure whether something is generated or source, do not delete it.