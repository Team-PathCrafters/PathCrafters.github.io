// --- Helpers ---
function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[s]);
}

// --- Main ---
(function () {
  const input = document.getElementById('careersearch');
  const listbox = document.getElementById('results');
  let suggestions = [];
  let activeIndex = -1;

  function open() {
    listbox.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function close() {
    listbox.hidden = true;
    input.removeAttribute('aria-expanded');
    activeIndex = -1;
    listbox.innerHTML = '';
  }

  function renderSuggestions(items, query) {
    suggestions = items;
    listbox.innerHTML = '';
    activeIndex = -1;
    if (!items.length) { close(); return; }

    const frag = document.createDocumentFragment();
    items.forEach((text, idx) => {
      const div = document.createElement('div');
      div.className = 'item';
      div.id = `option-${idx}`;
      div.setAttribute('role', 'option');
      div.setAttribute('aria-selected', 'false');

      const q = query.trim();
      if (q) {
        const i = text.toLowerCase().indexOf(q.toLowerCase());
        if (i >= 0) {
          const before = escapeHtml(text.slice(0, i));
          const match = escapeHtml(text.slice(i, i + q.length));
          const after = escapeHtml(text.slice(i + q.length));
          div.innerHTML = `${before}<span class="highlight">${match}</span>${after}`;
        } else {
          div.textContent = text;
        }
      } else {
        div.textContent = text;
      }

      div.addEventListener('mousedown', ev => {
        ev.preventDefault();
        choose(idx);
      });

      frag.appendChild(div);
    });
    listbox.appendChild(frag);
    open();
  }

  function choose(index) {
    if (index < 0 || index >= suggestions.length) return;
    input.value = suggestions[index];
    close();
    input.focus();
  }

 async function querySource(q) {
  if (!q) return [];

  try {
    const response = await fetch(`http://localhost:3000/jobs`);
    
    if (!response.ok) {
      console.error("API error:", response.statusText);
      return [];
    }

    const jobs = await response.json(); // expecting an array of job objects from your backend

    // Filter and limit to 10 results
    const lower = q.toLowerCase();
    return jobs
      .filter(job => job.Job_name.toLowerCase().includes(lower))
      .slice(0, 10)
      .map(job => job.Job_name); // return only names
  } catch (err) {
    console.error("Fetch failed:", err);
    return [];
  }
}

  const onInput = debounce(async function (e) {
    const q = e.target.value;
    if (!q.trim()) { close(); return; }
    const results = await querySource(q);
    renderSuggestions(results, q);
  }, 200);

  input.addEventListener('input', onInput);

  input.addEventListener('keydown', (e) => {
    if (listbox.hidden) return;
    const max = suggestions.length - 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(max, activeIndex + 1);
      setActive(activeIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(0, activeIndex - 1);
      setActive(activeIndex);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) choose(activeIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  });

  function setActive(idx) {
    const children = Array.from(listbox.children);
    children.forEach((el, i) => el.setAttribute('aria-selected', String(i === idx)));
    if (idx >= 0) {
      const active = children[idx];
      active.scrollIntoView({ block: 'nearest' });
      input.setAttribute('aria-activedescendant', active.id);
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  document.addEventListener('click', ev => {
    if (!document.getElementById('autocomplete-root').contains(ev.target)) close();
  });


//Career Search Major information

async function populateMajors(jobName) {
    try {
        const response = await fetch(`http://localhost:3000/job/${encodeURIComponent(jobName)}`);
        const job = await response.json();

        if (job.error) {
            document.getElementById("major1").innerHTML = `<p>No job found for "${jobName}"</p>`;
            document.getElementById("major2").innerHTML = "";
            document.getElementById("major3").innerHTML = "";
            return;
        }

        const majors = job.majors;
        const major1 = document.getElementById("major1");
        const major2 = document.getElementById("major2");
        const major3 = document.getElementById("major3");

        // Reset
        [major1, major2, major3].forEach(div => div.innerHTML = "");

        if (majors[0]) {
            major1.innerHTML = `
                <h3>${majors[0].Major_name}</h3>
                <p>Degree: ${job.Final_degree}
                <p>Years of schooling: ${job.years_needed}</p>
                <p>Cost estimate: $${job.avgCost}</p>
                <p>Credit Hours: ${majors[0].CreditHrs}
            `;
        }

        if (majors[1]) {
            major2.innerHTML = `
                <h3>${majors[1].Major_name}</h3>
                <p>Degree: ${job.Final_degree}
                <p>Years of schooling: ${job.years_needed}</p>
                <p>Cost estimate: $${job.avgCost}</p>
                <p>Credit Hours: ${majors[1].CreditHrs}
            `;
        }

        if (majors[2]) {
            major3.innerHTML = `
                <h3>${majors[2].Major_name}</h3>
                <p>Degree: ${job.Final_degree}
                <p>Years of schooling: ${job.years_needed}</p>
                <p>Cost estimate: $${job.avgCost}</p>
                <p>Credit Hours: ${majors[2].CreditHrs}
            `;
        }

    } catch (err) {
        console.error("Failed to fetch job info:", err);
    }
}



document.getElementById("careersearch").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const query = e.target.value.trim();
    if (query) populateMajors(query);
  }
});

document.getElementById("searchButton").addEventListener("click", () => {
	console.log(document.getElementById("careersearch"));
  const input = document.getElementById("careersearch");
  const query = input.value.trim();
  if (query) populateMajors(query);
});


})();
