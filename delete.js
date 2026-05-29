import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.song.deleteMany({});
  console.log('Deleted all songs');
}
main();
