function getCharacterNames(characters) {
  return Object.values(characters)
    .map(c => c.personality?.name)
    .filter(Boolean)
}

export function validate(scene, state, characters) {
  const violations = []

  const knownNames = getCharacterNames(characters)

  // Check for forbidden phrases
  const forbidden = [
    "suddenly appeared",
    "out of nowhere",
    "a creature emerged",
    "they realized what it was",
    "the source was revealed"
  ]

  forbidden.forEach(f => {
    if (scene.toLowerCase().includes(f)) {
      violations.push(`Forbidden phrase: "${f}"`)
    }
  })

  // Check for unknown names — extract capitalised words and test against known names
  // We look for capitalized words that are likely proper names (2+ letters, not at sentence start noise)
  const candidateNames = new Set()
  const namePattern = /\b([A-Z][a-z]{1,})\b/g
  let match

  while ((match = namePattern.exec(scene)) !== null) {
    candidateNames.add(match[1])
  }

  // Common English words that start with a capital but are not names
  const ignoreWords = new Set([
    "The", "A", "An", "In", "On", "At", "To", "Of", "And", "But", "Or",
    "For", "So", "Yet", "Nor", "He", "She", "It", "They", "We", "You",
    "His", "Her", "Its", "Their", "Our", "Your", "My", "This", "That",
    "These", "Those", "There", "Here", "When", "Where", "Why", "How",
    "What", "Who", "Which", "With", "From", "Into", "Over", "Under",
    "After", "Before", "Between", "During", "Through", "Without",
    "Suddenly", "Out", "Then", "Now", "Still", "Just", "Only", "Even",
    "No", "Not", "If", "As", "By", "Up", "Down", "Around", "About",
    "Controlled", "Free", "Low", "High", "Medium", "None", "True", "False",
    "Iteration", "Phase", "Scene", "Story", "Chapter"
  ])

  candidateNames.forEach(name => {
    if (!ignoreWords.has(name) && !knownNames.includes(name)) {
      violations.push(`Unknown name detected: "${name}" — not in character list`)
    }
  })

  return {
    valid: violations.length === 0,
    violations
  }
}