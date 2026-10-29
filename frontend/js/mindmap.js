/**
 * mindmap.js — Interactive D3.js Tree Visualizer
 *
 * Provides:
 * - Hierarchical collapsible tree layout
 * - Smooth cubic bezier links
 * - Zoom & pan controls
 * - Node selection & inspection callback
 * - Expand / collapse all
 * - SVG to PNG export
 */

class MindMapVisualizer {
    /**
     * @param {Object} options
     * @param {string|SVGElement} options.svgSelector - SVG container selector
     * @param {HTMLElement} options.container - Canvas container element
     * @param {Function} options.onNodeSelect - Callback when a node is clicked
     */
    constructor(options) {
        this.svg = d3.select(options.svgSelector);
        this.container = options.container;
        this.onNodeSelect = options.onNodeSelect || (() => {});

        this.width = this.container.clientWidth || 900;
        this.height = this.container.clientHeight || 600;

        this.root = null;
        this.selectedNode = null;
        this.currentData = null;
        this.nodeIdCounter = 0;

        this.init();
    }

    init() {
        this.svg.selectAll('*').remove();

        // Base group for zoom & pan
        this.g = this.svg.append('g').attr('class', 'mindmap-root-group');
        this.gLink = this.g.append('g').attr('class', 'links');
        this.gNode = this.g.append('g').attr('class', 'nodes');

        // Zoom setup
        this.zoom = d3.zoom()
            .scaleExtent([0.15, 3])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
            });

        this.svg.call(this.zoom)
            .on('dblclick.zoom', null); // disable double-click zoom to avoid conflict with node clicks

        // Window resize listener
        window.addEventListener('resize', () => {
            this.resize();
        });
    }

    resize() {
        this.width = this.container.clientWidth || 900;
        this.height = this.container.clientHeight || 600;
        this.svg
            .attr('width', this.width)
            .attr('height', this.height);
    }

    /**
     * Render or re-render the tree with hierarchical JSON data.
     * @param {Object} data - Root node of mind map
     */
    setData(data) {
        this.currentData = data;
        this.resize();

        this.root = d3.hierarchy(data, d => d.children);
        this.root.x0 = this.height / 2;
        this.root.y0 = 60;

        // Assign unique IDs to each node if not present
        this.root.each(d => {
            if (!d.data.id) {
                d.data.id = 'node_' + (++this.nodeIdCounter);
            }
        });

        this.update(this.root);
        this.fitToScreen();
    }

    /**
     * Core D3 update cycle
     */
    update(source) {
        const duration = 350;
        const levelWidth = 240; // horizontal spacing between tree levels

        // Compute new tree layout
        const treeLayout = d3.tree()
            .nodeSize([45, levelWidth])
            .separation((a, b) => (a.parent === b.parent ? 1.1 : 1.3));

        const treeData = treeLayout(this.root);
        const nodes = treeData.descendants();
        const links = treeData.links();

        // Normalize vertical offset
        nodes.forEach(d => {
            d.y = d.depth * levelWidth + 80;
        });

        // ── Links ──────────────────────────────────────────────────
        const link = this.gLink.selectAll('path.link')
            .data(links, d => d.target.data.id);

        const linkEnter = link.enter().append('path')
            .attr('class', 'link')
            .attr('d', () => {
                const o = { x: source.x0, y: source.y0 };
                return this.diagonal({ source: o, target: o });
            })
            .attr('fill', 'none')
            .attr('stroke', '#CBD5E1')
            .attr('stroke-width', 1.8);

        const linkUpdate = linkEnter.merge(link);
        linkUpdate.transition()
            .duration(duration)
            .attr('d', d => this.diagonal(d));

        link.exit().transition()
            .duration(duration)
            .attr('d', () => {
                const o = { x: source.x, y: source.y };
                return this.diagonal({ source: o, target: o });
            })
            .remove();

        // ── Nodes ──────────────────────────────────────────────────
        const node = this.gNode.selectAll('g.node')
            .data(nodes, d => d.data.id);

        const nodeEnter = node.enter().append('g')
            .attr('class', d => `node ${d.depth === 0 ? 'node-root' : (d.children || d._children ? 'node-branch' : 'node-leaf')}`)
            .attr('transform', () => `translate(${source.y0},${source.x0})`)
            .style('cursor', 'pointer');

        // Node background pill / box
        nodeEnter.append('rect')
            .attr('class', 'node-box')
            .attr('rx', 8)
            .attr('ry', 8)
            .attr('height', 34)
            .attr('y', -17)
            .attr('fill', d => d.depth === 0 ? '#3366CC' : '#FFFFFF')
            .attr('stroke', d => d.depth === 0 ? '#2952A3' : '#E2E8F0')
            .attr('stroke-width', d => d.depth === 0 ? 2 : 1.5);

        // Node title text
        nodeEnter.append('text')
            .attr('class', 'node-text')
            .attr('dy', '0.35em')
            .attr('x', 14)
            .attr('fill', d => d.depth === 0 ? '#FFFFFF' : '#1E293B')
            .attr('font-size', d => d.depth === 0 ? '14px' : '13px')
            .attr('font-weight', d => d.depth === 0 ? '600' : '500')
            .text(d => this.truncateText(d.data.title || 'Untitled', 28));

        // Expander button (circle + indicator) for nodes with children
        const expanderGroup = nodeEnter.append('g')
            .attr('class', 'expander-group')
            .style('display', d => (d.children || d._children || (d.data.children && d.data.children.length > 0)) ? 'inline' : 'none');

        expanderGroup.append('circle')
            .attr('class', 'expander-circle')
            .attr('r', 7)
            .attr('fill', '#F8FAFC')
            .attr('stroke', '#94A3B8')
            .attr('stroke-width', 1.5);

        expanderGroup.append('text')
            .attr('class', 'expander-symbol')
            .attr('dy', '0.3em')
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('font-weight', 'bold')
            .attr('fill', '#475569')
            .text(d => d._children ? '+' : '-');

        // Click to select node
        nodeEnter.on('click', (event, d) => {
            event.stopPropagation();
            this.selectNode(d);
        });

        // Click on expander to toggle collapse
        nodeEnter.selectAll('.expander-group').on('click', (event, d) => {
            event.stopPropagation();
            this.toggleChildren(d);
            this.update(d);
        });

        // ── Node Transitions ───────────────────────────────────────
        const nodeUpdate = nodeEnter.merge(node);

        nodeUpdate.transition()
            .duration(duration)
            .attr('transform', d => `translate(${d.y},${d.x})`);

        // Recalculate text and box dimensions based on actual text length
        nodeUpdate.each(function(d) {
            const group = d3.select(this);
            const textElem = group.select('text.node-text');
            const boxElem = group.select('rect.node-box');
            const expander = group.select('.expander-group');

            textElem.text(d.data.title ? (d.data.title.length > 32 ? d.data.title.substring(0, 30) + '…' : d.data.title) : 'Untitled');
            
            let textWidth = 90;
            try {
                textWidth = textElem.node().getComputedTextLength();
            } catch (e) {}

            const boxWidth = Math.max(textWidth + 28, 80);
            boxElem.attr('width', boxWidth);

            // Position expander at right edge
            expander.attr('transform', `translate(${boxWidth}, 0)`);
            expander.select('.expander-symbol').text(d._children ? '+' : '-');
            expander.style('display', (d.children || d._children || (d.data.children && d.data.children.length > 0)) ? 'inline' : 'none');
        });

        // Update selected state appearance
        nodeUpdate.select('rect.node-box')
            .attr('stroke', d => {
                if (this.selectedNode && this.selectedNode.data.id === d.data.id) {
                    return '#3366CC';
                }
                return d.depth === 0 ? '#2952A3' : '#E2E8F0';
            })
            .attr('stroke-width', d => {
                if (this.selectedNode && this.selectedNode.data.id === d.data.id) {
                    return 2.5;
                }
                return d.depth === 0 ? 2 : 1.5;
            });

        // Exiting nodes
        const nodeExit = node.exit().transition()
            .duration(duration)
            .attr('transform', () => `translate(${source.y},${source.x})`)
            .remove();

        nodeExit.select('rect').attr('width', 0).attr('height', 0);
        nodeExit.select('text').style('fill-opacity', 0);

        // Stash positions for future transitions
        nodes.forEach(d => {
            d.x0 = d.x;
            d.y0 = d.y;
        });
    }

    /**
     * Smooth horizontal cubic bezier curve between parent and child
     */
    diagonal(d) {
        return `M ${d.source.y + 40} ${d.source.x}
                C ${(d.source.y + d.target.y) / 2} ${d.source.x},
                  ${(d.source.y + d.target.y) / 2} ${d.target.x},
                  ${d.target.y} ${d.target.x}`;
    }

    truncateText(str, maxLength) {
        if (!str) return '';
        return str.length > maxLength ? str.substring(0, maxLength - 1) + '…' : str;
    }

    toggleChildren(d) {
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else if (d._children) {
            d.children = d._children;
            d._children = null;
        }
    }

    selectNode(d) {
        this.selectedNode = d;
        this.update(d);
        this.onNodeSelect(d);
    }

    /**
     * Fit entire mind map neatly in viewport
     */
    fitToScreen() {
        if (!this.root) return;

        const bounds = this.g.node().getBBox();
        const fullWidth = this.container.clientWidth || 900;
        const fullHeight = this.container.clientHeight || 600;

        const width = bounds.width;
        const height = bounds.height;

        if (width === 0 || height === 0) return;

        const midX = bounds.x + width / 2;
        const midY = bounds.y + height / 2;

        const scale = 0.85 / Math.max(width / fullWidth, height / fullHeight);
        const clampedScale = Math.min(Math.max(scale, 0.25), 1.5);

        const translate = [
            fullWidth / 2 - clampedScale * midX,
            fullHeight / 2 - clampedScale * midY
        ];

        this.svg.transition()
            .duration(500)
            .call(this.zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(clampedScale));
    }

    zoomIn() {
        this.svg.transition().duration(250).call(this.zoom.scaleBy, 1.25);
    }

    zoomOut() {
        this.svg.transition().duration(250).call(this.zoom.scaleBy, 0.8);
    }

    collapseAll() {
        if (!this.root) return;
        const collapse = (d) => {
            if (d.children) {
                d._children = d.children;
                d._children.forEach(collapse);
                d.children = null;
            }
        };
        if (this.root.children) {
            this.root.children.forEach(collapse);
        }
        this.update(this.root);
        this.fitToScreen();
    }

    expandAll() {
        if (!this.root) return;
        const expand = (d) => {
            if (d._children) {
                d.children = d._children;
                d.children.forEach(expand);
                d._children = null;
            } else if (d.children) {
                d.children.forEach(expand);
            }
        };
        expand(this.root);
        this.update(this.root);
        this.fitToScreen();
    }

    /**
     * Export the current mind map SVG to PNG format and download
     */
    exportPng(filename = 'mindmap.png') {
        const svgEl = this.svg.node();
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgEl);

        const bounds = this.g.node().getBBox();
        const padding = 60;
        const width = Math.max(bounds.width + padding * 2, 800);
        const height = Math.max(bounds.height + padding * 2, 600);

        const canvas = document.createElement('canvas');
        canvas.width = width * 2; // high-dpi
        canvas.height = height * 2;
        const ctx = canvas.getContext('2d');
        ctx.scale(2, 2);

        // White background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);

        const img = new Image();
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            ctx.drawImage(img, padding - bounds.x, padding - bounds.y);
            URL.revokeObjectURL(url);

            const pngUrl = canvas.toDataURL('image/png');
            const downloadLink = document.createElement('a');
            downloadLink.href = pngUrl;
            downloadLink.download = filename;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
        };

        img.src = url;
    }
}
