/**
 * dashboard.js — Logic for uploading PDFs, managing projects, and dashboard UI.
 */
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const uploadArea = document.getElementById('uploadArea');
    const uploadContent = document.getElementById('uploadContent');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const fileSelected = document.getElementById('fileSelected');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const removeFile = document.getElementById('removeFile');
    const projectTitle = document.getElementById('projectTitle');
    const generateBtn = document.getElementById('generateBtn');
    const generateText = document.getElementById('generateText');
    const generateSpinner = document.getElementById('generateSpinner');
    const statusArea = document.getElementById('statusArea');
    const refreshBtn = document.getElementById('refreshBtn');
    const projectsLoading = document.getElementById('projectsLoading');
    const projectsEmpty = document.getElementById('projectsEmpty');
    const projectsGrid = document.getElementById('projectsGrid');

    let currentFile = null;

    // ── Drag & Drop Events ─────────────────────────────────────
    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.add('drag-over');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('drag-over');
        });
    });

    uploadArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt.files && dt.files.length > 0) {
            handleFileSelect(dt.files[0]);
        }
    });

    uploadArea.addEventListener('click', (e) => {
        // Only trigger input if not clicking remove button
        if (e.target !== removeFile && !removeFile.contains(e.target)) {
            fileInput.click();
        }
    });

    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelect(e.target.files[0]);
        }
    });

    removeFile.addEventListener('click', (e) => {
        e.stopPropagation();
        resetFileInput();
    });

    function formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function handleFileSelect(file) {
        clearStatus();
        if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
            showStatus('Please select a valid PDF file.', 'danger');
            resetFileInput();
            return;
        }

        const maxBytes = 20 * 1024 * 1024; // 20 MB limit
        if (file.size > maxBytes) {
            showStatus('File exceeds the 20 MB limit.', 'danger');
            resetFileInput();
            return;
        }

        currentFile = file;
        fileName.textContent = file.name;
        fileSize.textContent = formatBytes(file.size);

        uploadContent.classList.add('d-none');
        fileSelected.classList.remove('d-none');
        generateBtn.disabled = false;

        // Auto-fill project title if empty
        if (!projectTitle.value.trim()) {
            projectTitle.value = file.name.replace(/\.pdf$/i, '');
        }
    }

    function resetFileInput() {
        currentFile = null;
        fileInput.value = '';
        uploadContent.classList.remove('d-none');
        fileSelected.classList.add('d-none');
        generateBtn.disabled = true;
    }

    // ── Generate Mind Map ──────────────────────────────────────
    generateBtn.addEventListener('click', async () => {
        if (!currentFile) return;

        generateBtn.disabled = true;
        generateSpinner.classList.remove('d-none');
        generateText.textContent = 'Analyzing PDF with AI…';
        showStatus('Uploading document and generating mind map with Groq AI. This typically takes 5–15 seconds…', 'info');

        try {
            const title = projectTitle.value.trim() || currentFile.name.replace(/\.pdf$/i, '');
            const result = await API.generateMindMap(currentFile, title);

            showStatus('Mind map generated successfully! Opening workspace…', 'success');
            setTimeout(() => {
                window.location.href = `workspace.html?id=${result.projectId}`;
            }, 600);
        } catch (error) {
            console.error('Generation error:', error);
            showStatus(`Error generating mind map: ${error.message}`, 'danger');
            generateBtn.disabled = false;
            generateSpinner.classList.add('d-none');
            generateText.textContent = 'Create Mind Map';
        }
    });

    function showStatus(message, type = 'info') {
        statusArea.innerHTML = `
            <div class="alert alert-${type} alert-dismissible fade show d-inline-block text-start py-2 px-3 small" role="alert">
                ${message}
                <button type="button" class="btn-close py-2" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
    }

    function clearStatus() {
        statusArea.innerHTML = '';
    }

    // ── Load Recent Projects ───────────────────────────────────
    async function loadProjects() {
        projectsLoading.classList.remove('d-none');
        projectsEmpty.classList.add('d-none');
        projectsGrid.classList.add('d-none');
        projectsGrid.innerHTML = '';

        try {
            const projects = await API.getProjects();
            projectsLoading.classList.add('d-none');

            if (!projects || projects.length === 0) {
                projectsEmpty.classList.remove('d-none');
                return;
            }

            projectsGrid.classList.remove('d-none');
            projects.forEach(project => {
                const cardCol = document.createElement('div');
                cardCol.className = 'col-md-6 col-lg-4';

                const updatedDate = project.updatedAt ? new Date(project.updatedAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                }) : 'Recently';

                cardCol.innerHTML = `
                    <div class="card h-100 project-card border">
                        <div class="card-body d-flex flex-column">
                            <div class="d-flex justify-content-between align-items-start mb-2">
                                <h3 class="h6 fw-600 mb-0 text-truncate me-2" title="${escapeHtml(project.title)}">
                                    ${escapeHtml(project.title)}
                                </h3>
                                <button class="btn btn-sm btn-link text-danger p-0 delete-project-btn" data-id="${project.id}" title="Delete project">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                                    </svg>
                                </button>
                            </div>
                            <p class="text-secondary small mb-3 flex-grow-1 text-truncate">
                                ${project.documentName ? escapeHtml(project.documentName) : 'Document'} 
                                ${project.pageCount ? `· ${project.pageCount} ${project.pageCount === 1 ? 'page' : 'pages'}` : ''}
                            </p>
                            <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                                <span class="text-secondary small">${updatedDate}</span>
                                <a href="workspace.html?id=${project.id}" class="btn btn-outline-primary btn-sm px-3">
                                    Open
                                </a>
                            </div>
                        </div>
                    </div>
                `;

                // Delete project event
                const delBtn = cardCol.querySelector('.delete-project-btn');
                delBtn.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (confirm(`Are you sure you want to delete "${project.title}"?`)) {
                        try {
                            await API.deleteProject(project.id);
                            loadProjects();
                        } catch (err) {
                            alert(`Failed to delete project: ${err.message}`);
                        }
                    }
                });

                projectsGrid.appendChild(cardCol);
            });
        } catch (error) {
            console.error('Failed to load projects:', error);
            projectsLoading.classList.add('d-none');
            projectsEmpty.classList.remove('d-none');
            projectsEmpty.innerHTML = `
                <p class="text-danger mb-2">Could not connect to the backend server.</p>
                <p class="text-secondary small mb-0">Ensure the Spring Boot backend is running at <code>${CONFIG.API_BASE_URL}</code>.</p>
            `;
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    refreshBtn.addEventListener('click', loadProjects);

    // Initial load
    loadProjects();
});
