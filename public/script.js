const bookingForm = document.getElementById("booking-form");
const bookingMessage = document.getElementById("booking-message");
const bookingsList = document.getElementById("bookings-list");

const showMessage = (msg, color = "red") => {
  bookingMessage.textContent = msg;
  bookingMessage.style.color = color;
};

async function fetchBookings() {
  const res = await fetch("/api/bookings");
  const data = await res.json();
  displayBookings(data);
}

function displayBookings(bookings) {
  bookingsList.innerHTML = bookings.map(b => `
    <div class="booking-item">
      <div>
        <strong>${b.firstName} ${b.lastName}</strong>
        - ${b.destination} - ${b.date} - ${b.people} pers
        ${b.email ? `<div style="color:#64748b;font-size:0.9rem;">${b.email}</div>` : ""}
      </div>
      <button data-id="${b.id}" class="delete-btn">Ta bort</button>
    </div>
  `).join("");

  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => deleteBooking(btn.dataset.id));
  });
}

async function deleteBooking(id) {
  await fetch(`/api/bookings/${id}`, { method: "DELETE" });
  showMessage("Bokning borttagen! (avbokningsmail skickas)", "green");
  fetchBookings();
}

bookingForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const data = {
    firstName: document.getElementById("firstName").value.trim(),
    lastName: document.getElementById("lastName").value.trim(),
    email: document.getElementById("email").value.trim(),
    personnummer: document.getElementById("personnummer").value.trim(),
    destination: document.getElementById("destination").value,
    date: document.getElementById("date").value,
    people: document.getElementById("people").value
  };

  // Personnummer: 4 siffror
  if (!/^\d{4}$/.test(data.personnummer)) {
    return showMessage("Personnummer måste vara 4 siffror!");
  }

  // Email
  if (!/^\S+@\S+\.\S+$/.test(data.email)) {
    return showMessage("Skriv in en giltig e-post!");
  }

  // Datum: endast 2026
  const chosen = new Date(data.date);
  if (!data.date || isNaN(chosen.getTime()) || chosen.getFullYear() !== 2026) {
    return showMessage("Du kan bara boka datum under år 2026.");
  }

  // Antal personer: 1–7
  const peopleNum = Number(data.people);
  if (!Number.isInteger(peopleNum) || peopleNum < 1 || peopleNum > 7) {
    return showMessage("Antal personer måste vara mellan 1 och 7.");
  }

  try {
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (!res.ok) return showMessage(result.error);

    showMessage("Bokning genomförd! Bekräftelse skickas via e-post.", "green");
    bookingForm.reset();
    fetchBookings();

  } catch {
    showMessage("Kunde inte spara bokningen!");
  }
});

fetchBookings();

