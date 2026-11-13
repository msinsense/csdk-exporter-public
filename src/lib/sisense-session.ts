interface PrismLike {
  user?: { _id?: string; roleName?: string; baseRoleName?: string };
}

type SisenseWindow = Window & { prism?: PrismLike };

/** Where the Sisense session came from: this page, the modal's parent, or the tab's opener. */
export type SessionSource = 'self' | 'parent' | 'opener';

function signedInPrism(win: Window | null | undefined): PrismLike | undefined {
  try {
    const prism = (win as SisenseWindow | null | undefined)?.prism;
    return prism?.user?._id ? prism : undefined;
  } catch {
    // Another origin: not a Sisense page we can use.
    return undefined;
  }
}

/**
 * Finds the signed-in Sisense page that opened this app (the modal's parent
 * or the tab's opener) and exposes its `prism` here, so Compose SDK's Fusion
 * auth can reuse that session. Returns null when there is none.
 */
export function adoptSisenseSession(win: Window = window): SessionSource | null {
  const self = win as SisenseWindow;
  if (signedInPrism(self)) return 'self';

  const hosts: [SessionSource, Window | null][] = [
    ['parent', win.parent],
    ['opener', win.opener as Window | null],
  ];
  for (const [source, host] of hosts) {
    if (!host || host === win) continue;
    const prism = signedInPrism(host);
    if (prism) {
      self.prism = prism;
      return source;
    }
  }
  return null;
}

/** The signed-in user's role, if a Sisense session was adopted. */
export function readSessionRole(win: Window = window): string | undefined {
  const user = signedInPrism(win)?.user;
  return user?.baseRoleName ?? user?.roleName;
}
