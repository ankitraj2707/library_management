const jwt = require("jsonwebtoken");
const prisma = require("../prisma");

const authenticate = async (req, res, next) => {
  try {
    let token = req.cookies?.token;
    if (
      !token &&
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res
        .status(401)
        .json({
          success: false,
          message: "Authentication required. Please login.",
        });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        studentId: true,
      },
    });

    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ success: false, message: "User invalid or deactivated." });
    }

    req.user = user;
    next();
  } catch (err) {
    return res
      .status(401)
      .json({
        success: false,
        message: "Session expired or invalid. Please login again.",
      });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res
        .status(403)
        .json({
          success: false,
          message: "Access denied: Insufficient privileges.",
        });
    }
    next();
  };
};

module.exports = { authenticate, authorize };
