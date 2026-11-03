const prisma = require("../prisma");

exports.issueBook = async (req, res) => {
  try {
    const { bookId, userId, borrowDays } = req.body;

    const settings = await prisma.librarySettings.findUnique({
      where: { id: 1 },
    });
    const days = borrowDays || settings?.defaultBorrowDays || 14;

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        include: { issues: { where: { status: "ISSUED" } } },
      });

      if (!user || !user.isActive)
        throw new Error("Student account is invalid or deactivated.");
      if (user.role !== "STUDENT")
        throw new Error("Books can only be issued to students.");

      const limit = settings?.maxBooksPerStudent || 4;
      if (user.issues.length >= limit) {
        throw new Error(
          `Student has reached maximum allowed book limit (${limit}).`,
        );
      }

      const alreadyHas = user.issues.some((i) => i.bookId === bookId);
      if (alreadyHas)
        throw new Error("Student already holds an active copy of this book.");

      const book = await tx.book.findUnique({ where: { id: bookId } });
      if (!book || book.availableCopies <= 0) {
        throw new Error("Book is currently out of stock.");
      }

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + parseInt(days, 10));

      const issue = await tx.bookIssue.create({
        data: {
          bookId,
          userId,
          dueDate,
          status: "ISSUED",
        },
      });

      await tx.book.update({
        where: { id: bookId },
        data: { availableCopies: { decrement: 1 } },
      });

      await tx.notification.create({
        data: {
          userId,
          title: "Book Issued",
          message: `"${book.title}" was issued to you. Due date: ${dueDate.toISOString().split("T")[0]}.`,
        },
      });

      return issue;
    });

    return res
      .status(201)
      .json({
        success: true,
        message: "Book issued successfully.",
        data: result,
      });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.returnBook = async (req, res) => {
  try {
    const { issueId } = req.body;

    const settings = await prisma.librarySettings.findUnique({
      where: { id: 1 },
    });
    const finePerDay = settings ? settings.fineRatePerDay : 5.0;

    const result = await prisma.$transaction(async (tx) => {
      const issue = await tx.bookIssue.findUnique({
        where: { id: issueId },
        include: { book: true, user: true },
      });

      if (!issue) throw new Error("Issue record not found.");
      if (issue.status === "RETURNED")
        throw new Error("Book has already been returned.");

      const now = new Date();
      let calculatedFine = 0;

      if (now > issue.dueDate) {
        const diffTime = Math.abs(now - issue.dueDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        calculatedFine = diffDays * finePerDay;
      }

      const updatedIssue = await tx.bookIssue.update({
        where: { id: issueId },
        data: {
          status: "RETURNED",
          returnDate: now,
        },
      });

      await tx.book.update({
        where: { id: issue.bookId },
        data: { availableCopies: { increment: 1 } },
      });

      let fineRecord = null;
      if (calculatedFine > 0) {
        fineRecord = await tx.fine.create({
          data: {
            issueId: issue.id,
            userId: issue.userId,
            amount: calculatedFine,
            status: "UNPAID",
          },
        });

        await tx.notification.create({
          data: {
            userId: issue.userId,
            title: "Late Return Fine Incurred",
            message: `Overdue fine of ₹${calculatedFine} charged for book "${issue.book.title}".`,
          },
        });
      }

      return { updatedIssue, fineRecord, calculatedFine };
    });

    return res.status(200).json({
      success: true,
      message: "Book returned successfully.",
      fine: result.calculatedFine,
      data: result,
    });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

exports.requestBook = async (req, res) => {
  try {
    const { bookId, notes } = req.body;
    const userId = req.user.id;

    const existingPending = await prisma.bookRequest.findFirst({
      where: { bookId, userId, status: "PENDING" },
    });

    if (existingPending) {
      return res
        .status(400)
        .json({
          success: false,
          message: "You already have a pending request for this book.",
        });
    }

    const request = await prisma.bookRequest.create({
      data: { bookId, userId, notes },
    });

    return res
      .status(201)
      .json({
        success: true,
        message: "Book requested successfully.",
        data: request,
      });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.handleBookRequest = async (req, res) => {
  try {
    const { requestId, status } = req.body;
    if (!["APPROVED", "REJECTED"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status value." });
    }

    const bookReq = await prisma.bookRequest.findUnique({
      where: { id: requestId },
      include: { book: true },
    });

    if (!bookReq)
      return res
        .status(404)
        .json({ success: false, message: "Request not found." });

    await prisma.bookRequest.update({
      where: { id: requestId },
      data: { status },
    });

    await prisma.notification.create({
      data: {
        userId: bookReq.userId,
        title: `Book Request ${status}`,
        message: `Your request for "${bookReq.book.title}" was ${status.toLowerCase()}.`,
      },
    });

    return res
      .status(200)
      .json({
        success: true,
        message: `Request ${status.toLowerCase()} successfully.`,
      });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.reserveBook = async (req, res) => {
  try {
    const { bookId } = req.body;
    const userId = req.user.id;

    const book = await prisma.book.findUnique({ where: { id: bookId } });
    if (!book)
      return res
        .status(404)
        .json({ success: false, message: "Book not found." });
    if (book.availableCopies > 0) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Book is in stock and can be borrowed directly.",
        });
    }

    const existing = await prisma.reservation.findFirst({
      where: { bookId, userId, status: "WAITING" },
    });

    if (existing) {
      return res
        .status(400)
        .json({ success: false, message: "You already reserved this book." });
    }

    const count = await prisma.reservation.count({
      where: { bookId, status: "WAITING" },
    });

    const reservation = await prisma.reservation.create({
      data: {
        bookId,
        userId,
        queuePos: count + 1,
      },
    });

    return res
      .status(201)
      .json({
        success: true,
        message: "Book reserved successfully.",
        data: reservation,
      });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
