
"use strict";

/* =====================================
   1. KONFIGURASI DAN PENYIMPANAN
===================================== */

const STORAGE = {
  transactions: "keuangan_pribadi_transactions_v1",
  notes: "keuangan_pribadi_notes_v1"
};

const $ = (id) => document.getElementById(id);

function loadData(key) {
  try {
    const raw = localStorage.getItem(key);

    if (raw === null) {
      return { data: [], valid: true };
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error("Format data tidak valid");
    }

    return { data: parsed, valid: true };
  } catch (error) {
    console.error("Gagal membaca data:", key, error);
    return { data: [], valid: false };
  }
}

const txLoad = loadData(STORAGE.transactions);
const noteLoad = loadData(STORAGE.notes);

let transactions = txLoad.data;
let notes = noteLoad.data;

let transactionEditId = null;
let noteEditId = null;

/* Jangan menimpa data yang gagal dibaca. */
const storageReady = {
  transactions: txLoad.valid,
  notes: noteLoad.valid
};

function saveData(type) {
  const key = STORAGE[type];
  const data = type === "transactions" ? transactions : notes;

  if (!storageReady[type]) {
    notify("Data lama gagal dibaca. Penyimpanan diblokir agar data tidak tertimpa.");
    return false;
  }

  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Gagal menyimpan data:", error);
    notify("Penyimpanan gagal. Periksa kapasitas browser.");
    return false;
  }
}

function notify(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.style.display = "block";

  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => {
    toast.style.display = "none";
  }, 2600);
}

/* =====================================
   2. FUNGSI UMUM
===================================== */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function today() {
  const d = new Date();

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
}

function formatDate(value) {
  const d = new Date(value + "T12:00:00");

  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatRupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(value);
}

function makeId() {
  if (crypto.randomUUID) return crypto.randomUUID();

  return Date.now().toString(36) +
    Math.random().toString(36).slice(2);
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const d = new Date(value + "T12:00:00");

  return !Number.isNaN(d.getTime()) &&
    d.toISOString().slice(0, 10) === value;
}

/* =====================================
   3. NAVIGASI TAB
===================================== */

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    const target = button.dataset.page;

    document.querySelectorAll(".tab").forEach((tab) => {
      tab.classList.toggle("active", tab === button);
    });

    document.querySelectorAll(".page").forEach((page) => {
      page.classList.toggle("active", page.id === target);
    });
  });
});

/* =====================================
   4. KATEGORI TRANSAKSI
===================================== */

const categories = {
  income: [
    "Gaji",
    "Usaha",
    "Bonus",
    "Investasi",
    "Hadiah",
    "Lainnya"
  ],
  expense: [
    "Makanan",
    "Transportasi",
    "Belanja",
    "Tagihan",
    "Pendidikan",
    "Kesehatan",
    "Hiburan",
    "Tempat Tinggal",
    "Lainnya"
  ]
};

function updateCategories(selected) {
  const type = $("txType").value;
  const select = $("txCategory");

  select.innerHTML = categories[type]
    .map((category) =>
      `<option value="${escapeHTML(category)}">${
        escapeHTML(category)
      }</option>`
    ).join("");

  if (selected && categories[type].includes(selected)) {
    select.value = selected;
  }
}

$("txType").addEventListener("change", () => {
  updateCategories();
});

updateCategories();

/* =====================================
   5. FORM TRANSAKSI
===================================== */

$("txDate").value = today();

