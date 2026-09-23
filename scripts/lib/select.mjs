import { APPLIES_TO } from './library.mjs';

// Which modes could apply to the surfaces in front of you. The caller decides
// that the file is a table; this decides which of 120 modes a table can
// exhibit. Keeping the second half here is what stops an audit from reading
// the whole index into context to answer it.
export function selectModes(modes, { kinds, categories, severities, excludeDetections } = {}) {
  const wanted = kinds && kinds.length ? new Set(kinds) : null;
  const inCategory = categories && categories.length ? new Set(categories) : null;
  const atSeverity = severities && severities.length ? new Set(severities) : null;
  const banned = excludeDetections && excludeDetections.length ? new Set(excludeDetections) : null;

  return modes
    .filter(({ data }) => {
      if (inCategory && !inCategory.has(data.category)) return false;
      if (atSeverity && !atSeverity.has(data.severity)) return false;
      if (banned && banned.has(data.detection)) return false;
      if (!wanted) return true;
      // `any` is a wildcard on the mode's side: a system-consistency failure
      // is not scoped to a surface, so it is a candidate whatever is on screen.
      return data.appliesTo.some((kind) => kind === 'any' || wanted.has(kind));
    })
    .sort((a, b) => a.data.id.localeCompare(b.data.id));
}

export function unknownKinds(kinds = []) {
  return kinds.filter((kind) => !APPLIES_TO.includes(kind));
}
