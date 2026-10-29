/**
 * api.js — Centralized API client for communicating with the Spring Boot backend.
 */
const API = {
    /**
     * Fetch list of recent projects.
     * @returns {Promise<Array>} List of project objects
     */
    async getProjects() {
        const res = await fetch(`${CONFIG.API_BASE_URL}/api/projects`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Failed to fetch projects' }));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        return await res.json();
    },

    /**
     * Fetch a single project and its mind map.
     * @param {string} projectId 
     * @returns {Promise<Object>} Project details with mind map tree
     */
    async getProject(projectId) {
        const res = await fetch(`${CONFIG.API_BASE_URL}/api/projects/${projectId}`, {
            method: 'GET',
            headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Project not found' }));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        return await res.json();
    },

    /**
     * Delete a project.
     * @param {string} projectId 
     * @returns {Promise<Object>}
     */
    async deleteProject(projectId) {
        const res = await fetch(`${CONFIG.API_BASE_URL}/api/projects/${projectId}`, {
            method: 'DELETE',
            headers: { 'Accept': 'application/json' }
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Failed to delete project' }));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        return await res.json();
    },

    /**
     * Upload a PDF file and generate an AI mind map.
     * @param {File} file - PDF file
     * @param {string} [title] - Optional custom project title
     * @returns {Promise<Object>} Generated project & mind map response
     */
    async generateMindMap(file, title) {
        const formData = new FormData();
        formData.append('file', file);
        if (title && title.trim()) {
            formData.append('title', title.trim());
        }

        const res = await fetch(`${CONFIG.API_BASE_URL}/api/mindmap/generate`, {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Mind map generation failed' }));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        return await res.json();
    },

    /**
     * Save updated mind map edits to backend.
     * @param {string} projectId 
     * @param {Object} mindMapData - Complete mind map JSON tree
     * @param {string} [projectTitle] - Updated project title
     * @returns {Promise<Object>}
     */
    async saveMindMap(projectId, mindMapData, projectTitle) {
        const payload = {
            mindMap: mindMapData,
            projectTitle: projectTitle
        };

        const res = await fetch(`${CONFIG.API_BASE_URL}/api/mindmap/${projectId}/save`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Failed to save mind map' }));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        return await res.json();
    },

    /**
     * Regenerate a single branch using Groq AI.
     * @param {string} projectId 
     * @param {string} branchTitle - The title of the branch to regenerate
     * @returns {Promise<Object>} Object containing the new branch node
     */
    async regenerateBranch(projectId, branchTitle) {
        const res = await fetch(`${CONFIG.API_BASE_URL}/api/mindmap/${projectId}/regenerate-branch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ branchTitle: branchTitle })
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Branch regeneration failed' }));
            throw new Error(err.error || `HTTP ${res.status}`);
        }
        return await res.json();
    }
};