$("transactionForm").addEventListener("submit", (event) => {
  event.preventDefault();

  if (!storageReady.transactions) {
    notify("Data transaksi tidak dapat dibaca. Periksa penyimpanan browser.");
    return;
  }

  const date = $("txDate").value;
  const amount = Number($("txAmount").value);

  if (!validDate(date)) {
    notify("Tanggal transaksi tidak valid.");
    return;
  }

  if (!Number.isSafeInteger(amount) || amount <= 0) {
    notify("Jumlah harus berupa bilangan bulat positif.");
    return;
  }

  if (amount > Number.MAX_SAFE_INTEGER) {
    notify("Jumlah transaksi terlalu besar.");
    return;
  }

  const existing = transactionEditId
    ? transactions.find((tx) => tx.id === transactionEditId)
    : null;

  if (transactionEditId && !existing) {
    notify("Transaksi yang diedit tidak ditemukan.");
    return;
  }

  const transaction = {
    id: transactionEditId || makeId(),
    date,
    type: $("txType").value,
    category: $("txCategory").value,
    amount,
    description: $("txDescription").value.trim(),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const previous = transactions;

  transactions = transactionEditId
    ? transactions.map((tx) =>
        tx.id === transactionEditId ? transaction : tx
      )
    : [...transactions, transaction];

  if (!saveData("transactions")) {
    transactions = previous;
    return;
  }

  resetTransactionForm();
  renderTransactions();
  notify("Transaksi berhasil disimpan.");
});

function resetTransactionForm() {
  transactionEditId = null;
  $("transactionForm").reset();
  $("txDate").value = today();
  $("txType").value = "income";
  updateCategories();

  $("transactionFormTitle").textContent = "Tambah Transaksi";
  $("txSubmit").textContent = "+ Simpan Transaksi";
  $("txCancel").hidden = true;
  $("txMessage").textContent = "";
}

$("txCancel").addEventListener("click", resetTransactionForm);

/* =====================================
   6. RINGKASAN DAN RIWAYAT TRANSAKSI
===================================== */

function renderTransactions() {
  const income = transactions
    .filter((tx) => tx.type === "income")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const expense = transactions
    .filter((tx) => tx.type === "expense")
    .reduce((sum, tx) => sum + tx.amount, 0);

  $("totalIncome").textContent = formatRupiah(income);
  $("totalExpense").textContent = formatRupiah(expense);
  $("balance").textContent = formatRupiah(income - expense);

  const sorted = [...transactions].sort((a, b) =>
    b.date.localeCompare(a.date) ||
    String(b.createdAt).localeCompare(String(a.createdAt))
  );

  $("transactionList").innerHTML = sorted.map((tx) => `
    <tr>
      <td>${escapeHTML(formatDate(tx.date))}</td>
      <td>
        <strong>${tx.type === "income" ? "Pemasukan" : "Pengeluaran"}</strong>
        <br>
        <span class="muted">${escapeHTML(tx.category)}</span>
      </td>
      <td>${escapeHTML(tx.description || "-")}</td>
      <td class="right ${
        tx.type === "income" ? "money-in" : "money-out"
      }">
        ${tx.type === "income" ? "+" : "-"}${escapeHTML(formatRupiah(tx.amount))}
      </td>
      <td>
        <div class="table-actions">
          <button class="btn secondary"
            data-edit-tx="${escapeHTML(tx.id)}"
            aria-label="Edit transaksi">Edit</button>
          <button class="btn danger"
            data-delete-tx="${escapeHTML(tx.id)}"
            aria-label="Hapus transaksi">Hapus</button>
        </div>
      </td>
    </tr>
  `).join("");

  $("transactionEmpty").hidden = sorted.length > 0;
}

$("transactionList").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-tx]");
  const deleteButton = event.target.closest("[data-delete-tx]");

  if (editButton) {
    const tx = transactions.find(
      (item) => item.id === editButton.dataset.editTx
    );

    if (!tx) return;

    transactionEditId = tx.id;
    $("txDate").value = tx.date;
    $("txType").value = tx.type;
    updateCategories(tx.category);
    $("txAmount").value = tx.amount;
    $("txDescription").value = tx.description;

    $("transactionFormTitle").textContent = "Edit Transaksi";
    $("txSubmit").textContent = "Simpan Perubahan";
    $("txCancel").hidden = false;

    $("transactionForm").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  if (deleteButton) {
    const id = deleteButton.dataset.deleteTx;
    const tx = transactions.find((item) => item.id === id);

    if (!tx || !confirm("Hapus transaksi ini?")) return;

    const previous = transactions;
    transactions = transactions.filter((item) => item.id !== id);

    if (!saveData("transactions")) {
      transactions = previous;
      return;
    }

    if (transactionEditId === id) resetTransactionForm();

    renderTransactions();
    notify("Transaksi berhasil dihapus.");
  }
});

/* =====================================
   7. FORM CATATAN PRIBADI
===================================== */

