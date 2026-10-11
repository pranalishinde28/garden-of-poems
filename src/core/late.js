// Late-bound names.
//
// The app used to be one script, and its sections ran top to bottom. As ES modules, each section
// imports names from earlier sections normally. A section that needs something from a later one,
// or that reassigns another section's variable, reaches it through `late` instead: a later import
// would make that module run first and break the old order (see the TDZ trap in CLAUDE.md).
// Each module registers getters (and setters for reassigned lets) with provide(), at its top.
export const late = {};
export function provide(names) { Object.defineProperties(late, Object.getOwnPropertyDescriptors(names)); }
