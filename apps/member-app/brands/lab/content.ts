import type { MemberContent } from '../types';

// Copy and photos from apps/lab-prototype-web (THE LAB website material; licence check is gate G4).
const img = {
  floor: require('./assets/content/floor.jpg'),
  recovery: require('./assets/content/recovery.jpg'),
  hero: require('./assets/content/hero.jpg'),
  load: require('./assets/content/load.jpg'),
  adapt: require('./assets/content/adapt.jpg'),
  balance: require('./assets/content/balance.jpg'),
  forge: require('./assets/content/forge.jpg'),
  pulse: require('./assets/content/pulse.jpg'),
  range: require('./assets/content/range.jpg'),
  ascent: require('./assets/content/ascent.jpg'),
  hybrid: require('./assets/content/hybrid.jpg'),
  tribe: require('./assets/content/tribe.jpg'),
};

export const content: MemberContent = {
  home: {
    title: 'SHOW UP. EVOLVE.',
    hero: {
      image: img.floor,
      badge: 'TRAIN WITH INTENT',
      badgeRight: 'BY ONYX',
      eyebrow: 'YOUR NEXT VERSION STARTS HERE',
      title: 'STRONGER.\nBY DESIGN.',
      body: 'Science-led training. Purposeful recovery.',
    },
  },
  book: {
    eyebrow: 'PLAN YOUR NEXT STEP',
    title: 'MAKE IT COUNT.',
    banner: { image: img.forge, eyebrow: 'COACH-LED · PURPOSE-BUILT', title: 'TRAIN WITH INTENT.' },
  },
  pillars: [
    { key: 'LOAD', label: 'Strength', image: img.load },
    { key: 'ADAPT', label: 'Conditioning', image: img.adapt },
    { key: 'BALANCE', label: 'Mobility & recovery', image: img.balance },
  ],
  programmes: [
    { match: 'forge', name: 'THE FORGE', pillar: 'LOAD', image: img.forge,
      description: 'Progressive strength training across key movement patterns. Build a stronger foundation, one purposeful session at a time.' },
    { match: 'pulse', name: 'THE PULSE', pillar: 'ADAPT', image: img.pulse,
      description: 'Structured interval conditioning to develop aerobic capacity, high-output endurance and stamina.' },
    { match: 'range', name: 'THE RANGE', pillar: 'BALANCE', image: img.range,
      description: 'Targeted mobility and stabilising work to improve joint mechanics and expand active range of motion.' },
    { match: 'ascent', name: 'THE ASCENT', pillar: 'ADAPT', image: img.ascent,
      description: 'Indoor treadmill conditioning with structured speed, intervals and compromised running.' },
    { match: 'hybrid', name: 'THE HYBRID', pillar: 'LOAD + ADAPT', image: img.hybrid,
      description: 'A complete total-body session combining heavy strength work and high-output conditioning.' },
    { match: 'tribe', name: 'THE TRIBE', pillar: 'ADAPT', image: img.tribe,
      description: 'Partner conditioning and scalable teamwork for high work capacity and doubles race preparation.' },
  ],
  passport: { eyebrow: 'YOUR EFFORT. YOUR EVOLUTION.', title: 'THE PASSPORT.' },
  profile: { eyebrow: 'YOUR LAB. YOUR WAY.', title: 'YOUR PROFILE.', image: img.hero },
  clubImage: img.recovery,
  // From the prototype; club team to confirm the real first-visit guidance
  firstVisit: [
    'Arrive a little early and check in with the club team.',
    'Bring a water bottle.',
  ],
};
