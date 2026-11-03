const express = require("express");
const router = express.Router();

const authCtrl = require("../controllers/auth.controller");
const bookCtrl = require("../controllers/book.controller");
const circCtrl = require("../controllers/circulation.controller");
const adminCtrl = require("../controllers/admin.controller");
const studentCtrl = require("../controllers/student.controller");

const { authenticate, authorize } = require("../middleware/auth.middleware");

// Authentication & Profile Endpoints
router.post("/auth/login", authCtrl.login);
router.post("/auth/logout", authCtrl.logout);
router.get("/auth/me", authenticate, authCtrl.getMe);
router.put("/auth/profile", authenticate, authCtrl.updateProfile);

// Catalog Endpoints
router.get("/books", authenticate, bookCtrl.getBooks);
router.get("/books/:id", authenticate, bookCtrl.getBookById);
router.get("/categories", authenticate, bookCtrl.getCategories);

// Student Circulation Actions
router.post(
  "/circulation/request",
  authenticate,
  authorize("STUDENT"),
  circCtrl.requestBook,
);
router.post(
  "/circulation/reserve",
  authenticate,
  authorize("STUDENT"),
  circCtrl.reserveBook,
);

// Student Portal Endpoints
router.get(
  "/student/dashboard",
  authenticate,
  authorize("STUDENT"),
  studentCtrl.getStudentDashboard,
);
router.get(
  "/student/issues",
  authenticate,
  authorize("STUDENT"),
  studentCtrl.getMyIssues,
);
router.get(
  "/student/fines",
  authenticate,
  authorize("STUDENT"),
  studentCtrl.getMyFines,
);

// Admin Operations
router.post("/books", authenticate, authorize("ADMIN"), bookCtrl.createBook);
router.put("/books/:id", authenticate, authorize("ADMIN"), bookCtrl.updateBook);
router.delete(
  "/books/:id",
  authenticate,
  authorize("ADMIN"),
  bookCtrl.deleteBook,
);

router.get(
  "/admin/dashboard",
  authenticate,
  authorize("ADMIN"),
  adminCtrl.getDashboardStats,
);
router.post(
  "/admin/students",
  authenticate,
  authorize("ADMIN"),
  adminCtrl.registerStudent,
);
router.get(
  "/admin/students",
  authenticate,
  authorize("ADMIN"),
  adminCtrl.getStudents,
);

router.post(
  "/circulation/issue",
  authenticate,
  authorize("ADMIN"),
  circCtrl.issueBook,
);
router.post(
  "/circulation/return",
  authenticate,
  authorize("ADMIN"),
  circCtrl.returnBook,
);
router.post(
  "/circulation/requests/review",
  authenticate,
  authorize("ADMIN"),
  circCtrl.handleBookRequest,
);

router.post(
  "/admin/fines/pay",
  authenticate,
  authorize("ADMIN"),
  adminCtrl.recordFinePayment,
);
router.get(
  "/admin/settings",
  authenticate,
  authorize("ADMIN"),
  adminCtrl.getSettings,
);
router.put(
  "/admin/settings",
  authenticate,
  authorize("ADMIN"),
  adminCtrl.updateSettings,
);

module.exports = router;
