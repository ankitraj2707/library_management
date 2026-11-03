const Student = {
  async init() {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || user.role !== "STUDENT") {
      window.location.href = "/index.html";
      return;
    }
    document.getElementById("studentGreeting").textContent =
      `${user.name} (${user.studentId || user.email})`;
    this.navigate("overview");
  },

  logout() {
    localStorage.clear();
    API.request("/auth/logout", { method: "POST" }).finally(() => {
      window.location.href = "/index.html";
    });
  },

  async navigate(view) {
    const content = document.getElementById("dynamicStudentContent");
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
      case "browse":
        await this.renderCatalog(content);
        break;
      case "issues":
        await this.renderIssues(content);
        break;
      case "fines":
        await this.renderFines(content);
        break;
    }
  },

  async renderOverview(container) {
    const res = await API.request("/student/dashboard");
    if (!res.success) return;
    const { stats, activeIssues, notifications } = res;

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><h3>Currently Issued</h3><div class="val">${stats.issuedCount}</div></div>
        <div class="stat-card"><h3>Pending Requests</h3><div class="val">${stats.pendingRequests}</div></div>
        <div class="stat-card"><h3>Books Returned</h3><div class="val">${stats.booksReturned}</div></div>
        <div class="stat-card"><h3>Unpaid Fines</h3><div class="val" style="color:var(--danger)">${Utils.formatCurrency(stats.outstandingFines)}</div></div>
      </div>

      <div class="card">
        <h3>Active Borrowings & Return Deadlines</h3>
        <div class="table-responsive">
          <table>
            <thead><tr><th>Title</th><th>Issue Date</th><th>Due Date</th></tr></thead>
            <tbody>
              ${activeIssues.length === 0 ? '<tr><td colspan="3">No active books checked out.</td></tr>' : ""}
              ${activeIssues
                .map(
                  (i) => `
                <tr>
                  <td>${i.book.title}</td>
                  <td>${Utils.formatDate(i.issueDate)}</td>
                  <td style="color: var(--danger); font-weight: 600;">${Utils.formatDate(i.dueDate)}</td>
                </tr>
              `,
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3>Notifications</h3>
        <ul style="list-style: none; margin-top: 10px;">
          ${notifications.length === 0 ? "<li>No notifications.</li>" : ""}
          ${notifications
            .map(
              (n) => `
            <li style="padding: 8px 0; border-bottom: 1px solid var(--border-light);">
              <strong>${n.title}</strong>: ${n.message} <br>
              <small style="color:var(--text-muted)">${Utils.formatDate(n.createdAt)}</small>
            </li>
          `,
            )
            .join("")}
        </ul>
      </div>
    `;
  },

  async renderCatalog(container) {
    const res = await API.request("/books?limit=50");
    container.innerHTML = `
      <div class="card">
        <h3>Library Catalog</h3>
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; margin-top: 16px;">
          ${res.data
            .map(
              (b) => `
            <div style="border: 1px solid var(--border-light); border-radius: 8px; padding: 12px; display: flex; flex-direction: column;">
              <img src="${b.coverImage || "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400"}" style="height: 140px; object-fit: cover; border-radius: 4px; margin-bottom: 8px;">
              <h4 style="font-size: 14px; margin-bottom: 4px;">${b.title}</h4>
              <p style="font-size: 12px; color: var(--text-muted); flex-grow: 1;">By ${b.author}</p>
              <div style="margin-top: 8px; font-size: 12px;">Available: <strong>${b.availableCopies}</strong></div>
              <button class="btn btn-primary" style="margin-top: 8px;" onclick="${b.availableCopies > 0 ? `Student.requestBook('${b.id}')` : `Student.reserveBook('${b.id}')`}">
                ${b.availableCopies > 0 ? "Request" : "Reserve"}
              </button>
            </div>
          `,
            )
            .join("")}
        </div>
      </div>
    `;
  },

  async requestBook(bookId) {
    await API.request("/circulation/request", {
      method: "POST",
      body: JSON.stringify({ bookId, notes: "Direct student catalog request" }),
    });
    Utils.showToast("Book request submitted for review", "success");
  },

  async reserveBook(bookId) {
    await API.request("/circulation/reserve", {
      method: "POST",
      body: JSON.stringify({ bookId }),
    });
    Utils.showToast("Book reserved into waitlist", "success");
  },

  async renderIssues(container) {
    const res = await API.request("/student/issues");
    container.innerHTML = `
      <div class="card">
        <h3>Borrowing History</h3>
        <div class="table-responsive">
          <table>
            <thead><tr><th>Book Title</th><th>Issue Date</th><th>Return Date</th><th>Status</th></tr></thead>
            <tbody>
              ${res.data.length === 0 ? '<tr><td colspan="4">No borrowings recorded.</td></tr>' : ""}
              ${res.data
                .map(
                  (i) => `
                <tr>
                  <td>${i.book.title}</td>
                  <td>${Utils.formatDate(i.issueDate)}</td>
                  <td>${i.returnDate ? Utils.formatDate(i.returnDate) : "Active"}</td>
                  <td><span class="badge ${i.status === "ISSUED" ? "badge-warning" : "badge-success"}">${i.status}</span></td>
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

  async renderFines(container) {
    const res = await API.request("/student/fines");
    container.innerHTML = `
      <div class="card">
        <h3>Fine Ledgers</h3>
        <div class="table-responsive">
          <table>
            <thead><tr><th>Book</th><th>Amount</th><th>Status</th><th>Receipt #</th></tr></thead>
            <tbody>
              ${res.data.length === 0 ? '<tr><td colspan="4">No fines on record.</td></tr>' : ""}
              ${res.data
                .map(
                  (f) => `
                <tr>
                  <td>${f.issue.book.title}</td>
                  <td>${Utils.formatCurrency(f.amount)}</td>
                  <td><span class="badge ${f.status === "PAID" ? "badge-success" : "badge-danger"}">${f.status}</span></td>
                  <td>${f.payment ? f.payment.receiptNo : "Pending"}</td>
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
};

document.addEventListener("DOMContentLoaded", () => Student.init());
