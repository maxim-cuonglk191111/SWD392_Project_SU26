import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const gifts = [
  { name: 'Heart', emoji: '❤️', coinCost: 5 },
  { name: 'Star', emoji: '⭐', coinCost: 10 },
  { name: 'Fire', emoji: '🔥', coinCost: 15 },
  { name: 'Clap', emoji: '👏', coinCost: 10 },
  { name: 'Crown', emoji: '👑', coinCost: 50 },
  { name: 'Rocket', emoji: '🚀', coinCost: 30 },
  { name: 'Diamond', emoji: '💎', coinCost: 100 },
  { name: 'Trophy', emoji: '🏆', coinCost: 75 },
  { name: 'Mic', emoji: '🎤', coinCost: 25 },
  { name: 'Coffee', emoji: '☕', coinCost: 15 },
  { name: 'Cake', emoji: '🎂', coinCost: 20 },
  { name: 'Rainbow', emoji: '🌈', coinCost: 40 },
];

async function main() {
  for (const gift of gifts) {
    await prisma.gift.upsert({
      where: { name: gift.name },
      update: {},
      create: gift,
    });
  }
  console.log('✅ Seeded', gifts.length, 'gifts');
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1); });
