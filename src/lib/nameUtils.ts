/**
 * Utility functions for name formatting
 */

/**
 * Converts text to title case, handling Brazilian prepositions properly
 * Examples: 
 * "FERNANDO DOS SANTOS" -> "Fernando dos Santos"
 * "MARIA DA SILVA JUNIOR" -> "Maria da Silva Junior"
 */
export function toTitleCase(text: string): string {
  if (!text) return text;
  
  // Brazilian prepositions that should remain lowercase
  const prepositions = new Set([
    'da', 'de', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos',
    'a', 'o', 'as', 'os', 'para', 'por', 'com', 'sem'
  ]);
  
  return text
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      // First word is always capitalized
      if (index === 0) {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }
      
      // Check if it's a preposition
      if (prepositions.has(word)) {
        return word;
      }
      
      // Capitalize other words
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

/**
 * Validates if a name is properly formatted (not all caps)
 */
export function isNameProperlyFormatted(name: string): boolean {
  if (!name || name.length < 2) return true;
  
  // Check if the name is all uppercase (problematic case)
  const isAllCaps = name === name.toUpperCase() && name !== name.toLowerCase();
  
  return !isAllCaps;
}