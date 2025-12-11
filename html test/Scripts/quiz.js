const API_ROOT = ''; // same origin by default
let quiz = [];
let currentIndex = 0;
const selectedAnswers = {}; // questionIndex -> option index (0..n-1)

const content = document.getElementById('content');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const progressEl = document.getElementById('progress');

async function loadQuiz() {
    showLoading('Loading quiz…');
    try {
        const res = await fetch(`${API_ROOT}/api/quiz`);
        if (res.ok) {
            const data = await res.json();
            // Normalize to { q, options: [{ text, id?, linkedJobs? }] }
            quiz = data.map(item => ({
                q: item.QuestionText,
                options: item.answers.map(a => ({ text: a.answerText, id: a.AnswerID, linkedJobs: a.linkedJobs || [] }))
            }));
        } else throw new Error('API not available');
    } catch (err) {
        // fallback to embedded questions (25)
        quiz = getEmbeddedQuiz();
    }

    if (!quiz.length) {
        content.innerHTML = '<div class="loading">No quiz questions found.</div>';
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

function showLoading(msg = 'Loading…') {
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
        bubble.textContent = String.fromCharCode(65 + idx); // A B C D
        aEl.appendChild(bubble);

        const text = document.createElement('div');
        text.className = 'text';
        text.textContent = opt.text;
        aEl.appendChild(text);

        // apply selected state if chosen
        if (selectedAnswers[currentIndex] === idx) {
            aEl.classList.add('selected');
            aEl.setAttribute('aria-selected', 'true');
        } else {
            aEl.setAttribute('aria-selected', 'false');
        }

        // click + keyboard support
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
    // store selection
    selectedAnswers[currentIndex] = idx;
    // update visuals: remove selected from siblings
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
    // ensure selection
    if (selectedAnswers[currentIndex] === undefined) {
        alert('Please select an answer to continue.');
        return;
    }

    if (currentIndex < quiz.length - 1) {
        currentIndex++;
        renderCurrent();
        return;
    }

    // final submit: if server scoring available and we have option ids, attempt server scoring
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
        showLoading('Calculating recommendations…');
        prevBtn.disabled = true;
        nextBtn.disabled = true;

        // map selected option indexes to answer IDs
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
            showServerResults(data.topJobs);
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

function showServerResults(jobs) {
    content.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'question';
    header.textContent = 'Top job matches';
    content.appendChild(header);

    const results = document.createElement('div');
    results.className = 'results';
    jobs.forEach((j, i) => {
        const card = document.createElement('div');
        card.className = 'job-card';
        const info = document.createElement('div');
        info.className = 'job-info';
        const title = document.createElement('div');
        title.className = 'title';
        title.textContent = `${i + 1}. ${j.Job_name || j.job || 'Job'}`;
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = `${j.Final_degree || ''} • ${j.years_needed || ''} years • Salary: $${j.Salary || 'N/A'}`;
        info.appendChild(title);
        info.appendChild(meta);
        card.appendChild(info);

        const badge = document.createElement('div');
        badge.className = 'bubble';
        badge.style.width = '64px';
        badge.style.height = '40px';
        badge.style.borderRadius = '12px';
        badge.textContent = j.score ? `x${j.score}` : '';
        badge.style.fontWeight = '800';
        badge.style.background = `linear-gradient(90deg, var(--gold-100), var(--gold-75))`;
        badge.style.color = '#000';
        badge.style.border = 'none';
        card.appendChild(badge);

        results.appendChild(card);
    });

    content.appendChild(results);
    renderRetake();
}

function computeLocalScore() {
    // simple A/B/C/D mapping based on selected bubble letter (A=0 B=1 C=2 D=3)
    // Tally categories: A->category A, B->B, etc.
    const tally = [0, 0, 0, 0];
    for (let i = 0; i < quiz.length; i++) {
        const idx = selectedAnswers[i];
        if (idx !== undefined && idx >= 0 && idx <= 3) tally[idx]++;
    }

    // find top index
    let topIdx = 0;
    for (let i = 1; i < 4; i++) {
        if (tally[i] > tally[topIdx]) topIdx = i;
    }

    const mapping = [
        {
            title: 'Patient Care & Clinical Professions',
            desc: 'You want to work directly with people and make an immediate impact.',
            majors: ['Nursing', 'Exercise Science', 'Radiologic Technology', 'Paramedicine', 'Pre-Medicine']
        },
        {
            title: 'Laboratory & Research Sciences',
            desc: 'You enjoy science, analysis, and structured lab or research work.',
            majors: ['Biochemistry', 'Chemistry', 'Biological Sciences', 'Cellular & Molecular Biology', 'Medical Laboratory Sciences']
        },
        {
            title: 'Community Health & Education',
            desc: 'You like promoting wellness for groups and sharing knowledge.',
            majors: ['Public Health', 'Psychology', 'Environmental Science', 'Secondary Education Prep']
        },
        {
            title: 'Technology & Applied Sciences',
            desc: 'You are drawn to tools, machines, and problem solving with technology.',
            majors: ['Radiologic Technology', 'Medical Laboratory Sciences', 'Applied Science', 'Pre-Engineering']
        }
    ];

    const result = mapping[topIdx];

    // render
    content.innerHTML = '';
    const header = document.createElement('div');
    header.className = 'question';
    header.textContent = `Result: ${result.title}`;
    content.appendChild(header);

    const desc = document.createElement('div');
    desc.className = 'meta';
    desc.style.marginTop = '8px';
    desc.textContent = result.desc;
    content.appendChild(desc);

    const results = document.createElement('div');
    results.className = 'results';
    result.majors.slice(0, 3).forEach((m, i) => {
        const jc = document.createElement('div');
        jc.className = 'job-card';
        const info = document.createElement('div');
        info.className = 'job-info';
        const title = document.createElement('div');
        title.className = 'title';
        title.textContent = `${i + 1}. ${m}`;
        const meta = document.createElement('div');
        meta.className = 'meta';
        meta.textContent = 'Suggested Careers';
        info.appendChild(title);
        info.appendChild(meta);
        jc.appendChild(info);

        const perc = Math.round((tally[topIdx] / quiz.length) * 100);
        const badge = document.createElement('div');
        badge.className = 'bubble';
        badge.style.width = '64px';
        badge.style.height = '40px';
        badge.style.borderRadius = '12px';
        badge.style.fontWeight = '800';
        badge.style.background = `linear-gradient(90deg, var(--gold-100), var(--gold-75))`;
        badge.style.color = '#000';
        badge.style.border = 'none';
        badge.textContent = `${perc}%`;
        jc.appendChild(badge);

        results.appendChild(jc);
    });

    content.appendChild(results);
    renderRetake();
}

function renderRetake() {
    const retake = document.createElement('div');
    retake.style.marginTop = '12px';
    const btn = document.createElement('button');
    btn.className = 'btn secondary';
    btn.textContent = 'Retake Quiz';
    btn.addEventListener('click', () => {
        for (const k in selectedAnswers) delete selectedAnswers[k];
        currentIndex = 0;
        renderCurrent();
        prevBtn.disabled = true;
        nextBtn.disabled = false;
    });
    retake.appendChild(btn);
    content.appendChild(retake);
    prevBtn.disabled = true;
    nextBtn.disabled = true;
}


// Embedded fallback quiz using your 25 questions (A..D)
function getEmbeddedQuiz() {
    const qList = [
    /* 1 */ {
            q: 'What excites you most about working in healthcare?', options: [
                'Helping people directly and making a difference in their lives ',
                'Investigating and analyzing lab results to solve medical mysteries',
                'Understanding how the body works at the smallest level ',
                'Responding to emergencies and saving lives under pressure ']
        },
    /* 2 */ {
            q: 'How do you prefer to work?', options: [
                'Hands on with patients ',
                'In a lab running experiments ',
                'Studying nature, health trends, or populations ',
                'Teaching and mentoring the next generation ']
        },
    /* 3 */ {
            q: 'What subject do you enjoy most?', options: [
                'Biology & anatomy',
                'Chemistry ',
                'Psychology & understanding the mind ']
        },
    /* 4 */ {
            q: 'How comfortable are you with stressful, fast paced situations?', options: [
                'Very comfortable, I thrive in high-pressure environments',
                'Somewhat comfortable, I prefer structured, controlled environments',
                'I would rather work behind the scenes and focus on research ',
                'I enjoy teamwork but prefer steady and predictable work']
        },
    /* 5 */ {
            q: 'Which of these appeals most to you?', options: [
                'Becoming a doctor, dentist, or other healthcare provider ',
                'Conducting research that leads to medical breakthroughs ',
                'Promoting healthier communities through outreach ',
                'Using technology to diagnose and treat patients ']
        },
    /* 6 */ {
            q: 'What is your ideal career environment?', options: [
                'Hospital or clinic with direct patient care ',
                'Emergency response team ',
                'Research lab or academic setting ',
                'Community, school, or government setting ']
        },
    /* 7 */ {
            q: 'How do you like solving problems?', options: [
                'By physically treating the issue ',
                'By researching and finding scientific explanations ',
                'By educating others and spreading awareness ',
                'By using technology and data ']
        },
    /* 8 */ {
            q: 'What motivates you most in a career?', options: [
                'Caring for individuals and saving lives ',
                'Discovering new knowledge ',
                'Helping entire communities live healthier lives ',
                'Applying science and technology to solve problems ']
        },
    /* 9 */ {
            q: 'What type of patients or issues would you most want to work with?', options: [
                'Human patients in hospitals or clinics ',
                'Animals and veterinary health ',
                'Populations facing public health challenges ',
                'Forensic or criminal cases ']
        },
    /*10 */ {
            q: 'How would you describe your personality at work?', options: [
                'Compassionate and empathetic ',
                'Analytical and detail-oriented ',
                'Curious and investigative ',
                'Outgoing and communicative ']
        },
    /*11 */ {
            q: 'Which skill do you want to develop most?', options: [
                'Patient care and bedside manner ',
                'Laboratory testing and analysis ',
                'Research and experimentation ',
                'Leadership and teaching ']
        },
    /*12 */ {
            q: 'Do you prefer short term or long term impact?', options: [
                'Immediate results, I want to see patients improve quickly ',
                'Long, term results through years of research ',
                'Long, term results through education and prevention ',
                'Both, I like a balance of quick fixes and ongoing progress ']
        },
    /*13 */ {
            q: 'How do you feel about working with technology and machines?', options: [
                'Love it, using machines to diagnose or treat patients sounds great ',
                'I am okay with it, but prefer working directly with people ',
                'I would rather focus on natural sciences and living systems ',
                'I would enjoy both, technology and human health ']
        },
    /*14 */ {
            q: 'Which career reward matters most to you?', options: [
                'Personal fulfillment by helping others',
                'Intellectual challenge ',
                'Discovering something new that benefits science and medicine ',
                'Job stability and strong career opportunities ']
        },
    /*15 */ {
            q: 'Which of these roles sounds most like you?', options: [
                'The caregiver, someone people turn to in times of need ',
                'The investigator, solving mysteries through science ',
                'The educator, helping others learn and grow ',
                'The innovator, using tools and science to create solutions ']
        },
    /*16 */ {
            q: 'How do you feel about blood and medical procedures?', options: [
                'Comfortable, I want hands on medical work',
                'Comfortable in controlled lab settings ',
                'Prefer not to deal with it directly ',
                'Interested but only through diagnostic technology ']
        },
    /*17 */ {
            q: 'Do you enjoy teamwork or working independently?', options: [
                'Teamwork in patient centered environments ',
                'Independent lab research ',
                'Collaborative outreach and education ',
                'A balance of both ']
        },
    /*18 */ {
            q: 'What pace of work do you prefer?', options: [
                'Fast and urgent ',
                'Steady and structured ',
                'Slow and investigative ',
                'Flexible and adaptable ']
        },
    /*19 */ {
            q: 'How important is physical activity in your career?', options: [
                'Very important, I want an active, physical job ',
                'Somewhat important, I like being on my feet but not constantly ',
                'Not very important, I would rather focus on research and thinking ',
                'Important in a teaching or coaching way ']
        },
    /*20 */ {
            q: 'What kind of problems do you want to solve?', options: [
                'Diagnosing and treating illnesses ',
                'Discovering cures and new treatments ',
                'Improving community health outcomes',
                'Using tools and data to improve accuracy ']
        },
    /*21 */ {
            q: 'How much schooling are you willing to pursue?', options: [
                'Many years, I am aiming for medical/dental/optometry school ',
                'Moderate, I want a bachelors degree with strong career outcomes ',
                'Bachelors plus possible graduate school in research ',
                'Bachelors with potential for public or educational roles ']
        },
    /*22 */ {
            q: 'Which phrase fits you best?', options: [
                'I want to care for people ',
                'I want to discover and analyze. ',
                'I want to protect communities. ',
                'I want to innovate with science and technology. ']
        },
    /*23 */ {
            q: 'How do you handle pressure?', options: [
                'I stay calm and focused during emergencies ',
                'I prefer planned and organized tasks ',
                'I focus on deep research without pressure',
                'I adapt by teaching, guiding, or communicating ']
        },
    /*24 */ {
            q: 'What is most important to you in a career?', options: [
                'Helping people one on one ',
                'Contributing to scientific discoveries ',
                'Making a difference for whole populations ',
                'Using advanced technology to aid medicine ']
        },
    /*25 */ {
            q: 'If you were not in healthcare, what field would attract you most?', options: [
                'Social work or community service ',
                'Pure science research ',
                'Education or outreach ',
                'Engineering or technology ']
        }
    ];

    return qList.map(item => ({
        q: item.q,
        options: item.options.map((t) => ({ text: t }))
    }));
}

// Start
loadQuiz();