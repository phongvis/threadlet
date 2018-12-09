/**
 * A visualization of email threads.
 * Data input:
 * - array of threads, each has:
 *  - threadId
 *  - thread attributes
 */
pv.vis.threadall = function() {
    /**
     * Visual configs.
     */
    const margin = { top: 25, right: 10, bottom: 40, left: 13 },
        rugGap = margin.left - 1,
        circleRadius = 3,
        projectedRadius = circleRadius * Math.sqrt(2) / 2,
        points1 = [[-projectedRadius, projectedRadius], [projectedRadius, -projectedRadius]],
        points2 = [[-projectedRadius, -projectedRadius], [projectedRadius, projectedRadius]];

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
        visTitle = 'Thread Features',
        maxBarWidth,
        brushing = false,
        classLookup = {},
        highlightedThreadIds = [],
        selectedThreadId;

    /**
     * Accessors.
     */
    let threadId = d => d.threadId,
        featureId = d => d.name,
        featureLabel = d => d.label,
        startTime = d => d.startTime,
        tooltip = d => d.tooltip;

    /**
     * Data binding to DOM elements.
     */
    let threadData,
        featureData,
        brushedIds,
        dataChanged = true; // True to redo all data-related computations

    /**
     * DOM.
     */
    let visContainer, // Containing the entire visualization
        axisContainer,
        featureContainer;

    /**
     * D3.
     */
    let colorScale;
    const listeners = d3.dispatch('click', 'brush', 'brushend', 'hover'),
        featureScale = d3.scaleBand().paddingInner(0.1),
        xScale = d3.scaleUtc(),
        xAxis = d3.axisBottom(xScale),
        line = d3.line();

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(_data) {
            // Initialize
            if (!this.visInitialized) {
                const container = d3.select(this).append('g').attr('class', 'pv-threadall');
                visContainer = container.append('g').attr('class', 'main-vis');
                axisContainer = visContainer.append('g').attr('class', 'axis x-axis');
                featureContainer = visContainer.append('g').attr('class', 'features');

                featureData = _data.features;
                threadData = _data.threads;

                addSettings(container);

                this.visInitialized = true;
            }

            update();
        });

        dataChanged = false;
    }

    /**
     * Updates the visualization when data or display attributes changes.
     */
    function update() {
        // Canvas update
        width = visWidth - margin.left - margin.right;
        height = visHeight - margin.top - margin.bottom;
        maxBarWidth = width;

        visContainer.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
        axisContainer.attr('transform', 'translate(0,' + height + ')');
        featureScale.range([0, height - 5]);
        xScale.range([0, maxBarWidth]);

        /**
         * Computation.
         */
        // Updates that depend only on data change
        if (dataChanged) {
            featureScale.domain(d3.range(featureData.length));
            xScale.domain(d3.extent(threadData, startTime));

            // Adjust domain to leave gap for rug space
            const gap = Math.abs(rugGap * (xScale.invert(1) - xScale.invert(0)));
            const domain = xScale.domain();
            xScale.domain([domain[0] - gap, domain[1]]).nice();
        }

        // Axis
        axisContainer.call(xAxis)
            .selectAll('text')
            .style('text-anchor', 'end')
            .attr('transform', 'rotate(-30)');

        // Updates that depend on both data and display change
        layoutFeatures();

        pv.enterUpdate(featureData, featureContainer, enterFeatures, updateFeatures, featureId, 'feature');
    }

    function enterFeatures(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 1);

        // Alternating background
        container.append('rect').attr('class', 'background');

        // Label
        container.append('text').attr('class', 'label')
            .text(featureLabel);

        // Axis and brush
        selection.each(function(d, i) {
            d.scale = d3.scaleLinear().domain(d3.extent(threadData, x => x[featureId(d)]));
            d.brush = d3.brush().on('start', onBrushstarted).on('brush', onBrushed).on('end', onBrushended);
            d3.select(this).append('g').attr('class', 'brush');
        });
    }

    function onBrushstarted(d) {
        brushing = true;

        // Hide other brushes
        featureContainer.selectAll('.brush').each(function(d2) {
            d3.select(this).select('.selection').style('stroke-opacity', d2 === d ? 1 : 0);
        });
    }

    function onBrushed(d) {
        brushedIds = [];

        const s = d3.event.selection;
        if (s) {
            isBrushed = d => d.x >= s[0][0] && d.x <= s[1][0] && d.y >= s[0][1] && d.y <= s[1][1];

            // Find the brushed elements using the brushing feature, then brush the same ids from other features
            d3.select(this.parentNode).selectAll('.thread').each(function(d) {
                if (isBrushed(d)) brushedIds.push(d.id);
            });
        }

        highlightBrushedItems();
        listeners.call('brush', module, brushedIds);
    }

    function highlightBrushedItems() {
        featureContainer.selectAll('.thread').classed('brushed', d2 => brushedIds.includes(d2.id));
        featureContainer.selectAll('.thread').filter(d2 => brushedIds.includes(d2.id)).raise();
    }

    function highlightHoveredItem(id) {
        featureContainer.selectAll('.thread').classed('hovered', d2 => d2.id === id);
        featureContainer.selectAll('.thread').filter(d2 => d2.id === id).raise();
    }

    function onBrushended() {
        onBrushed.call(this);
        brushing = false;

        listeners.call('brushend', module, brushedIds);
    }

    function updateFeatures(selection) {
        selection.each(function(d, i) {
            const container = d3.select(this);

            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            // Background
            container.select('.background')
                .classed('odd', i % 2)
                .attr('x', -margin.left)
                .attr('y', -5)
                .attr('width', width + margin.left + margin.right)
                .attr('height', featureScale.bandwidth() + 10);

            // Label
            container.select('text')
                .attr('x', width / 2)
                .attr('y', -2);

            // Scale
            d.scale.rangeRound([featureScale.bandwidth(), 20]).nice();

            // Brush
            d.brush.extent([[-5, 0], [width + 5, featureScale.bandwidth() + 10]]);
            container.select('.brush').call(d.brush);

            // Thread dots
            const data = threadData.map(x => ({
                id: threadId(x),
                feature: featureId(d),
                value: x[featureId(d)],
                startTime: startTime(x),
                tooltip: tooltip(x)
            }));

            layoutThreads(data, d);

            pv.enterUpdate(data, d3.select(this), enterThreads, updateThreads, d => d.id, 'thread');
        });
    }

    function enterThreads(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');

        // Circle
        container.append('circle')
            .attr('r', circleRadius);

        // Cross lines for recommended samples
        container.append('path')
            .attr('d', line(points1) + line(points2));

        // Rug
        container.append('line').attr('class', 'rug');

        container.append('title')
            .text(tooltip);

        container.on('mouseover', function(d, i) {
            if (brushing) return;

            highlightHoveredItem(d.id);
            listeners.call('hover', module, d.id);
        }).on('mouseout', function() {
            featureContainer.selectAll('.thread').classed('hovered', false);
            listeners.call('hover', module, null);
        }).on('click', function(d) {
            selectedThreadId = selectedThreadId === d.id ? null : d.id; // click again to deselect
            featureContainer.selectAll('.thread').classed('selected', d2 => d2.id === selectedThreadId);
            featureContainer.selectAll('.thread').filter(d2 => d2 => d2.id === selectedThreadId).raise();

            listeners.call('click', module, selectedThreadId);
        });
    }

    function updateThreads(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            container.attr('transform', 'translate(' + d.x + ',' + d.y + ')');

            container.select('circle')
                .style('fill', colorThread);
            container.select('path')
                .classed('hidden', !highlightedThreadIds.includes(d.id));

            // Highlighted threads are more important, bring them to front
            if (highlightedThreadIds.includes(d.id)) {
                container.raise();
            }

            // rug: y is already at correct position, readjust x
            container.select('.rug')
                .attr('x1', -d.x - margin.left + 1)
                .attr('x2', -d.x + rugGap - margin.left + 1);
        });
    }

    function colorThread(d) {
        return classLookup[d.id] !== undefined ? colorScale(classLookup[d.id]) : 'black';
    }

    function layoutFeatures() {
        featureData.forEach((f, i) => {
            f.x = 0;
            f.y = featureScale(i);
        });
    }

    function layoutThreads(data, f) {
        data.forEach(d => {
            d.x = xScale(startTime(d));
            d.y = f.scale(d.value);
        });
    }

    function addSettings(container) {
        container = container.append('foreignObject').attr('class', 'settings')
            .attr('width', '100%').attr('height', '20px')
            .append('xhtml:div').attr('class', 'vis-header');

        // Title
        container.append('xhtml:div').attr('class', 'title').text(visTitle);
    }

    /**
     * Sets/gets the width of the visualization.
     */
    module.width = function(value) {
        if (!arguments.length) return visWidth;
        visWidth = value;
        return this;
    };

    /**
     * Sets/gets the height of the visualization.
     */
    module.height = function(value) {
        if (!arguments.length) return visHeight;
        visHeight = value;
        return this;
    };

    /**
     * Sets/gets the color scale of the visualization.
     */
    module.colorScale = function(value) {
        if (!arguments.length) return colorScale;
        colorScale = value;
        return this;
    };

    /**
     * Sets/gets the class lookup of the visualization.
     */
    module.classLookup = function(value) {
        if (!arguments.length) return classLookup;
        classLookup = value;
        return this;
    };

    /**
     * Sets/gets the threads that are highlighted.
     */
    module.highlightedThreadIds = function(value) {
        if (!arguments.length) return highlightedThreadIds;
        highlightedThreadIds = value;
        return this;
    };

    /**
     * Sets the flag indicating data input has been changed.
     */
    module.invalidate = function() {
        dataChanged = true;
    };

    /**
     * Handles items that are brushed externally.
     */
    module.onBrush = function(ids) {
        brushedIds = ids;
        highlightBrushedItems();
    };

    /**
     * Handles item that is hovered externally.
     */
    module.onHover = highlightHoveredItem;

    /**
     * Handles item that is clicked externally.
     */
    module.onClick = function(id) {
        selectedThreadId = id;
        featureContainer.selectAll('.thread').classed('selected', d2 => d2.id === selectedThreadId);
        featureContainer.selectAll('.thread').filter(d2 => d2 => d2.id === selectedThreadId).raise();
    };

    /**
     * Binds custom events.
     */
    module.on = function() {
        const value = listeners.on.apply(listeners, arguments);
        return value === listeners ? module : value;
    };

    return module;
};