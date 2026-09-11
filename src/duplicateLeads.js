const normalizeText = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, ' ')
  .trim()
  .replace(/\s+/g, ' ');

const normalizeCompany = value => normalizeText(value)
  .replace(/\b(ltda|me|eireli|sa|s a|inc|brasil)\b/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const normalizePhone = value => {
  let digits = String(value || '').replace(/\D/g, '');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2);
  return digits;
};

function bigrams(value) {
  if (!value) return [];
  if (value.length < 2) return [value];
  const items = [];
  for (let i = 0; i < value.length - 1; i += 1) items.push(value.slice(i, i + 2));
  return items;
}

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aPairs = bigrams(a);
  const bPairs = bigrams(b);
  const remaining = [...bPairs];
  let matches = 0;
  aPairs.forEach(pair => {
    const index = remaining.indexOf(pair);
    if (index >= 0) {
      matches += 1;
      remaining.splice(index, 1);
    }
  });
  return (2 * matches) / (aPairs.length + bPairs.length || 1);
}

function oneDigitAway(a, b) {
  if (!a || !b || a.length !== b.length || a.length < 10) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) diff += 1;
    if (diff > 1) return false;
  }
  return diff === 1;
}

function classifyPair(a, b) {
  const aPhone = normalizePhone(a.phone);
  const bPhone = normalizePhone(b.phone);
  const aName = normalizeText(a.name);
  const bName = normalizeText(b.name);
  const aCompany = normalizeCompany(a.company);
  const bCompany = normalizeCompany(b.company);

  if (aPhone.length >= 10 && aPhone === bPhone) {
    return { confidence: 100, reason: 'Mesmo WhatsApp' };
  }

  if (aName && aName === bName && aCompany && aCompany === bCompany) {
    return { confidence: 97, reason: 'Mesmo nome e mesma empresa' };
  }

  if (aName && aName === bName && oneDigitAway(aPhone, bPhone)) {
    return { confidence: 94, reason: 'Mesmo nome e WhatsApp com 1 dígito diferente' };
  }

  const nameSimilarity = similarity(aName, bName);
  const companySimilarity = similarity(aCompany, bCompany);

  if (nameSimilarity >= 0.94 && aCompany && bCompany && aCompany === bCompany) {
    return { confidence: 92, reason: 'Nome muito parecido e mesma empresa' };
  }

  if (aName && aName === bName && aCompany && bCompany && companySimilarity >= 0.9) {
    return { confidence: 89, reason: 'Mesmo nome e empresa muito parecida' };
  }

  return null;
}

export function buildDuplicateIndex(leads) {
  const items = Array.isArray(leads) ? leads : [];
  const index = new Map();

  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i];
      const b = items[j];
      if (!a?.id || !b?.id || a.id === b.id) continue;
      const match = classifyPair(a, b);
      if (!match) continue;

      const aEntry = index.get(a.id) || { highestConfidence: 0, matches: [] };
      const bEntry = index.get(b.id) || { highestConfidence: 0, matches: [] };

      aEntry.highestConfidence = Math.max(aEntry.highestConfidence, match.confidence);
      bEntry.highestConfidence = Math.max(bEntry.highestConfidence, match.confidence);
      aEntry.matches.push({ id: b.id, name: b.name || 'Lead sem nome', ...match });
      bEntry.matches.push({ id: a.id, name: a.name || 'Lead sem nome', ...match });
      index.set(a.id, aEntry);
      index.set(b.id, bEntry);
    }
  }

  index.forEach(entry => entry.matches.sort((a, b) => b.confidence - a.confidence));
  return index;
}

export function duplicateGroupCount(index) {
  if (!(index instanceof Map)) return 0;
  const seen = new Set();
  let groups = 0;
  index.forEach((entry, id) => {
    if (seen.has(id)) return;
    groups += 1;
    seen.add(id);
    entry.matches.forEach(match => seen.add(match.id));
  });
  return groups;
}
