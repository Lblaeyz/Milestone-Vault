---
name: Wagmi RainbowKit demo WalletConnect warning
description: Expected 403 warning when using a placeholder WalletConnect projectId
---

## Rule
Using projectId: 'some-demo-string' in getDefaultConfig() triggers a 403 from Reown's config API. This is expected and harmless — RainbowKit falls back to local defaults and still works for MetaMask/injected wallets.

**Why:** WalletConnect requires a real registered projectId for full cloud features. For demos and hackathons this doesn't matter.

**How to apply:** Document this in the UI if judges see it. Consider using a real projectId from https://cloud.reown.com for production.
