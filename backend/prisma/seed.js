const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding initial system rules, accounts, and catalog...");

  await prisma.librarySettings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      fineRatePerDay: 5.0,
      defaultBorrowDays: 14,
      maxBooksPerStudent: 4,
    },
  });

  const adminPassword = await bcrypt.hash("Admin@12345", 10);
  await prisma.user.upsert({
    where: { email: "admin@university.edu" },
    update: {},
    create: {
      email: "admin@university.edu",
      password: adminPassword,
      name: "System Librarian",
      role: "ADMIN",
      phone: "+919876543210",
    },
  });

  const studentPassword = await bcrypt.hash("Student@12345", 10);
  await prisma.user.upsert({
    where: { email: "student@university.edu" },
    update: {},
    create: {
      email: "student@university.edu",
      password: studentPassword,
      name: "Aarav Sharma",
      role: "STUDENT",
      studentId: "STU2026001",
      department: "Computer Science & Engineering",
      course: "B.Tech",
      semester: 6,
      phone: "+919123456789",
    },
  });

  const categories = [
    {
      name: "Computer Science",
      description: "Data structures, algorithms, systems, AI",
    },
    { name: "Mathematics", description: "Calculus, discrete math, statistics" },
    {
      name: "Physics",
      description: "Classical mechanics, quantum physics, thermodynamics",
    },
    {
      name: "Literature",
      description: "Fiction, linguistics, classical prose",
    },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  const csCategory = await prisma.category.findUnique({
    where: { name: "Computer Science" },
  });

  const books = [
    {
      isbn: "9780132350884",
      title: "Clean Code: A Handbook of Agile Software Craftsmanship",
      author: "Robert C. Martin",
      publisher: "Prentice Hall",
      publicationYear: 2008,
      totalCopies: 5,
      availableCopies: 5,
      categoryId: csCategory.id,
      coverImage:
        "https://images.unsplash.com/photo-1532012164546-f432f2e3777a?w=400",
    },
    {
      isbn: "9780262033848",
      title: "Introduction to Algorithms",
      author: "Thomas H. Cormen, Charles E. Leiserson",
      publisher: "MIT Press",
      publicationYear: 2009,
      totalCopies: 4,
      availableCopies: 4,
      categoryId: csCategory.id,
      coverImage:
        "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400",
    },
  ];

  for (const b of books) {
    await prisma.book.upsert({
      where: { isbn: b.isbn },
      update: {},
      create: b,
    });
  }

  console.log("Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
