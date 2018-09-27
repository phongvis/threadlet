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
    const margin = { top: 25, right: 10, bottom: 40, left: 10 };

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
        visTitle = 'Thread Features',
        maxBarWidth,
        brushing = false;

    /**
     * Accessors.
     */
    let threadId = d => d.threadId,
        featureId = d => d.name,
        featureLabel = d => d.label,
        time = d => d.time
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
    const listeners = d3.dispatch('click', 'brush'),
        featureScale = d3.scaleBand().paddingInner(0.15),
        xScale = d3.scaleUtc(),
        xAxis = d3.axisBottom(xScale);

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
            xScale.domain(d3.extent(threadData, time));
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

        // // Only keep the active brush, so kill others
        // featureContainer.selectAll('.brush').filter(d2 => d2 !== d).each(function(d2) {
        //     d2.brush.move(d3.select(this), null);
        // });
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

        featureContainer.selectAll('.thread').classed('brushed', d2 => brushedIds.includes(d2.id));
        featureContainer.selectAll('.thread').filter(d2 => brushedIds.includes(d2.id)).raise();
    }

    function onBrushended() {
        onBrushed.call(this);
        brushing = false;

        listeners.call('brush', this, brushedIds);
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
                .attr('y', 0);

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
                time: time(x),
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
            .attr('r', 3);

        container.append('title')
            .text(tooltip);

        container.on('mouseover', function(d, i) {
            if (brushing) return;

            featureContainer.selectAll('.thread').classed('hovered', d2 => d2.id === d.id);
            featureContainer.selectAll('.thread').filter(d2 => d2.id === d.id).raise();
        }).on('mouseout', function() {
            featureContainer.selectAll('.thread').classed('hovered', false);
        }).on('click', function(d) {
            listeners.call('click', this, threadData.find(t => threadId(t) === d.id));
        });
    }

    function updateThreads(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            container.attr('transform', 'translate(' + d.x + ',' + d.y + ')');
        });
    }

    function layoutFeatures() {
        featureData.forEach((f, i) => {
            f.x = 0;
            f.y = featureScale(i);
        });
    }

    function layoutThreads(data, f) {
        data.forEach(d => {
            d.x = xScale(time(d));
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
     * Sets the flag indicating data input has been changed.
     */
    module.invalidate = function() {
        dataChanged = true;
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