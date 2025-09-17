# GitHub PR Dashboard 

A simple, single-page dashboard to track the live CI/CD status of your GitHub Pull Requests.



---

## Local Setup

1.  **Get Files**
    * Download `index.html`, `style.css`, and `script.js` into a single folder.

2.  **Get GitHub Token**
    * Go to [GitHub Tokens](https://github.com/settings/tokens/new) and generate a new **Token (classic)**.
    * Give it the **`repo`** scope and copy the generated token.

3.  **Run Local Server**
    * Open a terminal in the project folder and run the command:
        ```bash
        python3 -m http.server
        ```
[or use Live Server option in VS Code]

4.  **Use the Dashboard**
    * Open your browser to **`http://localhost:8000`**.
    * Paste your token and click **Save**.
    * Add your PR URLs to begin tracking.