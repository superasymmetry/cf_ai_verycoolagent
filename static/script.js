// Global variables
let currentTab = 'upload';
let flashcards = [];
let activities = [];
let studyProgress = {
    flashcardsStudied: 0,
    quizzesCompleted: 0,
    correctAnswers: 0,
    totalAnswers: 0,
    studyTime: 0
};

// Tab switching
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

    // Simulate study time tracking
    setInterval(() => {
        studyProgress.studyTime += 1;
        if (currentTab === 'progress') {
            updateProgress();
        }
    }, 1000);

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

async function generateFromFiles() {
    const fileInput = document.getElementById('fileInput');
    const files = fileInput.files;

    if (!files || files.length === 0) {
        alert('Please select files to upload');
        return;
    }

    const formData = new FormData();
    formData.append('file', files[0]);

    showLoading();
    try {
        const response = await fetch('/api/generate-flashcards', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (result.success) {
            flashcards = result.flashcards.map(card => ({
                front: card.question || card.front,
                back: card.answer || card.back
            }));
            renderFlashcards();
            switchTab('flashcards');
        } else {
            alert('Error: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        alert('Failed to generate flashcards: ' + error.message);
    } finally {
        hideLoading();
    }
}

async function generateFromText() {
    const text = document.getElementById('courseText').value;

    if (!text.trim()) {
        alert('Please enter some course material text');
        return;
    }

    showLoading();

    const formData = new FormData();
    formData.append('textContent', text.trim());
    try {
        const formData = new FormData();
        formData.append('textContent', text.trim());

        const response = await fetch('/api/generate-flashcards', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (result.success && result.flashcards) {
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
                    <h3>Question ${index + 1}</h3>
                    <p>${card.front}</p>
                </div>
            </div>
            <div class="flashcard-back">
                <div>
                    <h3>Answer</h3>
                    <p>${card.back}</p>
                </div>
            </div>
        `;

        container.appendChild(flashcardEl);
    });
}

function flipCard(cardEl) {
    cardEl.classList.toggle('flipped');
    if (cardEl.classList.contains('flipped')) {
        studyProgress.flashcardsStudied++;
        updateProgress();
    }
}

function updateProgress() {
    document.getElementById('flashcardsStudied').textContent = studyProgress.flashcardsStudied;
    document.getElementById('quizzesCompleted').textContent = studyProgress.quizzesCompleted;

    const accuracy = studyProgress.totalAnswers > 0
        ? Math.round((studyProgress.correctAnswers / studyProgress.totalAnswers) * 100)
        : 0;
    document.getElementById('accuracyRate').textContent = accuracy + '%';
    document.getElementById('studyTime').textContent = Math.floor(studyProgress.studyTime / 60);

    const overallProgress = Math.min(
        ((studyProgress.flashcardsStudied + studyProgress.quizzesCompleted) / 10) * 100,
        100
    );
    document.getElementById('overallProgress').style.width = overallProgress + '%';
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);