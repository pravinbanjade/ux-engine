// A utility class's arbitrary value — bg-[#3b7d4f], p-[17px] — is the one
// context that looks substitutable and is not: turning it into a utility
// name needs a token-to-utility-family mapping no profile records, and
// inferring the family from the token's name is guesswork.
const ARBITRARY_OPEN = /-\[$/;

// Walking left from the literal, a property name followed by a colon, with
// no other declaration punctuation in between. True for a stylesheet rule,
// for the same text inside a template literal, and for a JS style object's
// quoted value — the three places `var()` is legal. A named call argument
// (`f(x: '17px')`) also matches; that is rare enough in JS to accept, and
// the preview gate is where it would be caught.
const DECLARATION_BEFORE = /(?:^|[{;,(])\s*['"`]?[-A-Za-z][-A-Za-z0-9]*['"`]?\s*:\s*[^:;{}]*$/;

export function substitutionFor({ lineText, column, value, token }) {
  const before = lineText.slice(0, column - 1);
  const after = lineText.slice(column - 1 + value.length);

  if (after.startsWith(']') && ARBITRARY_OPEN.test(before)) {
    return { manual: true, reason: 'arbitrary-utility-value' };
  }
  if (!DECLARATION_BEFORE.test(before)) {
    return { manual: true, reason: 'unsupported-context' };
  }
  return { text: `var(${token})` };
}
