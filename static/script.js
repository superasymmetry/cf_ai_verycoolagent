// Global variables
let currentTab = 'upload';
let flashcards = [];
let activities = [];

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.getElementById(tabName + '-tab').classList.add('active');
    document.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');
    currentTab = tabName;
}

// File upload handling
function initializeApp() {
    document.getElementById('fileInput').addEventListener('change', function (e) {
        handleFiles(e.target.files);
    });

    // Drag and drop functionality
    const uploadSection = document.getElementById('uploadSection');
    uploadSection.addEventListener('dragover', function (e) {
        e.preventDefault();
        uploadSection.classList.add('dragover');
    });
    uploadSection.addEventListener('dragleave', function (e) {
        e.preventDefault();
        uploadSection.classList.remove('dragover');
    });
    uploadSection.addEventListener('drop', function (e) {
        e.preventDefault();
        uploadSection.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    updateProgress();
}

function handleFiles(files) {
    const fileList = document.getElementById('fileList');
    const uploadedFiles = document.getElementById('uploadedFiles');

    fileList.innerHTML = '';
    Array.from(files).forEach(file => {
        const fileItem = document.createElement('div');
        fileItem.style.cssText = 'background: #f8fafc; padding: 10px; margin: 5px 0; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;';
        fileItem.innerHTML = `
            <span><i class="fas fa-file"></i> ${file.name}</span>
            <span style="color: #64748b;">${(file.size / 1024 / 1024).toFixed(2)} MB</span>
        `;
        fileList.appendChild(fileItem);
    });
    uploadedFiles.style.display = 'block';
}

function toggleTextInput() {
    const textInputSection = document.getElementById('textInputSection');
    textInputSection.style.display = textInputSection.style.display === 'none' ? 'block' : 'none';
}

async function extractFileText(file) {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        for (let p = 1; p <= pdf.numPages; p++) {
            const page = await pdf.getPage(p);
            const content = await page.getTextContent();
            text += content.items.map(i => i.str).join(' ') + '\n';
        }
        return text.trim();
    }

    if (file.name.toLowerCase().endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return (result && result.value) ? result.value.trim() : '';
    }

    return await file.text();
}

async function generateFromText() {
    const text = document.getElementById('courseText').value;
    const file = document.getElementById('fileInput').files[0];
    if (!text.trim() && !file) {
        alert('Please enter some course material text or select a file');
        return;
    }

    showLoading();
    const formData = new FormData();

    if (text.trim()){
        formData.append('textContent', text.trim());
    }
    if (file) {
        const fileText = await extractFileText(file);
        formData.append('file', fileText.slice(0, 3000));
    }

    try {
        const response = await fetch('/api/generate-flashcards', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (result.success) {
            if (result.flashcards) {
                let flashcardsArray;
                if (Array.isArray(result.flashcards)) {
                    flashcardsArray = result.flashcards;
                } else if (typeof result.flashcards === 'string') {
                    try {
                        flashcardsArray = JSON.parse(result.flashcards);
                    } catch (parseError) {
                        alert('Error: Received invalid flashcard data');
                        return;
                    }
                } else {
                    alert('Error: Invalid flashcard data format');
                    return;
                }

                flashcards = flashcardsArray.map(card => ({
                    front: card.question || card.front || 'No question',
                    back: card.answer || card.back || 'No answer'
                }));

                renderFlashcards();
                switchTab('flashcards');
            } 
            if (result.activities) {
                activities = result.activities;
                renderActivities();
            }
        } else {
            alert('Error: ' + (result.error || 'No flashcards generated'));
        }
    } catch (error) {
        console.error('Full error:', error);
        alert('Failed to generate flashcards: ' + error.message);
    } finally {
        hideLoading();
    }
}

function showLoading() {
    document.getElementById('flashcardsLoading').style.display = 'block';
    document.getElementById('flashcardsEmpty').style.display = 'none';
}

function hideLoading() {
    document.getElementById('flashcardsLoading').style.display = 'none';
}

function renderFlashcards() {
    const container = document.getElementById('flashcardsContainer');
    container.innerHTML = '';

    if (flashcards.length === 0) {
        document.getElementById('flashcardsEmpty').style.display = 'block';
        return;
    }

    document.getElementById('flashcardsEmpty').style.display = 'none';
    flashcards.forEach((card, index) => {
        const flashcardEl = document.createElement('div');
        flashcardEl.className = 'flashcard';
        flashcardEl.onclick = () => flipCard(flashcardEl);

        flashcardEl.innerHTML = `
            <div class="flashcard-front">
                <div>
                    <p>${card.front}</p>
                </div>
            </div>
            <div class="flashcard-back">
                <div>
                    <p>${card.back}</p>
                </div>
            </div>
        `;

        container.appendChild(flashcardEl);
    });
}

function renderActivities() {
    const container = document.getElementById('activitiesContainer');
    container.innerHTML = '';

    if (!Array.isArray(activities) || activities.length === 0) {
        document.getElementById('activitiesEmpty').style.display = 'block';
        return;
    }
    document.getElementById('activitiesEmpty').style.display = 'none';

    const header = document.createElement('div');
    header.className = 'activity-header';
    header.innerHTML = `<h2>Practice Questions</h2><div class="activity-count">${activities.length} questions</div>`;
    container.appendChild(header);

    activities.forEach((q, qi) => {
        const card = document.createElement('div');
        card.className = 'activity-card';
        const choices = q.choices || q.options || [];

        card.innerHTML = `
            <div class="activity-q">
                <div class="q-number">${qi + 1}</div>
                <div class="q-text">${q.question}</div>
            </div>
            <div class="opts-grid">
                ${choices.map((c, i) => `<button class="opt" data-i="${i}"><span class="opt-letter">${String.fromCharCode(65+i)}</span><span class="opt-text">${c}</span></button>`).join('')}
            </div>
            <div class="act-feedback" style="display:none;"></div>
        `;
        container.appendChild(card);

        const optButtons = card.querySelectorAll('.opt');
        optButtons.forEach(btn => btn.addEventListener('click', () => {
            if (btn.disabled) return;
            const idx = Number(btn.dataset.i);
            optButtons.forEach(b => { b.disabled = true; b.classList.remove('selected'); });
            btn.classList.add('selected');

            const correctIndex = (q.correct_index ?? q.correctIndex ?? q.correct_answer_index ?? (() => {
                // try to find correct_index by matching text (fallback)
                const correctVal = q.correct_answer ?? q.correctAnswer;
                if (typeof correctVal === 'number') return correctVal;
                if (typeof correctVal === 'string') {
                    const ci = choices.indexOf(correctVal);
                    return ci >= 0 ? ci : 0;
                }
                return 0;
            })());

            const isCorrect = idx === correctIndex;
            const fb = card.querySelector('.act-feedback');
            fb.style.display = 'block';
            fb.innerHTML = isCorrect
                ? `<div class="fb correct">Correct${q.explanation ? ': ' + q.explanation : ''}</div>`
                : `<div class="fb incorrect">Incorrect — correct: <strong>${String.fromCharCode(65+correctIndex)}. ${choices[correctIndex] || ''}</strong>${q.explanation ? '<div class="exp">'+q.explanation+'</div>' : ''}</div>`;

            btn.classList.add(isCorrect ? 'opt-correct' : 'opt-incorrect');
            const correctBtn = card.querySelector(`.opt[data-i="${correctIndex}"]`);
            if (correctBtn) correctBtn.classList.add('opt-correct');
        }));
    });
}

function flipCard(cardEl) {
    cardEl.classList.toggle('flipped');
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);