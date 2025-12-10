
let quiz = [];
let currentIndex = 0;
const selectedAnswers = {};

const content = document.getElementById('content');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const progressEl = document.getElementById('progress');

// Priority careers that should appear first in results
const PRIORITY_CAREERS = [
    'Nursing',
    'Physician',
    'Medical Doctor',
    'Dentist',
    'Pharmacist',
    'Physical Therapist',
    'Occupational Therapist',
    'Radiologic Technologist',
    'Medical Laboratory Scientist',
    'Physician Assistant',
    'Nurse Practitioner',
    'Paramedic',
    'Respiratory Therapist',
    'Public Health Specialist',
    'Health Educator',
    'Biomedical Scientist',
    'Clinical Research Coordinator',
    'Medical Sonographer',
    'Surgical Technologist',
    'Athletic Trainer'
];

async function loadQuiz() {
    showLoading('Loading quiz...');

   
    quiz = getEmbeddedQuiz();
    if (!quiz || quiz.length === 0) {
        content.innerHTML = '<div class="loading">No quiz questions found. Please refresh the page.</div>';
        nextBtn.disabled = true;
        prevBtn.disabled = true;
        return;
    }

    currentIndex = 0;
    renderCurrent();
    updateProgress();
    prevBtn.disabled = true;
    nextBtn.disabled = false;
}

function showLoading(msg = 'Loading...') {
    content.innerHTML = `<div class="loading">${msg}</div>`;
}

function renderCurrent() {
    const q = quiz[currentIndex];
    if (!q) return;
    content.innerHTML = '';

    const questionEl = document.createElement('div');
    questionEl.className = 'question';
    questionEl.textContent = `${currentIndex + 1}. ${q.q}`;
    content.appendChild(questionEl);

    const answersEl = document.createElement('div');
    answersEl.className = 'answers';
    answersEl.setAttribute('role', 'list');

    q.options.forEach((opt, idx) => {
        const aEl = document.createElement('div');
        aEl.className = 'answer';
        aEl.setAttribute('role', 'listitem');
        aEl.setAttribute('tabindex', 0);
        aEl.dataset.index = idx;

        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        bubble.textContent = String.fromCharCode(65 + idx);
        aEl.appendChild(bubble);

        const text = document.createElement('div');
        text.className = 'text';
        text.textContent = opt.text;
        aEl.appendChild(text);

        if (selectedAnswers[currentIndex] === idx) {
            aEl.classList.add('selected');
            aEl.setAttribute('aria-selected', 'true');
        } else {
            aEl.setAttribute('aria-selected', 'false');
        }

        aEl.addEventListener('click', () => selectOption(idx, aEl));
        aEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectOption(idx, aEl);
            }
        });

        answersEl.appendChild(aEl);
    });

    content.appendChild(answersEl);
    updateProgress();
    prevBtn.disabled = currentIndex === 0;
    nextBtn.textContent = currentIndex === quiz.length - 1 ? 'Submit' : 'Next';
}

function selectOption(idx, el) {
    selectedAnswers[currentIndex] = idx;
    const answersEl = el.parentNode;
    answersEl.querySelectorAll('.answer').forEach(n => {
        n.classList.remove('selected');
        n.setAttribute('aria-selected', 'false');
    });
    el.classList.add('selected');
    el.setAttribute('aria-selected', 'true');
}

prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) {
        currentIndex--;
        renderCurrent();
    }
});

nextBtn.addEventListener('click', async () => {
    if (selectedAnswers[currentIndex] === undefined) {
        alert('Please select an answer to continue.');
        return;
    }

    if (currentIndex < quiz.length - 1) {
        currentIndex++;
        renderCurrent();
        return;
    }

    // Check if we have answer IDs (from API)
    const canUseServer = quiz.every(q => q.options.every(o => o.id !== undefined));
    if (canUseServer) {
        await submitToServer();
    } else {
        computeLocalScore();
    }
});

function updateProgress() {
    progressEl.textContent = `${currentIndex + 1} / ${quiz.length}`;
}

