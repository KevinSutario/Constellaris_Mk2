// tokenToName: { "CHARACTER_001": "Park Jisoo", ... }
// We only need this to know which tokens are valid.

export function validate(rawScene, tokenToName) {
  const violations = []

  const validTokens = new Set(Object.keys(tokenToName))

  // Check for forbidden phrases
  const forbidden = [
    "suddenly appeared",
    "out of nowhere",
    "a creature emerged",
    "they realized what it was",
    "the source was revealed"
  ]

  forbidden.forEach(f => {
    if (rawScene.toLowerCase().includes(f)) {
      violations.push(`Forbidden phrase: "${f}"`)
    }
  })

  // Find any CHARACTER_XXX-style tokens the AI used and check they are all valid.
  // This catches the AI inventing tokens like CHARACTER_006 when only 5 exist.
  const usedTokens = rawScene.match(/CHARACTER_\d+/g) || []
  const uniqueUsed = new Set(usedTokens)

  uniqueUsed.forEach(token => {
    if (!validTokens.has(token)) {
      violations.push(`Unknown token used: "${token}" — not in character list`)
    }
  })

  // Check the AI didn't leak any real names back into the output.
  // We check tokenToName values (the real names) against the raw scene.
  Object.values(tokenToName).forEach(name => {
    if (rawScene.includes(name)) {
      violations.push(`Real name leaked into output: "${name}" — should be a token`)
    }
  })

  return {
    valid: violations.length === 0,
    violations
  }
}