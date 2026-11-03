const bcrypt = require("bcrypt");
const crypto = require("crypto");
const prisma = require("../prisma");

exports.getDashboardStats = async (req, res) => {
  try {
    const totalBooks = await prisma.book.aggregate({
      _sum: { totalCopies: true },
    });
    const availableBooks = await prisma.book.aggregate({
      _sum: { availableCopies: true },
    });
    const issuedBooks = await prisma.bookIssue.count({
      where: { status: "ISSUED" },
    });
    const totalStudents = await prisma.user.count({
      where: { role: "STUDENT" },
    });
    const pendingRequests = await prisma.bookRequest.count({
      where: { status: "PENDING" },
    });

    const now = new Date();
    const overdueBooks = await prisma.bookIssue.count({
      where: { status: "ISSUED", dueDate: { lt: now } },
    });

    const finesCollected = await prisma.finePayment.aggregate({
      _sum: { amountPaid: true },
    });

    const recentTransactions = await prisma.bookIssue.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { book: true, user: true },
    });

    const recentStudents = await prisma.user.findMany({
      where: { role: "STUDENT" },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        studentId: true,
        department: true,
        createdAt: true,
      },
    });

    const pendingRequestsList = await prisma.bookRequest.findMany({
      where: { status: "PENDING" },
      take: 5,
      include: { book: true, user: true },
      orderBy: { createdAt: "desc" },
    });

    const categoriesWithCount = await prisma.category.findMany({
      include: { _count: { select: { books: true } } },
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalBooks: totalBooks._sum.totalCopies || 0,
        availableBooks: availableBooks._sum.availableCopies || 0,
        issuedBooks,
        totalStudents,
        pendingRequests,
        overdueBooks,
        totalFinesCollected: finesCollected._sum.amountPaid || 0,
      },
      recentTransactions,
      recentStudents,
      pendingRequestsList,
      categoryDistribution: categoriesWithCount.map((c) => ({
        name: c.name,
        count: c._count.books,
      })),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.registerStudent = async (req, res) => {
  try {
    const {
      name,
      email,
      studentId,
      department,
      course,
      semester,
      phone,
      password,
    } = req.body;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { studentId }] },
    });

    if (existing) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Email or Student ID already exists.",
        });
    }

    const hashedPassword = await bcrypt.hash(password || "Student@123", 10);

    const student = await prisma.user.create({
      data: {
        name,
        email,
        studentId,
        department,
        course,
        semester: parseInt(semester, 10) || 1,
        phone,
        password: hashedPassword,
        role: "STUDENT",
      },
    });

    return res
      .status(201)
      .json({
        success: true,
        message: "Student registered successfully.",
        student,
      });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getStudents = async (req, res) => {
  try {
    const { search } = req.query;
    const where = { role: "STUDENT" };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { studentId: { contains: search, mode: "insensitive" } },
      ];
    }

    const students = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        issues: { where: { status: "ISSUED" }, include: { book: true } },
        fines: { where: { status: "UNPAID" } },
      },
    });

    return res.status(200).json({ success: true, data: students });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.recordFinePayment = async (req, res) => {
  try {
    const { fineId, amount } = req.body;
    const fine = await prisma.fine.findUnique({
      where: { id: fineId },
      include: { user: true },
    });

    if (!fine)
      return res
        .status(404)
        .json({ success: false, message: "Fine record not found." });
    if (fine.status === "PAID")
      return res
        .status(400)
        .json({ success: false, message: "Fine is already settled." });

    const receiptNo =
      "RCPT-" + crypto.randomBytes(4).toString("hex").toUpperCase();

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.finePayment.create({
        data: {
          fineId,
          userId: fine.userId,
          amountPaid: parseFloat(amount),
          receivedBy: req.user.name,
          receiptNo,
        },
      });

      await tx.fine.update({
        where: { id: fineId },
        data: { status: "PAID" },
      });

      await tx.notification.create({
        data: {
          userId: fine.userId,
          title: "Fine Payment Settled",
          message: `Payment of ₹${amount} received. Receipt #${receiptNo}.`,
        },
      });

      return p;
    });

    return res
      .status(200)
      .json({
        success: true,
        message: "Payment recorded successfully.",
        data: payment,
      });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getSettings = async (req, res) => {
  try {
    let settings = await prisma.librarySettings.findUnique({
      where: { id: 1 },
    });
    if (!settings) {
      settings = await prisma.librarySettings.create({ data: { id: 1 } });
    }
    return res.status(200).json({ success: true, data: settings });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { fineRatePerDay, defaultBorrowDays, maxBooksPerStudent } = req.body;
    const settings = await prisma.librarySettings.upsert({
      where: { id: 1 },
      update: {
        fineRatePerDay: parseFloat(fineRatePerDay),
        defaultBorrowDays: parseInt(defaultBorrowDays, 10),
        maxBooksPerStudent: parseInt(maxBooksPerStudent, 10),
      },
      create: {
        id: 1,
        fineRatePerDay: parseFloat(fineRatePerDay),
        defaultBorrowDays: parseInt(defaultBorrowDays, 10),
        maxBooksPerStudent: parseInt(maxBooksPerStudent, 10),
      },
    });
    return res
      .status(200)
      .json({
        success: true,
        message: "Settings updated successfully.",
        data: settings,
      });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