async function submitToServer() {
    try {
        showLoading('Calculating your top career matches...');
        prevBtn.disabled = true;
        nextBtn.disabled = true;

        const selectedIDs = quiz.map((q, qi) => {
            const idx = selectedAnswers[qi];
            return (idx !== undefined && q.options[idx] && q.options[idx].id) ? q.options[idx].id : null;
        }).filter(Boolean);

        const res = await fetch(`${API_ROOT}/api/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ selectedAnswers: selectedIDs })
        });

        if (!res.ok) throw new Error('Server scoring failed');

        const data = await res.json();
        if (data.topJobs && data.topJobs.length) {
            const sortedJobs = prioritizeCareers(data.topJobs);
            showServerResults(sortedJobs);
        } else {
            computeLocalScore();
        }
    } catch (err) {
        console.warn('Server scoring failed, falling back to local scoring', err);
        computeLocalScore();
    } finally {
        prevBtn.disabled = false;
        nextBtn.disabled = false;
    }
}

function prioritizeCareers(jobs) {
    return jobs.sort((a, b) => {
        const jobNameA = a.Job_name || a.job || '';
        const jobNameB = b.Job_name || b.job || '';

        const isPriorityA = PRIORITY_CAREERS.some(pc =>
            jobNameA.toLowerCase().includes(pc.toLowerCase())
        );
        const isPriorityB = PRIORITY_CAREERS.some(pc =>
            jobNameB.toLowerCase().includes(pc.toLowerCase())
        );

        if (isPriorityA && !isPriorityB) return -1;
        if (!isPriorityA && isPriorityB) return 1;

        return (b.score || 0) - (a.score || 0);
    });
}

function showServerResults(jobs) {
    content.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'question';
    header.textContent = 'Your Top Career Matches';
    content.appendChild(header);

    const results = document.createElement('div');
    results.className = 'results';

    jobs.slice(0, 5).forEach((j, i) => {
        const card = document.createElement('div');
        card.className = 'job-card';

        const info = document.createElement('div');
        info.className = 'job-info';

        const title = document.createElement('div');
        title.className = 'title';
        title.textContent = `${i + 1}. ${j.Job_name || j.job || 'Career'}`;

        const meta = document.createElement('div');
        meta.className = 'meta';
        const degree = j.Final_degree || 'Degree info not available';
        const years = j.years_needed || 'N/A';
        const salary = j.Salary ? `$${j.Salary.toLocaleString()}` : 'N/A';
        meta.textContent = `${degree} • ${years} years • Salary: ${salary}`;

        info.appendChild(title);
        info.appendChild(meta);
        card.appendChild(info);

        const badge = document.createElement('div');
        badge.className = 'bubble';
        badge.style.width = '64px';
        badge.style.height = '40px';
        badge.style.borderRadius = '12px';
        badge.textContent = j.score ? `${j.score}` : '✓';
        badge.style.fontWeight = '700';
        badge.style.backgroundColor = '#333';
        badge.style.color = 'white';
        badge.style.border = 'none';
        card.appendChild(badge);

        results.appendChild(card);
    });

    content.appendChild(results);
    renderResultActions();
}

function computeLocalScore() {
    const tally = [0, 0, 0, 0];
    for (let i = 0; i < quiz.length; i++) {
        const idx = selectedAnswers[i];
        if (idx !== undefined && idx >= 0 && idx <= 3) tally[idx]++;
    }

    let topIdx = 0;
    for (let i = 1; i < 4; i++) {
        if (tally[i] > tally[topIdx]) topIdx = i;
    }

    const mapping = [
        {
            title: 'Patient Care & Clinical Practice',
            desc: 'You thrive in direct patient care and want to make an immediate impact on individual lives through hands-on clinical work.',
            careers: [
                { name: 'Registered Nurse', info: 'BSN • 4 years' },
                { name: 'Physician Assistant', info: 'Masters • 6-7 years' },
                { name: 'Physical Therapist', info: 'DPT • 7 years' },
                { name: 'Paramedic', info: "Bachelor's • 2 years" },
                { name: 'Occupational Therapist', info: 'Masters • 6 years' }
            ]
        },
        {
            title: 'Laboratory & Research Sciences',
            desc: 'You excel in analytical thinking and structured research, preferring to contribute to healthcare through scientific discovery and laboratory work.',
            careers: [
                { name: 'Medical Laboratory Scientist', info: 'Bachelors • 4 years' },
                { name: 'Biomedical Scientist', info: 'Bachelors • 4 years' },
                { name: 'Clinical Research Coordinator', info: "Bachelor's • 4 years" },
                { name: 'Biochemist', info: 'Bachelor/Masters • 4-6 years+' },
                { name: 'Microbiologist', info: "Bachelor's • 4 years" }
            ]
        },
        {
            title: 'Community Health & Education',
            desc: 'You are passionate about promoting wellness for entire communities and educating others to create lasting health improvements.',
            careers: [
                { name: 'Public Health Specialist', info: "Master's • 6 years" },
                { name: 'Health Educator', info: "Bachelor's • 4 years" },
                { name: 'Community Health Worker', info: "Bachelor's • 4 years" },
                { name: 'Epidemiologist', info: "Master's • 6 years" },
                { name: 'Health Services Manager', info: "Bachelor's/Master's • 4-6 years" }
            ]
        },
        {
            title: 'Medical Technology & Diagnostics',
            desc: 'You are drawn to the intersection of healthcare and technology, using advanced equipment and innovation to diagnose and treat patients.',
            careers: [
                { name: 'Radiologic Technologist', info: "Bachelor's • 4 years" },
                { name: 'Medical Sonographer', info: "Bachelor's • 4 years" },
                { name: 'Surgical Technologist', info: "Bachelor's • 4 years" },
                { name: 'Biomedical Engineer', info: "Bachelor's • 4 years" },
                { name: 'Clinical Laboratory Technician', info: "Bachelor's • 4 years" }
            ]
        }
    ];

    const result = mapping[topIdx];

    content.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'question';
    header.textContent = result.title;
    content.appendChild(header);

    const desc = document.createElement('div');
    desc.className = 'meta';
    desc.style.marginTop = '8px';
    desc.style.marginBottom = '20px';
    desc.style.fontSize = '1.1em';
    desc.textContent = result.desc;
    content.appendChild(desc);

    const results = document.createElement('div');
    results.className = 'results';

    result.careers.slice(0, 5).forEach((career, i) => {
        const jc = document.createElement('div');
        jc.className = 'job-card';

        const info = document.createElement('div');
        info.className = 'job-info';

        const title = document.createElement('div');
        title.className = 'title';
        title.textContent = `${i + 1}. ${career.name}`;

        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = career.info;

        info.appendChild(title);
        info.appendChild(meta);
        jc.appendChild(info);

        const perc = Math.round((tally[topIdx] / quiz.length) * 100);
        const badge = document.createElement('div');
        badge.className = 'bubble';
        badge.style.width = '64px';
        badge.style.height = '40px';
        badge.style.borderRadius = '12px';
        badge.style.fontWeight = '700';
        badge.style.backgroundColor = '#333';
        badge.style.color = 'white';
        badge.style.border = 'none';
        badge.textContent = `${perc}%`;
        jc.appendChild(badge);

        results.appendChild(jc);
    });

    content.appendChild(results);
    renderResultActions();
}

function renderResultActions() {
    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '12px';
    actions.style.marginTop = '20px';
    actions.style.justifyContent = 'center';
    actions.style.flexWrap = 'wrap';

    const retakeBtn = document.createElement('button');
    retakeBtn.className = 'btn secondary';
    retakeBtn.textContent = 'Retake Quiz';
    retakeBtn.addEventListener('click', () => {
        for (const k in selectedAnswers) delete selectedAnswers[k];
        currentIndex = 0;
        renderCurrent();
        prevBtn.disabled = true;
        nextBtn.disabled = false;
    });

    const searchBtn = document.createElement('button');
    searchBtn.className = 'btn primary';
    searchBtn.textContent = 'Search Careers';
    searchBtn.addEventListener('click', () => {
        window.location.href = 'CareerSearch.html';
    });

    const homeBtn = document.createElement('button');
    homeBtn.className = 'btn primary';
    homeBtn.textContent = 'Back to Home';
    homeBtn.addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    actions.appendChild(retakeBtn);
    actions.appendChild(searchBtn);
    actions.appendChild(homeBtn);

    content.appendChild(actions);
    prevBtn.disabled = true;
    nextBtn.disabled = true;
}

function getEmbeddedQuiz() {
    const qList = [
        {
            q: 'What excites you most about working in healthcare?',
            options: [
                'Helping people directly and making a difference in their lives',
                'Investigating and analyzing lab results to solve medical mysteries',
                'Understanding how the body works at the smallest level',
                'Responding to emergencies and saving lives under pressure'
            ]
        },
        {
            q: 'How do you prefer to work?',
            options: [
                'Hands-on with patients',
                'In a lab running experiments',
                'Studying nature, health trends, or populations',
                'Teaching and mentoring the next generation'
            ]
        },
        {
            q: 'What subject do you enjoy most?',
            options: [
                'Biology & anatomy',
                'Chemistry',
                'Psychology & understanding the mind',
                'Physics & technology'
            ]
        },
        {
            q: 'How comfortable are you with stressful, fast-paced situations?',
            options: [
                'Very comfortable, I thrive in high-pressure environments',
                'Somewhat comfortable, I prefer structured, controlled environments',
                'I would rather work behind the scenes and focus on research',
                'I enjoy teamwork but prefer steady and predictable work'
            ]
        },
        {
            q: 'Which of these appeals most to you?',
            options: [
                'Becoming a doctor, dentist, or other healthcare provider',
                'Conducting research that leads to medical breakthroughs',
                'Promoting healthier communities through outreach',
                'Using technology to diagnose and treat patients'
            ]
        },
        {
            q: 'What is your ideal career environment?',
            options: [
                'Hospital or clinic with direct patient care',
                'Emergency response team',
                'Research lab or academic setting',
                'Community, school, or government setting'
            ]
        },
        {
            q: 'How do you like solving problems?',
            options: [
                'By physically treating the issue',
                'By researching and finding scientific explanations',
                'By educating others and spreading awareness',
                'By using technology and data'
            ]
        },
        {
            q: 'What motivates you most in a career?',
            options: [
                'Caring for individuals and saving lives',
                'Discovering new knowledge',
                'Helping entire communities live healthier lives',
                'Applying science and technology to solve problems'
            ]
        },
        {
            q: 'What type of patients or issues would you most want to work with?',
            options: [
                'Human patients in hospitals or clinics',
                'Animals and veterinary health',
                'Populations facing public health challenges',
                'Forensic or criminal cases'
            ]
        },
        {
            q: 'How would you describe your personality at work?',
            options: [
                'Compassionate and empathetic',
                'Analytical and detail-oriented',
                'Curious and investigative',
                'Outgoing and communicative'
            ]
        },
        {
            q: 'Which skill do you want to develop most?',
            options: [
                'Patient care and bedside manner',
                'Laboratory testing and analysis',
                'Research and experimentation',
                'Leadership and teaching'
            ]
        },
        {
            q: 'Do you prefer short-term or long-term impact?',
            options: [
                'Immediate results, I want to see patients improve quickly',
                'Long-term results through years of research',
                'Long-term results through education and prevention',
                'Both, I like a balance of quick fixes and ongoing progress'
            ]
        },
        {
            q: 'How do you feel about working with technology and machines?',
            options: [
                'Love it, using machines to diagnose or treat patients sounds great',
                'I am okay with it, but prefer working directly with people',
                'I would rather focus on natural sciences and living systems',
                'I would enjoy both technology and human health'
            ]
        },
        {
            q: 'Which career reward matters most to you?',
            options: [
                'Personal fulfillment by helping others',
                'Intellectual challenge',
                'Discovering something new that benefits science and medicine',
                'Job stability and strong career opportunities'
            ]
        },
        {
            q: 'Which of these roles sounds most like you?',
            options: [
                'The caregiver, someone people turn to in times of need',
                'The investigator, solving mysteries through science',
                'The educator, helping others learn and grow',
                'The innovator, using tools and science to create solutions'
            ]
        },
        {
            q: 'How do you feel about blood and medical procedures?',
            options: [
                'Comfortable, I want hands-on medical work',
                'Comfortable in controlled lab settings',
                'Prefer not to deal with it directly',
                'Interested but only through diagnostic technology'
            ]
        },
        {
            q: 'Do you enjoy teamwork or working independently?',
            options: [
                'Teamwork in patient-centered environments',
                'Independent lab research',
                'Collaborative outreach and education',
                'A balance of both'
            ]
        },
        {
            q: 'What pace of work do you prefer?',
            options: [
                'Fast and urgent',
                'Steady and structured',
                'Slow and investigative',
                'Flexible and adaptable'
            ]
        },
        {
            q: 'How important is physical activity in your career?',
            options: [
                'Very important, I want an active, physical job',
                'Somewhat important, I like being on my feet but not constantly',
                'Not very important, I would rather focus on research and thinking',
                'Important in a teaching or coaching way'
            ]
        },
        {
            q: 'What kind of problems do you want to solve?',
            options: [
                'Diagnosing and treating illnesses',
                'Discovering cures and new treatments',
                'Improving community health outcomes',
                'Using tools and data to improve accuracy'
            ]
        },
        {
            q: 'How much schooling are you willing to pursue?',
            options: [
                'Many years, I am aiming for medical/dental/optometry school',
                'Moderate, I want a bachelor\'s degree with strong career outcomes',
                'Bachelor\'s plus possible graduate school in research',
                'Bachelor\'s with potential for public or educational roles'
            ]
        },
        {
            q: 'Which phrase fits you best?',
            options: [
                'I want to care for people',
                'I want to discover and analyze',
                'I want to protect communities',
                'I want to innovate with science and technology'
            ]
        },
        {
            q: 'How do you handle pressure?',
            options: [
                'I stay calm and focused during emergencies',
                'I prefer planned and organized tasks',
                'I focus on deep research without pressure',
                'I adapt by teaching, guiding, or communicating'
            ]
        },
        {
            q: 'What is most important to you in a career?',
            options: [
                'Helping people one-on-one',
                'Contributing to scientific discoveries',
                'Making a difference for whole populations',
                'Using advanced technology to aid medicine'
            ]
        },
        {
            q: 'If you were not in healthcare, what field would attract you most?',
            options: [
                'Social work or community service',
                'Pure science research',
                'Education or outreach',
                'Engineering or technology'
            ]
        }
    ];

    return qList.map(item => ({
        q: item.q,
        options: item.options.map((t) => ({ text: t }))
    }));
}

// Initialize quiz when page loads
loadQuiz();