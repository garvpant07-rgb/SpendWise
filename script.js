
const $ = id => document.getElementById(id);

const money = amount => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2
}).format(Number(amount) || 0);

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
const thisMonth = () => today().slice(0,7);

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}

let expenses = read("spendwise_expenses", []);
let budget = Number(read("spendwise_budget", 10000));
let goals = read("spendwise_goals", []);
let editingId = null;
let toastTimer;

const icons = {
  Food:"🍜", Travel:"🚌", Shopping:"🛍️",
  Education:"📚", Entertainment:"🎮", Other:"✦"
};

function save() {
  localStorage.setItem("spendwise_expenses", JSON.stringify(expenses));
  localStorage.setItem("spendwise_budget", JSON.stringify(budget));
  localStorage.setItem("spendwise_goals", JSON.stringify(goals));
}

function notify(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("toast").classList.remove("show"), 2500);
}

/* Click SpendWise logo from anywhere to return home */
function goToHome() {
  $("workspace").classList.add("hidden");
  $("welcome").classList.remove("hidden");
  window.scrollTo({top:0, behavior:"smooth"});
}
document.querySelectorAll("[data-home]").forEach(logo => {
  logo.addEventListener("click", goToHome);
});

/* Landing page button */
document.querySelector("[data-enter]").addEventListener("click", () => {
  $("welcome").classList.add("hidden");
  $("workspace").classList.remove("hidden");
  navigate("overview");
});

/* Navigation between dashboard sections */
const pageInfo = {
  overview:["Overview","Here's how your money is looking."],
  transactions:["Transactions","All your expenses in one place."],
  analytics:["Analytics","Understand your spending habits."],
  budgets:["Budgets & Goals","Set a budget that works for you."]
};

function navigate(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  $("page-" + page).classList.remove("hidden");

  document.querySelectorAll(".nav").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });

  $("pageTitle").textContent = pageInfo[page][0];
  $("pageDescription").textContent = pageInfo[page][1];

  renderAll();
  window.scrollTo({top:0, behavior:"smooth"});
}

document.querySelectorAll("[data-page]").forEach(btn => {
  btn.addEventListener("click", () => navigate(btn.dataset.page));
});

function monthExpenses() {
  return expenses.filter(e => e.date && e.date.slice(0,7) === thisMonth());
}
function spentThisMonth() {
  return monthExpenses().reduce((sum,e) => sum + Number(e.amount), 0);
}

/* Overview */
function renderOverview() {
  const spent = spentThisMonth();
  const remaining = budget - spent;
  const percentage = budget > 0 ? Math.min(100, spent / budget * 100) : 0;

  $("totalSpent").textContent = money(spent);
  $("budgetDisplay").textContent = money(budget);
  $("remaining").textContent = money(remaining);
  $("remaining").style.color = remaining < 0 ? "#fca5a5" : "";
  $("remainingNote").textContent = remaining < 0
    ? "You've exceeded your budget"
    : remaining < budget * .2
      ? "Budget running low"
      : "You're on track";

  $("budgetPercent").textContent = Math.round(percentage) + "%";
  $("budgetDonut").style.setProperty("--progress", percentage + "%");
  $("budgetUsed").textContent = money(spent);
  $("budgetLeftSmall").textContent = money(Math.max(0,remaining));
  $("budgetMessage").textContent = remaining < 0
    ? "You're over budget. Review your spending."
    : money(remaining) + " remaining in your monthly budget.";

  const recent = [...expenses].sort((a,b) => b.date.localeCompare(a.date)).slice(0,5);
  $("recentList").innerHTML = recent.map(e => transactionHTML(e)).join("");
  $("recentEmpty").classList.toggle("hidden", recent.length > 0);
  renderWeek("weeklyChart");
}

