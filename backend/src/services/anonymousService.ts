/**
 * Anonymous Identity Service
 * Mỗi user được gán 1 identity ẩn danh khi vào phòng
 * Identity chỉ tồn tại trong session của phòng đó
 */

/**
 * Deterministic anonymous identity — same seed always = same identity
 * No Math.random(), no external state
 */

const adjectives = [
  'Silent', 'Curious', 'Gentle', 'Bold', 'Calm', 'Bright', 'Swift', 'Wise',
  'Quiet', 'Warm', 'Soft', 'Steady', 'Crisp', 'Eager', 'Noble', 'Cosy',
  'Serene', 'Lively', 'Polite', 'Playful', 'Thoughtful', 'Fearless',
  'Hopeful', 'Peaceful', 'Radiant', 'Cheerful', 'Friendly', 'Honest', 'Modest',
  'Reliable', 'Sincere', 'Vivid', 'Active', 'Alert', 'Amused', 'Ancient',
  'Brave', 'Brisk', 'Clever', 'Cool', 'Daring', 'Delicate', 'Delightful',
];

const animals = [
  'Panda', 'Fox', 'Owl', 'Dolphin', 'Tiger', 'Koala', 'Rabbit', 'Penguin',
  'Flamingo', 'Otter', 'Peacock', 'Hedgehog', 'Squirrel', 'Seal', 'Parrot',
  'Octopus', 'Jellyfish', 'Butterfly', 'Chameleon', 'Gecko', 'Starfish',
  'Capybara', 'Axolotl', 'Quokka', 'Narwhal', 'Platypus', 'RedPanda',
  'Dumbo', 'Puffin', 'Iguana', 'Fennec', 'Manatee', 'Tapir', 'Wombat',
  'Pangolin', 'Toucan', 'Marmot', 'Crane', 'Lemur', 'Mink',
];

function hashString(str: string): number {
  return str.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) >>> 0, 0);
}

export function generateAnonymousIdentity(seed: string): { anonymousName: string; anonymousAvatarSeed: number } {
  const hash = hashString(seed);
  const adj = adjectives[hash % adjectives.length];
  const animal = animals[(hash >> 4) % animals.length];
  const seedNum = (hash % 999) + 1;
  return {
    anonymousName: `${adj} ${animal} #${seedNum}`,
    anonymousAvatarSeed: seedNum,
  };
}
