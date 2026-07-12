/**
 * Product tours Ember can offer alongside a Docs Hub citation. Deliberately
 * small and honest: each `selector` below points at a `data-ember-tour`
 * attribute added to the real component in the same change that added it
 * here — nothing in this file is a guessed-at selector for DOM I haven't
 * actually looked at. Most DocSections have no tour yet; that's the
 * accurate state, not a bug — extending this file is the natural next step,
 * one verified page at a time, rather than guessing selectors for all 22
 * sections up front.
 */
export type EmberTourStep = {
  selector: string;
  title: string;
  description: string;
};

export type EmberTour = {
  /** Only offered when the user is already on a page matching this prefix —
   * Ember doesn't try to navigate-then-tour across pages in this pass. */
  pathPrefix: string;
  steps: EmberTourStep[];
};

export const EMBER_TOURS: Record<string, EmberTour> = {
  "sprint-board": {
    pathPrefix: "/board",
    steps: [
      {
        selector: '[data-ember-tour="board-new-issue"]',
        title: "Create a quick issue",
        description: "Opens the inline quick-create form right here on the board.",
      },
      {
        selector: '[data-ember-tour="board-columns"]',
        title: "Your sprint at a glance",
        description: "Each column is a status. Drag a card between columns to update it instantly.",
      },
    ],
  },
  "using-the-board": {
    pathPrefix: "/board",
    steps: [
      {
        selector: '[data-ember-tour="board-columns"]',
        title: "The board, grouped",
        description: "Switch the group-by (status/assignee/priority) via the URL or the view control to reshape this into swimlanes.",
      },
      {
        selector: '[data-ember-tour="board-new-issue"]',
        title: "Quick-create",
        description: "Fastest way to log something without leaving the board.",
      },
    ],
  },
  "api-keys": {
    pathPrefix: "/admin/api-keys",
    steps: [
      {
        selector: '[data-ember-tour="admin-api-keys-name"]',
        title: "Name it for what it's for",
        description: "A descriptive name (e.g. \"GitHub Actions CI\") makes it obvious later whether it's safe to revoke.",
      },
      {
        selector: '[data-ember-tour="admin-api-keys-scopes"]',
        title: "Only two scopes exist",
        description: "issues:read or issues:write — there's no broader scope to accidentally over-grant.",
      },
      {
        selector: '[data-ember-tour="admin-api-keys-create"]',
        title: "Create the key",
        description: "The raw key is shown once, immediately after this — copy it before closing the dialog.",
      },
    ],
  },
  "workspace-setup": {
    pathPrefix: "/admin/members",
    steps: [
      {
        selector: '[data-ember-tour="admin-members-invite"]',
        title: "Invite a teammate",
        description: "Pick their starting role here — Member, Viewer, or Admin. You can change it any time after.",
      },
    ],
  },
};
