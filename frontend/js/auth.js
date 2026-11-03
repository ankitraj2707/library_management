document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const pwdToggle = document.getElementById("pwdToggle");
  const pwdInput = document.getElementById("password");
  const loginBtn = document.getElementById("loginBtn");

  pwdToggle.addEventListener("click", () => {
    if (pwdInput.type === "password") {
      pwdInput.type = "text";
      pwdToggle.textContent = "Hide";
    } else {
      pwdInput.type = "password";
      pwdToggle.textContent = "Show";
    }
  });

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginBtn.disabled = true;
    loginBtn.textContent = "Signing in...";

    const email = document.getElementById("email").value.trim();
    const password = pwdInput.value;

    try {
      const res = await API.request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      if (res.success) {
        localStorage.setItem("token", res.token);
        localStorage.setItem("user", JSON.stringify(res.user));

        Utils.showToast("Login successful! Redirecting...", "success");

        setTimeout(() => {
          if (res.user.role === "ADMIN") {
            window.location.href = "/admin-dashboard.html";
          } else {
            window.location.href = "/student-dashboard.html";
          }
        }, 800);
      }
    } catch (err) {
      // Toast displayed by API.request
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = "Sign In";
    }
  });
});
