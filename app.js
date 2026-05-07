const companies = ["BESSGX", "Spark.e", "Energy Pulse"];
const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const storageKey = "rendiciones-expenses-v1";
const sampleSuppliers = [
  { name: "Copec S.A.", rut: "99.520.000-7", category: "Combustible", total: 68490 },
  { name: "Sodexo Chile S.A.", rut: "96.792.430-K", category: "Alimentación", total: 23990 },
  { name: "Easy Retail S.A.", rut: "96.671.750-5", category: "Herramientas / materiales", total: 129900 },
  { name: "Entel PCS Telecomunicaciones S.A.", rut: "96.806.980-2", category: "Servicios", total: 44990 },
];

const state = {
  imageData: "",
  expenses: loadExpenses(),
  editingId: "",
};

const $ = (id) => document.getElementById(id);
const companyTheme = {
  BESSGX: "theme-bessgx",
  "Spark.e": "theme-spark",
  "Energy Pulse": "theme-energy",
};
const formatCLP = (value) =>
  new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 }).format(value || 0);

function loadExpenses() {
  const saved = localStorage.getItem(storageKey);
  if (saved) return JSON.parse(saved);

  return [];
}

function makeExpense(company, category, supplierName, supplierRut, date, total, image = "") {
  const net = Math.round(total / 1.19);
  return {
    id: crypto.randomUUID(),
    company,
    category,
    supplierName,
    supplierRut,
    date: date.toISOString().slice(0, 10),
    net,
    vat: total - net,
    total,
    image,
    comment: "",
    status: "pendiente",
  };
}

function saveExpenses() {
  localStorage.setItem(storageKey, JSON.stringify(state.expenses));
}

function bindTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach((item) => item.classList.remove("active"));
      document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
      tab.classList.add("active");
      $(`${tab.dataset.view}View`).classList.add("active");
      render();
    });
  });
}

function bindCapture() {
  $("receiptInput").addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      state.imageData = reader.result;
      $("receiptPreview").src = state.imageData;
      $("receiptPreview").style.display = "block";
      document.querySelector(".camera-empty").style.display = "none";
    };
    reader.readAsDataURL(file);
  });

  $("scanBtn").addEventListener("click", () => {
    const sample = sampleSuppliers[Math.floor(Math.random() * sampleSuppliers.length)];
    const net = Math.round(sample.total / 1.19);
    $("supplierName").value = sample.name;
    $("supplierRut").value = sample.rut;
    $("category").value = sample.category;
    $("date").value = new Date().toISOString().slice(0, 10);
    $("net").value = net;
    $("vat").value = sample.total - net;
    $("total").value = sample.total;
  });

  $("total").addEventListener("input", () => {
    const total = Number($("total").value.replace(/\D/g, ""));
    const net = Math.round(total / 1.19);
    $("net").value = total ? net : "";
    $("vat").value = total ? total - net : "";
  });

  $("expenseForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const expense = {
      id: state.editingId || crypto.randomUUID(),
      company: $("company").value,
      category: $("category").value,
      supplierName: $("supplierName").value,
      supplierRut: $("supplierRut").value,
      date: $("date").value,
      net: Number($("net").value.replace(/\D/g, "")),
      vat: Number($("vat").value.replace(/\D/g, "")),
      total: Number($("total").value.replace(/\D/g, "")),
      image: state.imageData,
      comment: $("comment").value.trim(),
      status: "pendiente",
    };

    if (state.editingId) {
      state.expenses = state.expenses.map((item) => (item.id === state.editingId ? expense : item));
    } else {
      state.expenses.unshift(expense);
    }

    saveExpenses();
    resetCaptureForm();
    syncCompanyControls(expense.company);
    document.querySelector('[data-view="dashboard"]').click();
  });

  $("company").addEventListener("change", () => applyTheme($("company").value));
  $("cancelEditBtn").addEventListener("click", resetCaptureForm);
}

function bindDashboard() {
  $("dashboardCompany").addEventListener("change", render);
  $("exportBtn").addEventListener("click", () => exportCsv());
  $("historyCompany").addEventListener("change", render);
  $("reportCompany").addEventListener("change", render);
  $("reportMonth").addEventListener("change", render);
  $("sendReportBtn").addEventListener("click", sendReport);
  $("downloadReportBtn").addEventListener("click", downloadReport);
  $("recentList").addEventListener("click", handleExpenseAction);
}

