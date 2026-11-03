const API = {
  baseUrl: "/api",

  async request(endpoint, options = {}) {
    const defaultHeaders = {
      "Content-Type": "application/json",
    };

    const token = localStorage.getItem("token");
    if (token) {
      defaultHeaders["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: { ...defaultHeaders, ...options.headers },
      });

      const data = await response.json();

      if (response.status === 401 && !endpoint.includes("/auth/login")) {
        localStorage.clear();
        window.location.href = "/index.html";
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || "An error occurred.");
      }

      return data;
    } catch (err) {
      Utils.showToast(err.message, "error");
      throw err;
    }
  },
};
