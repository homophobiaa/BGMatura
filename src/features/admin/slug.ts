/**
 * Suggests a URL slug from a Bulgarian title using the official Bulgarian
 * transliteration rules (Закон за транслитерацията), so public URLs stay readable
 * in Latin script. Editors can always change the suggestion before saving.
 */
const transliteration: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u",
  ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya",
};

const maximumSlugLength = 200;

export function slugFromTitle(title: string): string {
  const words = title.normalize("NFC").toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const latinWords = words.map((word) => {
    // The law transliterates a word-final "ия" as "ia", not "iya".
    const ending = word.endsWith("ия") ? "ia" : "";
    const stem = ending ? word.slice(0, -2) : word;
    const latin = Array.from(stem, (letter) => transliteration[letter] ?? letter).join("") + ending;
    return latin.replace(/[^a-z0-9]+/g, "");
  }).filter(Boolean);
  return latinWords.join("-").slice(0, maximumSlugLength).replace(/-+$/, "");
}