function currentMonthExpenses(company) {
  const now = new Date();
  return state.expenses.filter((expense) => {
    const date = new Date(`${expense.date}T00:00:00`);
    return (
      expense.company === company &&
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  });
}

function expensesByCompanyYear(company) {
  const year = new Date().getFullYear();
  return state.expenses.filter((expense) => {
    const date = new Date(`${expense.date}T00:00:00`);
    return expense.company === company && date.getFullYear() === year;
  });
}

function reportExpenses() {
  const company = $("reportCompany").value;
  const month = $("reportMonth").value;
  return state.expenses.filter((expense) => expense.company === company && expense.date.startsWith(month));
}

function renderDashboard() {
  const company = $("dashboardCompany").value;
  const expenses = currentMonthExpenses(company);
  const total = expenses.reduce((sum, expense) => sum + expense.total, 0);
  $("monthTotal").textContent = formatCLP(total);
  $("monthCount").textContent = `${expenses.length} documento${expenses.length === 1 ? "" : "s"}`;
  $("currentMonthLabel").textContent = monthNames[new Date().getMonth()];

  const byCategory = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.total;
    return acc;
  }, {});

  const rows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  $("categoryList").innerHTML = rows.length
    ? rows
        .map(([category, value]) => {
          const width = total ? Math.max(8, Math.round((value / total) * 100)) : 0;
          return `
            <div class="category-row">
              <div class="row-head"><strong>${category}</strong><span>${formatCLP(value)}</span></div>
              <div class="bar-track"><div class="bar-fill" style="--w: ${width}%"></div></div>
            </div>
          `;
        })
        .join("")
    : `<p class="empty">Sin gastos guardados este mes para ${company}.</p>`;
}

function renderHistory() {
  const company = $("historyCompany").value;
  const monthly = Array.from({ length: 12 }, () => 0);
  expensesByCompanyYear(company).forEach((expense) => {
    const date = new Date(`${expense.date}T00:00:00`);
    monthly[date.getMonth()] += expense.total;
  });
  const max = Math.max(...monthly, 1);

  $("historyChart").innerHTML = monthly
    .map((value, index) => {
      const height = value ? Math.max(8, Math.round((value / max) * 140)) : 4;
      return `<div class="month-bar" title="${formatCLP(value)}"><i style="--h: ${height}px"></i><span>${monthNames[index]}</span></div>`;
    })
    .join("");

  const recent = expensesByCompanyYear(company);
  $("recentList").innerHTML = recent.length
    ? recent
        .slice(0, 6)
        .map(
          (expense) => `
          <div class="recent-row">
            ${
              expense.image
                ? `<img class="thumb" src="${expense.image}" alt="Documento de ${expense.supplierName}" />`
                : `<div class="thumb" aria-hidden="true"></div>`
            }
            <div class="recent-copy">
              <strong>${expense.supplierName}</strong>
              <span>${expense.company} · ${expense.category} · ${expense.date}</span>
            </div>
            <div class="recent-side">
              <strong>${formatCLP(expense.total)}</strong>
              <div class="row-actions">
                <button class="mini-action" data-action="edit" data-id="${expense.id}" type="button">Editar</button>
                <button class="mini-action danger" data-action="delete" data-id="${expense.id}" type="button">Eliminar</button>
              </div>
            </div>
          </div>
        `,
        )
        .join("")
    : `<p class="empty">Aún no hay gastos guardados para ${company} este año.</p>`;
}

function renderReport() {
  const expenses = reportExpenses();
  const total = expenses.reduce((sum, expense) => sum + expense.total, 0);
  $("reportCount").textContent = expenses.length;
  $("reportTotal").textContent = formatCLP(total);
}

