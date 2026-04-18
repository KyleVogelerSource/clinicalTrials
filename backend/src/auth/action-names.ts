export const ACTION_NAMES = {
  userRoles: "user_roles",
  savedSearchesViewShared: "saved_searches_view_shared",
  trialBenchmarking: "trial_benchmarking",
  searchCriteriaImport: "search_criteria_import",
  searchCriteriaExport: "search_criteria_export",
} as const;

export type ActionName = typeof ACTION_NAMES[keyof typeof ACTION_NAMES];
