// The wireframe artifact: every rule about its *shape*. Rules about whether an
// answer is thoughtful or a hierarchy is right belong to skills/ux-design, not
// here — a validator that graded judgment would be inventing policy.

export const WIREFRAME_VERSION = 1;

export const INTENT_KEYS = ['who', 'cadence', 'primaryAction', 'failure', 'scale'];

// Deliberately shallow. Its job is to catch the answer that was never given,
// not to grade the one that was.
const MIN_ANSWER_LENGTH = 12;
const NON_ANSWERS = new Set(['n/a', 'na', 'tbd', 'todo', 'unknown', 'none', '?', '-']);

export function slugify(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
}

export function validateIntent(intent, prefix = 'intent') {
  if (!intent || typeof intent !== 'object' || Array.isArray(intent)) {
    return [`${prefix}: must be an object`];
  }
  const errors = [];
  for (const key of INTENT_KEYS) {
    const raw = intent[key];
    if (typeof raw !== 'string' || !raw.trim()) {
      errors.push(`${prefix}.${key}: not answered`);
      continue;
    }
    const answer = raw.trim();
    if (NON_ANSWERS.has(answer.toLowerCase())) {
      errors.push(`${prefix}.${key}: "${answer}" is a placeholder, not an answer`);
      continue;
    }
    if (answer.length < MIN_ANSWER_LENGTH) {
      errors.push(`${prefix}.${key}: "${answer}" is too short to be an answer`);
    }
  }
  return errors;
}