function exportCsv(expenses = state.expenses, name = `rendiciones-${new Date().toISOString().slice(0, 10)}.csv`) {
  const rows = [
    ["Empresa", "Tipo", "Fecha", "RUT", "Razon Social", "Neto", "IVA", "Total", "Comentario", "Estado"],
    ...expenses.map((expense) => [
      expense.company,
      expense.category,
      expense.date,
      expense.supplierRut,
      expense.supplierName,
      expense.net,
      expense.vat,
      expense.total,
      expense.comment || "",
      expense.status,
    ]),
  ];

  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadReport() {
  const company = $("reportCompany").value;
  const month = $("reportMonth").value;
  exportCsv(reportExpenses(), `rendiciones-${company.toLowerCase().replaceAll(" ", "-")}-${month}.csv`);
}

function sendReport() {
  const company = $("reportCompany").value;
  const month = $("reportMonth").value;
  const email = $("reportEmail").value.trim() || "daniel.diaz@spark-e.cl";
  const expenses = reportExpenses();
  const total = expenses.reduce((sum, expense) => sum + expense.total, 0);
  const subject = `Rendicion ${company} ${month}`;
  const body = [
    `Hola,`,
    ``,
    `Adjunto/comparto reporte de rendiciones.`,
    ``,
    `Empresa: ${company}`,
    `Mes: ${month}`,
    `Documentos: ${expenses.length}`,
    `Total: ${formatCLP(total)}`,
    ``,
    `Nota: para adjuntar el CSV, usa el boton "Descargar mes" y adjuntalo a este correo.`,
  ].join("\n");

  window.location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  $("sendStatus").textContent = `Correo preparado para ${email}.`;
}

function handleExpenseAction(event) {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const expense = state.expenses.find((item) => item.id === button.dataset.id);
  if (!expense) return;

  if (button.dataset.action === "edit") {
    startEdit(expense);
    return;
  }

  state.expenses = state.expenses.filter((item) => item.id !== expense.id);
  saveExpenses();
  if (state.editingId === expense.id) resetCaptureForm();
  render();
}

function startEdit(expense) {
  state.editingId = expense.id;
  state.imageData = expense.image || "";
  $("company").value = expense.company;
  $("category").value = expense.category;
  $("supplierName").value = expense.supplierName;
  $("supplierRut").value = expense.supplierRut;
  $("date").value = expense.date;
  $("net").value = expense.net;
  $("vat").value = expense.vat;
  $("total").value = expense.total;
  $("comment").value = expense.comment || "";
  $("saveExpenseBtn").textContent = "Actualizar gasto";
  $("cancelEditBtn").hidden = false;

  if (expense.image) {
    $("receiptPreview").src = expense.image;
    $("receiptPreview").style.display = "block";
    document.querySelector(".camera-empty").style.display = "none";
  } else {
    $("receiptPreview").style.display = "none";
    document.querySelector(".camera-empty").style.display = "grid";
  }

  syncCompanyControls(expense.company);
  document.querySelector('[data-view="capture"]').click();
}

function resetCaptureForm() {
  $("expenseForm").reset();
  state.editingId = "";
  state.imageData = "";
  $("date").value = new Date().toISOString().slice(0, 10);
  $("receiptPreview").style.display = "none";
  document.querySelector(".camera-empty").style.display = "grid";
  $("saveExpenseBtn").textContent = "Guardar gasto";
  $("cancelEditBtn").hidden = true;
}

function applyTheme(company) {
  document.body.classList.remove(...Object.values(companyTheme));
  document.body.classList.add(companyTheme[company] || "theme-spark");
}

function syncCompanyControls(company) {
  ["company", "dashboardCompany", "historyCompany", "reportCompany"].forEach((id) => {
    $(id).value = company;
  });
  applyTheme(company);
}

function render() {
  const activeView = document.querySelector(".tab.active")?.dataset.view;
  const themeCompany =
    activeView === "dashboard"
      ? $("dashboardCompany").value
      : activeView === "history"
        ? $("historyCompany").value
        : activeView === "report"
          ? $("reportCompany").value
          : $("company").value;
  applyTheme(themeCompany);
  renderDashboard();
  renderHistory();
  renderReport();
}

function init() {
  if (!localStorage.getItem("rendiciones-clean-install-v1")) {
    localStorage.removeItem("expense-demo-records");
    localStorage.removeItem(storageKey);
    localStorage.setItem("rendiciones-clean-install-v1", "true");
    state.expenses = [];
  }
  $("date").value = new Date().toISOString().slice(0, 10);
  $("reportMonth").value = new Date().toISOString().slice(0, 7);
  bindTabs();
  bindCapture();
  bindDashboard();
  syncCompanyControls($("company").value);
  render();
}

init();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("service-worker.js");
}
