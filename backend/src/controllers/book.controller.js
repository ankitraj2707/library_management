const prisma = require("../prisma");

exports.getBooks = async (req, res) => {
  try {
    const {
      search,
      categoryId,
      availableOnly,
      page = 1,
      limit = 50,
    } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { author: { contains: search, mode: "insensitive" } },
        { isbn: { contains: search, mode: "insensitive" } },
      ];
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (availableOnly === "true") {
      where.availableCopies = { gt: 0 };
    }

    const [total, books] = await prisma.$transaction([
      prisma.book.count({ where }),
      prisma.book.findMany({
        where,
        skip,
        take,
        include: { category: true },
        orderBy: { title: "asc" },
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: books,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / take),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getBookById = async (req, res) => {
  try {
    const book = await prisma.book.findUnique({
      where: { id: req.params.id },
      include: { category: true },
    });
    if (!book)
      return res
        .status(404)
        .json({ success: false, message: "Book not found." });
    return res.status(200).json({ success: true, data: book });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.createBook = async (req, res) => {
  try {
    const {
      isbn,
      title,
      author,
      publisher,
      publicationYear,
      totalCopies,
      categoryId,
      coverImage,
    } = req.body;

    const existing = await prisma.book.findUnique({ where: { isbn } });
    if (existing) {
      return res
        .status(400)
        .json({
          success: false,
          message: "A book with this ISBN already exists.",
        });
    }

    const parsedTotal = parseInt(totalCopies, 10);
    const book = await prisma.book.create({
      data: {
        isbn,
        title,
        author,
        publisher,
        publicationYear: parseInt(publicationYear, 10),
        totalCopies: parsedTotal,
        availableCopies: parsedTotal,
        categoryId,
        coverImage:
          coverImage ||
          "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400",
      },
    });

    return res.status(201).json({ success: true, data: book });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      isbn,
      title,
      author,
      publisher,
      publicationYear,
      totalCopies,
      categoryId,
      coverImage,
    } = req.body;

    const existing = await prisma.book.findUnique({
      where: { id },
      include: { issues: { where: { status: "ISSUED" } } },
    });

    if (!existing)
      return res
        .status(404)
        .json({ success: false, message: "Book not found." });

    const activeIssuedCount = existing.issues.length;
    const newTotal = parseInt(totalCopies, 10);

    if (newTotal < activeIssuedCount) {
      return res.status(400).json({
        success: false,
        message: `Total copies cannot be lower than active checked-out copies (${activeIssuedCount}).`,
      });
    }

    const newAvailable = newTotal - activeIssuedCount;

    const updated = await prisma.book.update({
      where: { id },
      data: {
        isbn,
        title,
        author,
        publisher,
        publicationYear: parseInt(publicationYear, 10),
        totalCopies: newTotal,
        availableCopies: newAvailable,
        categoryId,
        coverImage,
      },
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.deleteBook = async (req, res) => {
  try {
    const { id } = req.params;
    const activeIssues = await prisma.bookIssue.count({
      where: { bookId: id, status: "ISSUED" },
    });

    if (activeIssues > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete book: Copies are currently issued to students.",
      });
    }

    await prisma.book.delete({ where: { id } });
    return res
      .status(200)
      .json({ success: true, message: "Book deleted successfully." });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getCategories = async (req, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { books: true } } },
    });
    return res.status(200).json({ success: true, data: categories });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
