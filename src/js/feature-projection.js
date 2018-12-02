/**
 * A simple scatter plot of email threads.
 * Data input:
 * - array of threads, each has:
 *  - threadId
 *  - dim1, dim2
 */
pv.vis.featureProjection = function() {
    /**
     * Visual configs.
     */
    const margin = { top: 27, right: 10, bottom: 20, left: 20 },
        circleRadius = 4,
        projectedRadius = circleRadius * Math.sqrt(2) / 2,
        points1 = [[-projectedRadius, projectedRadius], [projectedRadius, -projectedRadius]],
        points2 = [[-projectedRadius, -projectedRadius], [projectedRadius, projectedRadius]],
        texture = textures.lines()
            .size(2)
            .strokeWidth(1);

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
        visTitle = 'Feature Projection',
        brushing = false,
        classLookup = {},
        highlightedThreadIds = [];

    /**
     * Accessors.
     */
    let threadId = d => d.threadId,
        dimX = d => d.dim1,
        dimY = d => d.dim2,
        tooltip = d => d.tooltip;

    /**
     * Data binding to DOM elements.
     */
    let threadData,
        brushedIds,
        dataChanged = true; // True to redo all data-related computations

    /**
     * DOM.
     */
    let visContainer, // Containing the entire visualization
        xAxisContainer,
        yAxisContainer,
        brushContainer,
        threadContainer;

    /**
     * D3.
     */
    let colorScale;
    const xScale = d3.scaleLinear(),
        yScale = d3.scaleLinear(),
        xAxis = d3.axisBottom(xScale),
        yAxis = d3.axisLeft(yScale),
        line = d3.line(),
        brush = d3.brush().on('brush', onBrushed).on('end', onBrushended),
        listeners = d3.dispatch('click', 'brush', 'brushend', 'hover');

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(_data) {
            // Initialize
            if (!this.visInitialized) {
                const container = d3.select(this).append('g').attr('class', 'pv-feature-projection');
                visContainer = container.append('g').attr('class', 'main-vis');
                xAxisContainer = visContainer.append('g').attr('class', 'axis x-axis');
                yAxisContainer = visContainer.append('g').attr('class', 'axis y-axis');
                brushContainer = visContainer.append('g').attr('class', 'brush');
                threadContainer = visContainer.append('g').attr('class', 'threads');

                threadData = _data;

                container.call(texture);

                // addPatternDefinition(container);
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

        visContainer.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
        xAxisContainer.attr('transform', 'translate(0,' + height + ')');
        xScale.rangeRound([0, width]);
        yScale.rangeRound([height, 0]);

        /**
         * Computation.
         */
        // Updates that depend only on data change
        if (dataChanged) {
            xScale.domain(d3.extent(threadData, dimX)).nice();
            yScale.domain(d3.extent(threadData, dimY)).nice();
        }

        // Axis
        xAxisContainer.call(xAxis);
        yAxisContainer.call(yAxis);

        // Brush
        brush.extent([[0, 0], [width, height]]);
        brushContainer.call(brush);

        // Updates that depend on both data and display change
        layoutThreads(threadData);

        pv.enterUpdate(threadData, threadContainer, enterThreads, updateThreads, threadId, 'thread');
    }

    function onBrushed(d) {
        brushedIds = [];

        const s = d3.event.selection;
        if (s) {
            isBrushed = d => d.x >= s[0][0] && d.x <= s[1][0] && d.y >= s[0][1] && d.y <= s[1][1];

            // Find the brushed elements using the brushing feature, then brush the same ids from other features
            threadContainer.selectAll('.thread').each(function(d) {
                if (isBrushed(d)) brushedIds.push(threadId(d));
            });
        }

        highlightBrushedItems();
        listeners.call('brush', module, brushedIds);
    }

    function highlightBrushedItems() {
        threadContainer.selectAll('.thread').classed('brushed', d2 => brushedIds.includes(threadId(d2)));
        threadContainer.selectAll('.thread').filter(d2 => brushedIds.includes(threadId(d2))).raise();
    }

    function highlightHoveredItem(id) {
        threadContainer.selectAll('.thread').classed('hovered', d2 => threadId(d2) === id);
        threadContainer.selectAll('.thread').filter(d2 => threadId(d2) === id).raise();
    }

    function onBrushended() {
        onBrushed.call(this);
        brushing = false;

        listeners.call('brushend', module, brushedIds);
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

        container.append('title')
            .text(tooltip);

        container.on('mouseover', function(d, i) {
            if (brushing) return;

            highlightHoveredItem(threadId(d));
            listeners.call('hover', module, threadId(d));
        }).on('mouseout', function() {
            threadContainer.selectAll('.thread').classed('hovered', false);
            listeners.call('hover', module, null);
        }).on('click', function(d) {
            listeners.call('click', module, threadId(d));
        });
    }

    function updateThreads(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            container.attr('transform', 'translate(' + d.x + ',' + d.y + ')');

            container.select('circle')
                .style('fill', fillCircle);

            container.select('path')
                .classed('hidden', !highlightedThreadIds.includes(threadId(d)));

            // Highlighted threads are more important, bring them to front
            if (highlightedThreadIds.includes(threadId(d))) {
                container.raise();
            }
        });
    }

    function fillCircle(d) {
        // classLookup[threadId(d)] !== undefined ? colorScale(classLookup[threadId(d)]) : 'black'
        const color = classLookup[threadId(d)] !== undefined ? colorScale(classLookup[threadId(d)]) : 'black';
        return color;
        // return texture.url();
    }

    function layoutThreads(data, f) {
        data.forEach(d => {
            d.x = xScale(dimX(d));
            d.y = yScale(dimY(d));
        });
    }

    function addPatternDefinition(container) {
        container.append('defs').append('pattern')
            .attr('id', 'diagonal-stripe')
            .attr('patternUnits', 'userSpaceOnUse')
            .attr('width', 4)
            .attr('height', 4)
            .append('image')
                .attr('width', 4)
                .attr('height', 4)
                .attr('xlink:href', 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMCcgaGVpZ2h0PScxMCc+CiAgPHJlY3Qgd2lkdGg9JzEwJyBoZWlnaHQ9JzEwJyBmaWxsPSd3aGl0ZScvPgogIDxwYXRoIGQ9J00tMSwxIGwyLC0yCiAgICAgICAgICAgTTAsMTAgbDEwLC0xMAogICAgICAgICAgIE05LDExIGwyLC0yJyBzdHJva2U9J2JsYWNrJyBzdHJva2Utd2lkdGg9JzEnLz4KPC9zdmc+Cg==');
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
     * Binds custom events.
     */
    module.on = function() {
        const value = listeners.on.apply(listeners, arguments);
        return value === listeners ? module : value;
    };

    return module;
};