function transactionHTML(e, actions=false) {
  return `<div class="transaction">
    <div class="tx-icon">${icons[e.category] || "✦"}</div>
    <div class="tx-info"><b>${escapeHTML(e.name)}</b>
      <small>${escapeHTML(e.category)} · ${escapeHTML(e.date)}</small>
    </div>
    <div class="tx-amount">−${money(e.amount)}</div>
    ${actions ? `<div class="tx-actions">
      <button data-edit="${e.id}">Edit</button>
      <button data-delete="${e.id}">Delete</button>
    </div>` : ""}
  </div>`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[c]));
}

/* Weekly chart */
function weekData() {
  const result = [];
  for (let i=6; i>=0; i--) {
    const d = new Date();
    d.setDate(d.getDate()-i);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const amount = expenses.filter(e => e.date === key)
      .reduce((sum,e) => sum + Number(e.amount), 0);
    result.push({label:d.toLocaleDateString("en",{weekday:"short"}), key, amount});
  }
  return result;
}

function renderWeek(id) {
  const data = weekData();
  const max = Math.max(1,...data.map(d => d.amount));
  $(id).innerHTML = data.map(d => `
    <div class="week-col" title="${d.key}: ${money(d.amount)}">
      <div class="week-bar" style="height:${Math.max(3,d.amount/max*100)}%"></div>
      <small>${d.label}</small>
    </div>`).join("");
}

/* Transactions, search and filters */
function renderTransactions() {
  const search = $("searchInput").value.trim().toLowerCase();
  const category = $("categoryFilter").value;
  const month = $("dateFilter").value;

  const filtered = [...expenses].filter(e =>
    (!search || e.name.toLowerCase().includes(search) ||
      e.category.toLowerCase().includes(search)) &&
    (!category || e.category === category) &&
    (!month || e.date.startsWith(month))
  ).sort((a,b) => b.date.localeCompare(a.date));

  $("transactionCount").textContent = filtered.length + " transactions";
  $("expenseList").innerHTML = filtered.map(e => transactionHTML(e,true)).join("");
  $("emptyState").classList.toggle("hidden", filtered.length > 0);
}

["searchInput","categoryFilter","dateFilter"].forEach(id => {
  $(id).addEventListener(id === "searchInput" ? "input" : "change", renderTransactions);
});

/* Analytics */
function renderAnalytics() {
  const total = expenses.reduce((sum,e) => sum + Number(e.amount),0);
  const categories = {};

  expenses.forEach(e => {
    categories[e.category] = (categories[e.category] || 0) + Number(e.amount);
  });

  const sorted = Object.entries(categories).sort((a,b) => b[1]-a[1]);

  $("analyticsTotal").textContent = money(total);
  $("topCategory").textContent = sorted[0]?.[0] || "—";
  $("averageExpense").textContent = money(expenses.length ? total/expenses.length : 0);

  $("categoryChart").innerHTML = sorted.map(([name,amount]) => `
    <div class="category-row">
      <div class="budget-line"><span>${icons[name] || "✦"} ${escapeHTML(name)}</span><b>${money(amount)}</b></div>
      <div class="progress"><i style="width:${total ? amount/total*100 : 0}%"></i></div>
    </div>`).join("");

  $("chartEmpty").classList.toggle("hidden", sorted.length > 0);
  renderWeek("analyticsWeekly");
}

/* CUSTOM MONTHLY BUDGET */
function renderBudgetPage() {
  const spent = spentThisMonth();
  const percentage = budget > 0 ? Math.min(100, spent/budget*100) : 0;

  $("budgetInput").value = budget;
  $("bigBudget").textContent = money(spent);
  $("budgetBar").style.width = percentage + "%";
  $("budgetProgressLabel").textContent =
    money(Math.max(0,budget-spent)) + " remaining out of " + money(budget);

  $("goalsList").innerHTML = goals.map(g => {
    const percentage = Math.min(100, g.target ? g.saved/g.target*100 : 0);
    return `<div class="goal">
      <div class="budget-line"><b>${escapeHTML(g.name)}</b>
        <button class="text-button" data-goal-delete="${g.id}">Remove</button>
      </div>
      <div class="budget-line"><span>${money(g.saved)} saved of ${money(g.target)}</span><b>${Math.round(percentage)}%</b></div>
      <div class="progress"><i style="width:${percentage}%"></i></div>
    </div>`;
  }).join("");

  $("goalsEmpty").classList.toggle("hidden", goals.length > 0);
}