$("noteForm").addEventListener("submit", (event) => {
  event.preventDefault();

  if (!storageReady.notes) {
    notify("Data catatan tidak dapat dibaca. Periksa penyimpanan browser.");
    return;
  }

  const title = $("noteTitle").value.trim();
  const content = $("noteContent").value.trim();

  if (!title || !content) {
    notify("Judul dan isi catatan wajib diisi.");
    return;
  }

  const existing = noteEditId
    ? notes.find((note) => note.id === noteEditId)
    : null;

  if (noteEditId && !existing) {
    notify("Catatan yang diedit tidak ditemukan.");
    return;
  }

  const note = {
    id: noteEditId || makeId(),
    title,
    content,
    category: $("noteCategory").value,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const previous = notes;

  notes = noteEditId
    ? notes.map((item) => item.id === noteEditId ? note : item)
    : [...notes, note];

  if (!saveData("notes")) {
    notes = previous;
    return;
  }

  resetNoteForm();
  renderNotes();
  notify("Catatan berhasil disimpan.");
});

function resetNoteForm() {
  noteEditId = null;
  $("noteForm").reset();
  $("noteFormTitle").textContent = "Tulis Catatan Baru";
  $("noteSubmit").textContent = "+ Simpan Catatan";
  $("noteCancel").hidden = true;
  $("noteMessage").textContent = "";
}

$("noteCancel").addEventListener("click", resetNoteForm);

/* =====================================
   8. CARI, FILTER, DAN KARTU CATATAN
===================================== */

function renderNotes() {
  const query = $("noteSearch").value.trim().toLocaleLowerCase("id-ID");
  const category = $("noteFilter").value;

  const result = notes
    .filter((note) => {
      const matchesCategory =
        category === "Semua" || note.category === category;

      const text = `${note.title} ${note.content} ${note.category}`
        .toLocaleLowerCase("id-ID");

      return matchesCategory && text.includes(query);
    })
    .sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt))
    );

  $("noteCount").textContent = `${notes.length} catatan`;

  $("noteList").innerHTML = result.map((note) => `
    <article class="note-card">
      <h3>${escapeHTML(note.title)}</h3>
      <div class="muted">
        Dibuat: ${escapeHTML(new Date(note.createdAt).toLocaleString("id-ID"))}
      </div>
      <div class="note-content">${escapeHTML(note.content)}</div>
      <span class="note-tag">${escapeHTML(note.category)}</span>

      <div class="note-actions">
        <button class="btn secondary"
          data-edit-note="${escapeHTML(note.id)}">Edit</button>
        <button class="btn danger"
          data-delete-note="${escapeHTML(note.id)}">Hapus</button>
      </div>
    </article>
  `).join("");

  $("noteEmpty").hidden = result.length > 0;
}

$("noteSearch").addEventListener("input", renderNotes);
$("noteFilter").addEventListener("change", renderNotes);

$("noteList").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-note]");
  const deleteButton = event.target.closest("[data-delete-note]");

  if (editButton) {
    const note = notes.find(
      (item) => item.id === editButton.dataset.editNote
    );

    if (!note) return;

    noteEditId = note.id;
    $("noteTitle").value = note.title;
    $("noteContent").value = note.content;
    $("noteCategory").value = note.category;

    $("noteFormTitle").textContent = "Edit Catatan";
    $("noteSubmit").textContent = "Simpan Perubahan";
    $("noteCancel").hidden = false;

    $("noteForm").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  if (deleteButton) {
    const id = deleteButton.dataset.deleteNote;
    const note = notes.find((item) => item.id === id);

    if (!note || !confirm(`Hapus catatan "${note.title}"?`)) return;

    const previous = notes;
    notes = notes.filter((item) => item.id !== id);

    if (!saveData("notes")) {
      notes = previous;
      return;
    }

    if (noteEditId === id) resetNoteForm();

    renderNotes();
    notify("Catatan berhasil dihapus.");
  }
});

/* =====================================
   9. EKSPOR CADANGAN
===================================== */

$("exportData").addEventListener("click", exportBackup);

function exportBackup() {
  const backup = {
    app: "Keuangan & Catatan Pribadi",
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions,
    notes
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: "application/json;charset=utf-8" }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "cadangan-keuangan-catatan.json";
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify("File cadangan dibuat.");
}

/* =====================================
   10. INISIALISASI APLIKASI
===================================== */

if (!storageReady.transactions || !storageReady.notes) {
  notify("Ada data yang gagal dibaca. Jangan hapus data browser.");
}

renderTransactions();
renderNotes();
