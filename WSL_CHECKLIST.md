# WSL Health Checklist

If you prefer to build locally using WSL (Windows Subsystem for Linux), verify the following:

1.  **WSL 2 is active**:
    *   Run `wsl --status` in PowerShell.
    *   Ensure "Default Version: 2".

2.  **Distribution is installed and running**:
    *   Run `wsl --list --verbose`.
    *   State should be "Running".

3.  **Node.js is installed inside WSL**:
    *   Enter WSL: `wsl`
    *   Run: `node -v` (Should be v20.x, ideally matching host).
    *   Run: `npm -v`.

4.  **Project Files are accessible**:
    *   Navigate to your project path. 
    *   Current path `c:\CAMPAMENTO BASE DRAKO` is usually at `/mnt/c/CAMPAMENTO BASE DRAKO/...` in WSL.
    *   *Tip*: Using `/mnt/c` is slower. Clone repo directly into `~/` (Linux home) for 10x speed improvement.

5.  **Dependencies installed**:
    *   Run `npm install` **inside WSL** before trying to build. `node_modules` from Windows often don't work in Linux if they include binary bindings.

**Recommendation**: Use the **GitHub Actions** pipeline (`.github/workflows/build-worker.yml`) for the most reliable, reproducible builds.
