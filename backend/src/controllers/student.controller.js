const prisma = require("../prisma");

exports.getStudentDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    const issuedCount = await prisma.bookIssue.count({
      where: { userId, status: "ISSUED" },
    });

    const pendingRequests = await prisma.bookRequest.count({
      where: { userId, status: "PENDING" },
    });

    const booksReturned = await prisma.bookIssue.count({
      where: { userId, status: "RETURNED" },
    });

    const unpaidFines = await prisma.fine.aggregate({
      where: { userId, status: "UNPAID" },
      _sum: { amount: true },
    });

    const activeIssues = await prisma.bookIssue.findMany({
      where: { userId, status: "ISSUED" },
      include: { book: true },
      orderBy: { dueDate: "asc" },
    });

    const notifications = await prisma.notification.findMany({
      where: { userId },
      take: 6,
      orderBy: { createdAt: "desc" },
    });

    const recentBooks = await prisma.book.findMany({
      take: 4,
      orderBy: { createdAt: "desc" },
      include: { category: true },
    });

    return res.status(200).json({
      success: true,
      stats: {
        issuedCount,
        pendingRequests,
        booksReturned,
        outstandingFines: unpaidFines._sum.amount || 0,
      },
      activeIssues,
      notifications,
      recentBooks,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyIssues = async (req, res) => {
  try {
    const issues = await prisma.bookIssue.findMany({
      where: { userId: req.user.id },
      include: { book: true, fine: true },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json({ success: true, data: issues });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getMyFines = async (req, res) => {
  try {
    const fines = await prisma.fine.findMany({
      where: { userId: req.user.id },
      include: { issue: { include: { book: true } }, payment: true },
      orderBy: { createdAt: "desc" },
    });
    return res.status(200).json({ success: true, data: fines });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