/* This form changes the budget for the entire dashboard */
$("budgetForm").addEventListener("submit", event => {
  event.preventDefault();
  const newBudget = Number($("budgetInput").value);

  if (!Number.isFinite(newBudget) || newBudget <= 0) {
    notify("Enter a budget greater than zero.");
    return;
  }

  budget = newBudget;
  save();
  renderAll();
  notify("Your monthly budget has been updated!");
});

/* Add and edit expenses */
function openExpense(id=null) {
  editingId = id;
  $("expenseForm").reset();
  $("expenseDate").value = today();

  if (id !== null) {
    const e = expenses.find(item => item.id === id);
    if (!e) return;
    $("expenseName").value = e.name;
    $("expenseAmount").value = e.amount;
    $("expenseCategory").value = e.category;
    $("expenseDate").value = e.date;
    $("modalTitle").textContent = "Edit expense";
  } else {
    $("modalTitle").textContent = "Add an expense";
  }

  $("expenseModal").classList.remove("hidden");
}

function closeExpense() {
  $("expenseModal").classList.add("hidden");
  $("expenseForm").reset();
  editingId = null;
}

$("openForm").addEventListener("click", () => openExpense());
$("closeForm").addEventListener("click", closeExpense);
$("cancelForm").addEventListener("click", closeExpense);
$("expenseModal").addEventListener("click", e => {
  if (e.target === $("expenseModal")) closeExpense();
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeExpense();
});

$("expenseForm").addEventListener("submit", event => {
  event.preventDefault();

  /* Save this before closeExpense resets editingId */
  const wasEditing = editingId !== null;

  const record = {
    id: wasEditing ? editingId : Date.now(),
    name: $("expenseName").value.trim(),
    amount: Number($("expenseAmount").value),
    category: $("expenseCategory").value,
    date: $("expenseDate").value
  };

  if (!record.name || !Number.isFinite(record.amount) ||
      record.amount <= 0 || !record.date) {
    notify("Please enter valid expense details.");
    return;
  }

  if (wasEditing) {
    expenses = expenses.map(e => e.id === editingId ? record : e);
  } else {
    expenses.push(record);
  }

  save();
  closeExpense();
  renderAll();
  notify(wasEditing ? "Expense updated successfully!" : "Expense added successfully!");
});

/* Delete transactions and savings goals */
document.addEventListener("click", event => {
  const editButton = event.target.closest("[data-edit]");
  if (editButton) {
    openExpense(Number(editButton.dataset.edit));
    return;
  }

  const deleteButton = event.target.closest("[data-delete]");
  if (deleteButton) {
    const id = Number(deleteButton.dataset.delete);
    expenses = expenses.filter(e => e.id !== id);
    save();
    renderAll();
    notify("Expense deleted.");
    return;
  }

  const goalButton = event.target.closest("[data-goal-delete]");
  if (goalButton) {
    goals = goals.filter(g => g.id !== Number(goalButton.dataset.goalDelete));
    save();
    renderBudgetPage();
    notify("Savings goal removed.");
  }
});

/* Savings goals */
$("goalForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("goalName").value.trim();
  const target = Number($("goalTarget").value);
  const savedAmount = Number($("goalSaved").value);

  if (!name || !Number.isFinite(target) || target <= 0 ||
      !Number.isFinite(savedAmount) || savedAmount < 0) {
    notify("Please enter valid goal details.");
    return;
  }

  goals.push({id:Date.now(), name, target, saved:savedAmount});
  save();
  $("goalForm").reset();
  $("goalSaved").value = 0;
  renderBudgetPage();
  notify("Savings goal created!");
});

function renderAll() {
  renderOverview();
  renderTransactions();
  renderAnalytics();
  renderBudgetPage();
}

$("todayDate").textContent = new Date().toLocaleDateString("en-IN", {
  day:"numeric", month:"short", year:"numeric"
});

renderAll();

