// The approved practical s1 encoding. A matching key is not proof of uniqueness.
const KEY = /^s1-([0-9]{4})-([0-9]{2})-([0-9]{2})_([0-9]{2})-([0-9]{2})-([0-9]{2})-((?:0|[1-9][0-9]{0,9}))-((?:0|[1-9][0-9]{0,9}))-((?:0|[1-9][0-9]{0,9}))-((?:0|[1-9][0-9]{0,9}))(?![\s\S])/;

export function validateSessionKey(key) {
  const match = typeof key === 'string' && KEY.exec(key);
  if (!match) throw new Error('Invalid canonical s1 session key');
  const [year, month, day, hour, minute, second, ...limbs] = match.slice(1).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1] ||
      hour > 23 || minute > 59 || second > 59 || limbs.some((limb) => limb > 2147483647)) {
    throw new Error('Invalid canonical s1 session key');
  }
  return key;
}

export function validateSessionRecord(record) {
  validateSessionKey(record?.session);
  if (!/^[A-Z]{3}-[0-9]{3}(?![\s\S])/.test(record.ship) ||
      !/^[A-Z]{3}-[0-9]{3}(?![\s\S])/.test(record.destination)) {
    throw new Error('Invalid V2 docking identifiers');
  }
  return record;
}
