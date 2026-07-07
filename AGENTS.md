# Codex Project Policy

## Scope

This repository is the official project folder for the public app.

Formal app changes must be made only inside:

```text
codex-work\情報知識問題\github_publish\info1-quiz-app
```

Older development folders, reference-material folders, prototype folders, and backup folders may be read when needed, but must not be changed unless the user explicitly asks for that.

These instructions apply to this repository and the files below this directory.

## Public Release Policy

This app is intended to be published as a public web app through GitHub.

Assume that making the GitHub repository public will expose the following to third parties:

- HTML, CSS, JavaScript, Python, and other source code
- question data
- correct answers, explanations, and classification metadata
- README and project documentation
- commit history
- any other files committed to GitHub

Before making any change, check whether the changed content is safe to publish.

## Security And Privacy

Do not include the following in source code, question data, README, settings, commits, or history:

- API keys
- access tokens
- administrator keys
- database passwords
- private keys
- personal information
- internal school or workplace information
- local absolute paths that include a personal user name
- materials or files without permission to publish
- temporary files, logs, or backups
- third-party assets with unclear license or usage terms

If a feature requires secret information, do not place it directly in the frontend or GitHub repository. Propose environment variables or another safe external secret-management method instead.

## Question Data

Treat question data as public-release content.

Do not change existing question text, choices, correct answers, explanations, or source metadata unless the user explicitly requests it.

For content based on public third-party exam questions, pay attention to source attribution, whether the question has been adapted, and applicable usage terms.

## Git Operations

This folder corresponds to:

```text
https://github.com/mei-chan-nel/info1-quiz-app
```

Treat the `main` branch as the official release branch.

Before committing or pushing, confirm that:

- the work is limited to the official project folder
- no unintended files are staged or committed
- no secrets or personal information are included
- question data has not changed unintentionally
- the app works normally
- static hosting such as GitHub Pages will not break because of the change

