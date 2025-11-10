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
    document.getElementById('fileInput').addEventListener('change', function(e) {
        handleFiles(e.target.files);
    });

    // Drag and drop functionality
    const uploadSection = document.getElementById('uploadSection');
    uploadSection.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadSection.classList.add('dragover');
    });
    uploadSection.addEventListener('dragleave', function(e) {
        e.preventDefault();
        uploadSection.classList.remove('dragover');
    });
    uploadSection.addEventListener('drop', function(e) {
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
            parseAndDisplayFlashcards(result.flashcards);
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
    
    try {
        const formData = new FormData();
        formData.append('textContent', text.trim());
        
        const response = await fetch('/api/generate-flashcards', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (result.success) {
            parseAndDisplayFlashcards(result.flashcards);
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

function parseAndDisplayFlashcards(aiResponse) {
    try {
        let flashcardsData;
        if (typeof aiResponse === 'string') {
            const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
            flashcardsData = jsonMatch ? JSON.parse(jsonMatch[0]) : createFallbackFlashcards();
        } else if (Array.isArray(aiResponse)) {
            flashcardsData = aiResponse;
        } else {
            flashcardsData = createFallbackFlashcards();
        }
        
        flashcards = flashcardsData.filter(card => card && card.front && card.back);
        if (flashcards.length === 0) flashcards = createFallbackFlashcards();
        
        renderFlashcards();
    } catch (error) {
        flashcards = createFallbackFlashcards();
        renderFlashcards();
    }
}

function createFallbackFlashcards() {
    return [
        { front: "Your content was processed!", back: "The AI successfully received your content." },
        { front: "How can I improve results?", back: "Upload structured content like lecture notes for better results." }
    ];
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