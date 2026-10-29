/**
 * workspace.js — Interactive mind map workspace controller.
 */
document.addEventListener('DOMContentLoaded', async () => {
    // ── URL & State ────────────────────────────────────────────
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('id');

    let currentMindMapData = null;
    let currentProject = null;
    let visualizer = null;
    let selectedD3Node = null;

    // ── DOM Elements ───────────────────────────────────────────
    const projectTitleNav = document.getElementById('projectTitleNav');
    const saveBtn = document.getElementById('saveBtn');
    const exportBtn = document.getElementById('exportBtn');

    const canvasContainer = document.getElementById('canvasContainer');
    const canvasLoading = document.getElementById('canvasLoading');
    const canvasError = document.getElementById('canvasError');
    const errorMessage = document.getElementById('errorMessage');
    const mindmapSvg = document.getElementById('mindmapSvg');

    // Toolbar
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const fitBtn = document.getElementById('fitBtn');
    const collapseAllBtn = document.getElementById('collapseAllBtn');
    const expandAllBtn = document.getElementById('expandAllBtn');

    // Side Panel
    const panelEmpty = document.getElementById('panelEmpty');
    const panelContent = document.getElementById('panelContent');
    const nodeTitleInput = document.getElementById('nodeTitle');
    const nodeDescInput = document.getElementById('nodeDescription');
    const pageRefGroup = document.getElementById('pageRefGroup');
    const nodePageRef = document.getElementById('nodePageRef');
    const updateNodeBtn = document.getElementById('updateNodeBtn');
    const addChildBtn = document.getElementById('addChildBtn');
    const regenerateBtn = document.getElementById('regenerateBtn');
    const deleteNodeBtn = document.getElementById('deleteNodeBtn');
    const regenLoading = document.getElementById('regenLoading');

    // Toast
    const statusToastEl = document.getElementById('statusToast');
    const toastMessage = document.getElementById('toastMessage');
    const statusToast = bootstrap.Toast.getOrCreateInstance(statusToastEl, { delay: 3500 });

    function showToast(msg, bgClass = 'bg-dark text-white') {
        toastMessage.textContent = msg;
        statusToastEl.className = `toast align-items-center border-0 ${bgClass}`;
        statusToast.show();
    }

    if (!projectId) {
        showError('No project ID found in URL. Please select a project from the dashboard.');
        return;
    }

    // ── Initialize Workspace ───────────────────────────────────
    try {
        currentProject = await API.getProject(projectId);

        // Parse mind map if string
        if (typeof currentProject.mindMap === 'string') {
            try {
                currentMindMapData = JSON.parse(currentProject.mindMap);
            } catch (e) {
                throw new Error('Invalid mind map JSON data in database.');
            }
        } else {
            currentMindMapData = currentProject.mindMap;
        }

        // Title display
        const displayTitle = currentProject.projectTitle || currentProject.documentName || 'Mind Map';
        projectTitleNav.textContent = displayTitle;
        document.title = `${displayTitle} — MindMapAI`;

        // Hide loading, show SVG
        canvasLoading.classList.add('d-none');
        mindmapSvg.classList.remove('d-none');

        // Initialize D3 visualizer
        visualizer = new MindMapVisualizer({
            svgSelector: '#mindmapSvg',
            container: canvasContainer,
            onNodeSelect: handleNodeSelect
        });

        visualizer.setData(currentMindMapData);

    } catch (err) {
        console.error('Failed to load mind map:', err);
        showError(err.message || 'Failed to load mind map workspace.');
    }

    function showError(msg) {
        canvasLoading.classList.add('d-none');
        mindmapSvg.classList.add('d-none');
        canvasError.classList.remove('d-none');
        errorMessage.textContent = msg;
    }

    // ── Node Selection & Side Panel ────────────────────────────
    function handleNodeSelect(d3Node) {
        selectedD3Node = d3Node;
        const data = d3Node.data;

        panelEmpty.classList.add('d-none');
        panelContent.classList.remove('d-none');

        nodeTitleInput.value = data.title || '';
        nodeDescInput.value = data.description || '';

        if (data.sourcePage !== undefined && data.sourcePage !== null && data.sourcePage !== '') {
            pageRefGroup.classList.remove('d-none');
            nodePageRef.textContent = `Page ${data.sourcePage}`;
        } else {
            pageRefGroup.classList.add('d-none');
        }

        // Root node restrictions
        if (d3Node.depth === 0) {
            deleteNodeBtn.disabled = true;
            deleteNodeBtn.title = 'Root node cannot be deleted';
            regenerateBtn.classList.add('d-none');
        } else {
            deleteNodeBtn.disabled = false;
            deleteNodeBtn.title = 'Delete this node';
            regenerateBtn.classList.remove('d-none');
        }
    }

    function clearSidePanel() {
        selectedD3Node = null;
        panelContent.classList.add('d-none');
        panelEmpty.classList.remove('d-none');
    }

    // ── Side Panel Actions ─────────────────────────────────────
    updateNodeBtn.addEventListener('click', () => {
        if (!selectedD3Node) return;
        const newTitle = nodeTitleInput.value.trim();
        if (!newTitle) {
            alert('Node title cannot be empty.');
            return;
        }

        selectedD3Node.data.title = newTitle;
        selectedD3Node.data.description = nodeDescInput.value.trim();

        visualizer.update(selectedD3Node);
        showToast('Node details updated');
    });

    addChildBtn.addEventListener('click', () => {
        if (!selectedD3Node) return;

        const childTitle = prompt('Enter title for new child node:', 'New Sub-topic');
        if (!childTitle || !childTitle.trim()) return;

        const newChild = {
            id: 'node_' + Date.now(),
            title: childTitle.trim(),
            description: '',
            children: []
        };

        if (!selectedD3Node.data.children) {
            selectedD3Node.data.children = [];
        }
        selectedD3Node.data.children.push(newChild);

        // If node was collapsed, expand it
        if (selectedD3Node._children) {
            selectedD3Node.children = selectedD3Node._children;
            selectedD3Node._children = null;
        }

        visualizer.setData(currentMindMapData);
        showToast('New node added');
    });

    deleteNodeBtn.addEventListener('click', () => {
        if (!selectedD3Node || selectedD3Node.depth === 0) return;

        const title = selectedD3Node.data.title || 'this node';
        if (!confirm(`Delete "${title}" and all its sub-nodes?`)) return;

        const parent = selectedD3Node.parent;
        if (parent && parent.data.children) {
            parent.data.children = parent.data.children.filter(c => c.id !== selectedD3Node.data.id);
        }

        clearSidePanel();
        visualizer.setData(currentMindMapData);
        showToast('Node deleted');
    });

    regenerateBtn.addEventListener('click', async () => {
        if (!selectedD3Node || selectedD3Node.depth === 0) return;

        const branchTitle = selectedD3Node.data.title;
        if (!confirm(`Ask AI to re-analyze and expand the branch "${branchTitle}"?`)) return;

        regenLoading.classList.remove('d-none');
        regenerateBtn.disabled = true;

        try {
            const result = await API.regenerateBranch(projectId, branchTitle);
            if (result && result.branch) {
                // Merge generated branch into current node
                if (result.branch.children && result.branch.children.length > 0) {
                    selectedD3Node.data.children = result.branch.children;
                }
                if (result.branch.description) {
                    selectedD3Node.data.description = result.branch.description;
                    nodeDescInput.value = result.branch.description;
                }

                // If node was collapsed, expand it
                if (selectedD3Node._children) {
                    selectedD3Node.children = selectedD3Node._children;
                    selectedD3Node._children = null;
                }

                visualizer.setData(currentMindMapData);
                showToast('Branch regenerated with Groq AI!', 'bg-success text-white');
            }
        } catch (err) {
            console.error('Regeneration error:', err);
            alert(`Failed to regenerate branch: ${err.message}`);
        } finally {
            regenLoading.classList.add('d-none');
            regenerateBtn.disabled = false;
        }
    });

    // ── Save Mind Map ──────────────────────────────────────────
    saveBtn.addEventListener('click', async () => {
        if (!currentMindMapData) return;

        saveBtn.disabled = true;
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = `
            <span class="spinner-border spinner-border-sm me-1" role="status"></span>
            Saving…
        `;

        try {
            // Clean tree structure to remove D3 cyclic runtime properties
            const cleanTree = sanitizeMindMapTree(currentMindMapData);
            await API.saveMindMap(projectId, cleanTree, projectTitleNav.textContent);
            showToast('Changes saved to database', 'bg-success text-white');
        } catch (err) {
            console.error('Save error:', err);
            showToast(`Save failed: ${err.message}`, 'bg-danger text-white');
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }
    });

    /**
     * Recursively extract clean JSON node representation without D3 cyclic fields
     */
    function sanitizeMindMapTree(node) {
        if (!node) return null;
        const clean = {
            id: node.id,
            title: node.title || 'Untitled',
            description: node.description || '',
            sourcePage: node.sourcePage !== undefined ? node.sourcePage : null,
            children: []
        };

        const childrenList = node.children || node._children || [];
        if (Array.isArray(childrenList)) {
            clean.children = childrenList.map(c => sanitizeMindMapTree(c)).filter(Boolean);
        }
        return clean;
    }

    // ── Export PNG ─────────────────────────────────────────────
    exportBtn.addEventListener('click', () => {
        if (!visualizer) return;
        const filename = `${(projectTitleNav.textContent || 'mindmap').replace(/[^a-z0-9_-]/gi, '_')}.png`;
        visualizer.exportPng(filename);
        showToast('Exporting high-resolution PNG…');
    });

    // ── Toolbar Actions ────────────────────────────────────────
    zoomInBtn.addEventListener('click', () => visualizer && visualizer.zoomIn());
    zoomOutBtn.addEventListener('click', () => visualizer && visualizer.zoomOut());
    fitBtn.addEventListener('click', () => visualizer && visualizer.fitToScreen());
    collapseAllBtn.addEventListener('click', () => visualizer && visualizer.collapseAll());
    expandAllBtn.addEventListener('click', () => visualizer && visualizer.expandAll());
});
