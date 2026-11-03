const Admin = {
  currentView: "overview",

  async init() {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || user.role !== "ADMIN") {
      window.location.href = "/index.html";
      return;
    }
    document.getElementById("adminGreeting").textContent =
      `${user.name} (${user.email})`;
    this.navigate("overview");
  },

  logout() {
    localStorage.clear();
    API.request("/auth/logout", { method: "POST" }).finally(() => {
      window.location.href = "/index.html";
    });
  },

  async navigate(view) {
    this.currentView = view;
    const content = document.getElementById("dynamicContent");
    content.innerHTML = "<p>Loading records...</p>";

    document
      .querySelectorAll(".sidebar-menu a")
      .forEach((a) => a.classList.remove("active"));
    const link = document.querySelector(
      `.sidebar-menu a[onclick*="'${view}'"]`,
    );
    if (link) link.classList.add("active");

    switch (view) {
      case "overview":
        await this.renderOverview(content);
        break;
      case "books":
        await this.renderBooks(content);
        break;
      case "students":
        await this.renderStudents(content);
        break;
      case "issue":
        await this.renderIssueForm(content);
        break;
      case "return":
        await this.renderReturnForm(content);
        break;
      case "fines":
        await this.renderFines(content);
        break;
      case "settings":
        await this.renderSettings(content);
        break;
    }
  },

  async renderOverview(container) {
    const res = await API.request("/admin/dashboard");
    if (!res.success) return;
    const { stats, recentTransactions, categoryDistribution } = res;

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><h3>Total Books</h3><div class="val">${stats.totalBooks}</div></div>
        <div class="stat-card"><h3>Available Copies</h3><div class="val">${stats.availableBooks}</div></div>
        <div class="stat-card"><h3>Issued Copies</h3><div class="val">${stats.issuedBooks}</div></div>
        <div class="stat-card"><h3>Total Students</h3><div class="val">${stats.totalStudents}</div></div>
        <div class="stat-card"><h3>Overdue Returns</h3><div class="val" style="color:var(--danger)">${stats.overdueBooks}</div></div>
        <div class="stat-card"><h3>Fine Collected</h3><div class="val">${Utils.formatCurrency(stats.totalFinesCollected)}</div></div>
      </div>

      <div class="card">
        <h3>Category Distribution</h3>
        <canvas id="categoryChart" style="max-height: 250px;"></canvas>
      </div>

      <div class="card">
        <h3>Recent Circulation Activity</h3>
        <div class="table-responsive">
          <table>
            <thead>
              <tr><th>Book</th><th>Student</th><th>Issue Date</th><th>Due Date</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${recentTransactions
                .map(
                  (t) => `
                <tr>
                  <td>${t.book.title}</td>
                  <td>${t.user.name}</td>
                  <td>${Utils.formatDate(t.issueDate)}</td>
                  <td>${Utils.formatDate(t.dueDate)}</td>
                  <td><span class="badge ${t.status === "ISSUED" ? "badge-warning" : "badge-success"}">${t.status}</span></td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const ctx = document.getElementById("categoryChart").getContext("2d");
    new Chart(ctx, {
      type: "doughnut",
      data: {
        labels: categoryDistribution.map((c) => c.name),
        datasets: [
          {
            data: categoryDistribution.map((c) => c.count),
            backgroundColor: ["#0ea5e9", "#3b82f6", "#6366f1", "#a855f7"],
          },
        ],
      },
    });
  },

  async renderBooks(container) {
    const res = await API.request("/books?limit=50");
    container.innerHTML = `
      <div class="card">
        <h3>Add New Book</h3>
        <form id="addBookForm" style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">
          <input type="text" id="bIsbn" placeholder="ISBN" required style="padding: 8px;">
          <input type="text" id="bTitle" placeholder="Book Title" required style="padding: 8px;">
          <input type="text" id="bAuthor" placeholder="Author" required style="padding: 8px;">
          <input type="text" id="bPub" placeholder="Publisher" required style="padding: 8px;">
          <input type="number" id="bYear" placeholder="Publication Year" required style="padding: 8px;">
          <input type="number" id="bCopies" placeholder="Total Copies" required style="padding: 8px;">
          <select id="bCategory" style="padding: 8px;" required></select>
          <button type="submit" class="btn btn-primary" style="grid-column: span 2;">Add Book</button>
        </form>
      </div>

      <div class="card">
        <h3>Catalog Records</h3>
        <div class="table-responsive">
          <table>
            <thead><tr><th>ISBN</th><th>Title</th><th>Author</th><th>Available</th><th>Actions</th></tr></thead>
            <tbody>
              ${res.data
                .map(
                  (b) => `
                <tr>
                  <td>${b.isbn}</td>
                  <td>${b.title}</td>
                  <td>${b.author}</td>
                  <td>${b.availableCopies} / ${b.totalCopies}</td>
                  <td><button class="btn btn-danger" onclick="Admin.deleteBook('${b.id}')">Delete</button></td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    const catRes = await API.request("/categories");
    const sel = document.getElementById("bCategory");
    catRes.data.forEach((c) => {
      sel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });

    document
      .getElementById("addBookForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        await API.request("/books", {
          method: "POST",
          body: JSON.stringify({
            isbn: document.getElementById("bIsbn").value,
            title: document.getElementById("bTitle").value,
            author: document.getElementById("bAuthor").value,
            publisher: document.getElementById("bPub").value,
            publicationYear: document.getElementById("bYear").value,
            totalCopies: document.getElementById("bCopies").value,
            categoryId: document.getElementById("bCategory").value,
          }),
        });
        Utils.showToast("Book added successfully", "success");
        this.renderBooks(container);
      });
  },

  async deleteBook(id) {
    if (!confirm("Are you sure you want to delete this book?")) return;
    try {
      await API.request(`/books/${id}`, { method: "DELETE" });
      Utils.showToast("Book deleted", "success");
      this.navigate("books");
    } catch (e) {}
  },

  async renderStudents(container) {
    const res = await API.request("/admin/students");
    container.innerHTML = `
      <div class="card">
        <h3>Register Student</h3>
        <form id="regStudentForm" style="display:grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">
          <input type="text" id="sName" placeholder="Full Name" required style="padding: 8px;">
          <input type="email" id="sEmail" placeholder="University Email" required style="padding: 8px;">
          <input type="text" id="sId" placeholder="Student ID (e.g. STU101)" required style="padding: 8px;">
          <input type="text" id="sDept" placeholder="Department" required style="padding: 8px;">
          <input type="text" id="sCourse" placeholder="Course" required style="padding: 8px;">
          <input type="number" id="sSem" placeholder="Semester" required style="padding: 8px;">
          <input type="text" id="sPhone" placeholder="Phone Number" required style="padding: 8px;">
          <input type="password" id="sPwd" placeholder="Password" required style="padding: 8px;">
          <button type="submit" class="btn btn-primary" style="grid-column: span 2;">Register Student</button>
        </form>
      </div>

      <div class="card">
        <h3>Enrolled Students</h3>
        <div class="table-responsive">
          <table>
            <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Dept</th><th>Active Issues</th></tr></thead>
            <tbody>
              ${res.data
                .map(
                  (s) => `
                <tr>
                  <td>${s.studentId}</td>
                  <td>${s.name}</td>
                  <td>${s.email}</td>
                  <td>${s.department || "N/A"}</td>
                  <td>${s.issues.length}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document
      .getElementById("regStudentForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        await API.request("/admin/students", {
          method: "POST",
          body: JSON.stringify({
            name: document.getElementById("sName").value,
            email: document.getElementById("sEmail").value,
            studentId: document.getElementById("sId").value,
            department: document.getElementById("sDept").value,
            course: document.getElementById("sCourse").value,
            semester: document.getElementById("sSem").value,
            phone: document.getElementById("sPhone").value,
            password: document.getElementById("sPwd").value,
          }),
        });
        Utils.showToast("Student registered successfully", "success");
        this.renderStudents(container);
      });
  },

  async renderIssueForm(container) {
    const books = await API.request("/books?availableOnly=true&limit=100");
    const students = await API.request("/admin/students");

    container.innerHTML = `
      <div class="card" style="max-width: 600px; margin: 0 auto;">
        <h3>Issue Book Copy</h3>
        <form id="issueBookForm" style="display:flex; flex-direction:column; gap:14px; margin-top:14px;">
          <div>
            <label>Select Book</label>
            <select id="issueBookSelect" required style="width:100%; padding:8px; margin-top:4px;">
              ${books.data.map((b) => `<option value="${b.id}">${b.title} (${b.availableCopies} available)</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Select Student</label>
            <select id="issueStudentSelect" required style="width:100%; padding:8px; margin-top:4px;">
              ${students.data.map((s) => `<option value="${s.id}">${s.name} (${s.studentId})</option>`).join("")}
            </select>
          </div>
          <div>
            <label>Borrow Period (Days)</label>
            <input type="number" id="borrowDays" value="14" style="width:100%; padding:8px; margin-top:4px;">
          </div>
          <button type="submit" class="btn btn-primary">Authorize Issue</button>
        </form>
      </div>
    `;

    document
      .getElementById("issueBookForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        await API.request("/circulation/issue", {
          method: "POST",
          body: JSON.stringify({
            bookId: document.getElementById("issueBookSelect").value,
            userId: document.getElementById("issueStudentSelect").value,
            borrowDays: document.getElementById("borrowDays").value,
          }),
        });
        Utils.showToast("Book issued successfully", "success");
        this.navigate("overview");
      });
  },

  async renderReturnForm(container) {
    const res = await API.request("/admin/dashboard");
    const active = res.recentTransactions.filter((t) => t.status === "ISSUED");

    container.innerHTML = `
      <div class="card" style="max-width: 700px; margin: 0 auto;">
        <h3>Record Book Return</h3>
        <div class="table-responsive" style="margin-top: 14px;">
          <table>
            <thead><tr><th>Book</th><th>Student</th><th>Due Date</th><th>Action</th></tr></thead>
            <tbody>
              ${active.length === 0 ? '<tr><td colspan="4">No outstanding issues in recent activity.</td></tr>' : ""}
              ${active
                .map(
                  (t) => `
                <tr>
                  <td>${t.book.title}</td>
                  <td>${t.user.name}</td>
                  <td>${Utils.formatDate(t.dueDate)}</td>
                  <td><button class="btn btn-primary" onclick="Admin.processReturn('${t.id}')">Return</button></td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async processReturn(issueId) {
    const res = await API.request("/circulation/return", {
      method: "POST",
      body: JSON.stringify({ issueId }),
    });
    if (res.success) {
      Utils.showToast(
        `Book returned. Fine incurred: ₹${res.fine}`,
        res.fine > 0 ? "warning" : "success",
      );
      this.navigate("overview");
    }
  },

  async renderFines(container) {
    const res = await API.request("/admin/students");
    const unpaidStudents = res.data.filter(
      (s) => s.fines && s.fines.length > 0,
    );

    container.innerHTML = `
      <div class="card">
        <h3>Pending Overdue Fines</h3>
        <div class="table-responsive">
          <table>
            <thead><tr><th>Student</th><th>Amount</th><th>Action</th></tr></thead>
            <tbody>
              ${unpaidStudents.length === 0 ? '<tr><td colspan="3">No pending fines.</td></tr>' : ""}
              ${unpaidStudents
                .flatMap((s) =>
                  s.fines.map(
                    (f) => `
                <tr>
                  <td>${s.name} (${s.studentId})</td>
                  <td>${Utils.formatCurrency(f.amount)}</td>
                  <td><button class="btn btn-primary" onclick="Admin.collectFine('${f.id}', ${f.amount})">Record Payment</button></td>
                </tr>
              `,
                  ),
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async collectFine(fineId, amount) {
    await API.request("/admin/fines/pay", {
      method: "POST",
      body: JSON.stringify({ fineId, amount }),
    });
    Utils.showToast("Fine recorded as settled", "success");
    this.renderFines(document.getElementById("dynamicContent"));
  },

  async renderSettings(container) {
    const res = await API.request("/admin/settings");
    const s = res.data;
    container.innerHTML = `
      <div class="card" style="max-width: 500px; margin: 0 auto;">
        <h3>Circulation Parameters</h3>
        <form id="settingsForm" style="display:flex; flex-direction:column; gap:14px; margin-top:14px;">
          <div>
            <label>Fine Rate per Overdue Day (₹)</label>
            <input type="number" step="0.5" id="sFineRate" value="${s.fineRatePerDay}" style="width:100%; padding:8px;">
          </div>
          <div>
            <label>Default Borrowing Period (Days)</label>
            <input type="number" id="sBorrowDays" value="${s.defaultBorrowDays}" style="width:100%; padding:8px;">
          </div>
          <div>
            <label>Max Allowed Books Per Student</label>
            <input type="number" id="sMaxBooks" value="${s.maxBooksPerStudent}" style="width:100%; padding:8px;">
          </div>
          <button type="submit" class="btn btn-primary">Update Rules</button>
        </form>
      </div>
    `;

    document
      .getElementById("settingsForm")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        await API.request("/admin/settings", {
          method: "PUT",
          body: JSON.stringify({
            fineRatePerDay: document.getElementById("sFineRate").value,
            defaultBorrowDays: document.getElementById("sBorrowDays").value,
            maxBooksPerStudent: document.getElementById("sMaxBooks").value,
          }),
        });
        Utils.showToast("Rules updated successfully", "success");
      });
  },
};

document.addEventListener("DOMContentLoaded", () => Admin.init());
