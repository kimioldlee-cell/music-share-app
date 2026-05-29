import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.song.create({
    data: {
      url: 'https://music.163.com/#/song?id=31421495',
      title: 'This Feeling',
      artist: 'Alabama Shakes',
      cover: 'http://p1.music.126.net/dsvCEXGmEZCi-NgUSUchOA==/109951163510152241.jpg',
      genre: '流行',
      language: '欧美',
      comment: '前奏一响，直接沦陷...',
      platform: 'netease',
    }
  });
  console.log('seeded');
}
main();
