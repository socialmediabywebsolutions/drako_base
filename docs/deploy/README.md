# Cloudflare Deployment Documentation

## Overview

This directory contains deployment documentation for Cloudflare Workers.

## Files

- **[cloudflare-workers-setup.md](./cloudflare-workers-setup.md)** - Complete setup guide for disabling Pages and configuring Workers deployment
- **[workers-deployment-guide.md](./workers-deployment-guide.md)** - Comprehensive Workers deployment reference

## Quick Start

### 1. Disable Cloudflare Pages

Dashboard → Pages → drako-base-3 → Settings → **Pause builds**

### 2. Configure GitHub Secrets

Add to GitHub repo Settings → Secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

### 3. Deploy

**Manual:**
```bash
npm run deploy
```

**Auto (push to main):**
```bash
git push origin main
```

See [cloudflare-workers-setup.md](./cloudflare-workers-setup.md) for detailed instructions.
