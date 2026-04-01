import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const themes = [
  {
    slug: 'ocean',
    name: 'Ocean Depths',
    type: 'THEME',
    price: 50,
    data: {
      '--bg': '#0a1628', '--surface': '#0d2137', '--surface2': '#0a3d62',
      '--accent': '#00b4d8', '--accent2': '#0077b6',
      '--board-light': '#a8c4d4', '--board-dark': '#2a6f97'
    }
  },
  {
    slug: 'forest',
    name: 'Enchanted Forest',
    type: 'THEME',
    price: 50,
    data: {
      '--bg': '#1a2e1a', '--surface': '#1e3a1e', '--surface2': '#2d5a27',
      '--accent': '#7bc950', '--accent2': '#3a7d2c',
      '--board-light': '#c5d5a3', '--board-dark': '#4a7c3f'
    }
  },
  {
    slug: 'sunset',
    name: 'Sunset Blaze',
    type: 'THEME',
    price: 75,
    data: {
      '--bg': '#2d1b2e', '--surface': '#3d2040', '--surface2': '#5c2d5e',
      '--accent': '#ff6b6b', '--accent2': '#c44569',
      '--board-light': '#e8c49a', '--board-dark': '#b5564a'
    }
  },
  {
    slug: 'midnight',
    name: 'Midnight',
    type: 'THEME',
    price: 30,
    data: {
      '--bg': '#0d0d1a', '--surface': '#12122a', '--surface2': '#1a1a3e',
      '--accent': '#7c5cbf', '--accent2': '#4a3580',
      '--board-light': '#9a96a8', '--board-dark': '#3d3a54'
    }
  }
];

const skins = [
  {
    slug: 'neon',
    name: 'Neon Glow',
    type: 'SKIN',
    price: 80,
    data: {
      red: {
        base: '#ff0055', gradStops: ['#ff3388', '#ff0055', '#cc0044'],
        stroke: '#ff0055', glow: true
      },
      black: {
        base: '#00ffcc', gradStops: ['#33ffdd', '#00ffcc', '#00ccaa'],
        stroke: '#00ffcc', glow: true
      }
    }
  },
  {
    slug: 'wooden',
    name: 'Classic Wood',
    type: 'SKIN',
    price: 40,
    data: {
      red: {
        base: '#a0522d', gradStops: ['#cd853f', '#a0522d', '#8b4513'],
        stroke: '#6b3410'
      },
      black: {
        base: '#3e2723', gradStops: ['#5d4037', '#3e2723', '#2c1a12'],
        stroke: '#1a0e0a'
      }
    }
  },
  {
    slug: 'crystal',
    name: 'Crystal Ice',
    type: 'SKIN',
    price: 100,
    data: {
      red: {
        base: '#e53935', gradStops: ['#ef5350', '#e53935', '#c62828'],
        stroke: '#b71c1c', highlight: 'rgba(255,255,255,0.3)'
      },
      black: {
        base: '#90caf9', gradStops: ['#bbdefb', '#90caf9', '#64b5f6'],
        stroke: '#42a5f5', highlight: 'rgba(255,255,255,0.35)'
      }
    }
  }
];

const emotes = [
  { slug: 'emote-gg', name: 'GG', type: 'EMOTE', price: 0, data: { emoji: '🤝', label: 'GG' } },
  { slug: 'emote-think', name: 'Thinking', type: 'EMOTE', price: 0, data: { emoji: '🤔', label: 'Hmm...' } },
  { slug: 'emote-clap', name: 'Clap', type: 'EMOTE', price: 0, data: { emoji: '👏', label: 'Nice!' } },
  { slug: 'emote-wave', name: 'Wave', type: 'EMOTE', price: 0, data: { emoji: '👋', label: 'Hi!' } },
  { slug: 'emote-fire', name: 'Fire', type: 'EMOTE', price: 15, data: { emoji: '🔥', label: 'On fire!' } },
  { slug: 'emote-laugh', name: 'Laugh', type: 'EMOTE', price: 15, data: { emoji: '😂', label: 'Haha' } },
  { slug: 'emote-crown', name: 'Crown', type: 'EMOTE', price: 25, data: { emoji: '👑', label: 'King move' } },
  { slug: 'emote-oops', name: 'Oops', type: 'EMOTE', price: 10, data: { emoji: '😬', label: 'Oops' } }
];

async function seed() {
  console.log('Seeding shop items...');

  for (const theme of themes) {
    await prisma.shopItem.upsert({
      where: { slug: theme.slug },
      update: { ...theme },
      create: { ...theme }
    });
  }

  for (const skin of skins) {
    await prisma.shopItem.upsert({
      where: { slug: skin.slug },
      update: { ...skin },
      create: { ...skin }
    });
  }

  for (const emote of emotes) {
    await prisma.shopItem.upsert({
      where: { slug: emote.slug },
      update: { ...emote },
      create: { ...emote }
    });
  }

  const count = await prisma.shopItem.count();
  console.log(`Seeded ${count} shop items`);
}

seed()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
