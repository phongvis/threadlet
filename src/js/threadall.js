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
    const margin = { top: 45, right: 10, bottom: 5, left: 10 };

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
        visTitle = 'Thread Features',
        maxBarHeight;

    /**
     * Accessors.
     */
    let threadId = d => d.threadId,
        featureId = d => d.name,
        featureLabel = d => d.label;

    /**
     * Data binding to DOM elements.
     */
    let threadData,
        featureData,
        dataChanged = true; // True to redo all data-related computations

    /**
     * DOM.
     */
    let visContainer, // Containing the entire visualization
        featureContainer;

    /**
     * D3.
     */
    const listeners = d3.dispatch('click'),
        featureScale = d3.scaleBand().paddingInner(0.1);

    const jitterLookup = {}; // Random noise adding to threads to avoid overplotting
    let query = {};

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(_data) {
            // Initialize
            if (!this.visInitialized) {
                const container = d3.select(this).append('g').attr('class', 'pv-threadall');
                visContainer = container.append('g').attr('class', 'main-vis');
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
        maxBarHeight = height - 20;

        visContainer.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
        featureScale.range([0, width]);

        /**
         * Computation.
         */
        // Updates that depend only on data change
        if (dataChanged) {
            featureScale.domain(d3.range(featureData.length));

            threadData.forEach(t => {
                featureData.forEach(f => {
                    jitterLookup[threadId(t) + '-' + featureId(f)] = Math.random();
                });
            });
        }

        // Updates that depend on both data and display change
        layoutFeatures();

        pv.enterUpdate(featureData, featureContainer, enterFeatures, updateFeatures, featureId, 'feature');
    }

    function enterFeatures(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 1);

        // Label
        container.append('text').attr('class', 'label')
            .text(featureLabel);

        // Axis and brush
        selection.each(function(d) {
            d.scale = d3.scaleLinear().domain(d3.extent(threadData, x => x[featureId(d)]));
            d.brush = d3.brushX().on('brush', onBrushed).on('end', onBrushed);
            d3.select(this).append('g').attr('class', 'axis x-axis')
                .attr('transform', 'translate(0, 5)');
            d3.select(this).append('g').attr('class', 'brush');
        });
    }

    function onBrushed(d) {
        const feature = featureId(d);
        if (d3.event.selection) {
            // If holding SHIFT, add the feature to the query. Otherwise, set the feature to the only one.
            if (!d3.event.sourceEvent.shiftKey) {
                query = {};

                // Also clear other feature brushes.
                featureContainer.selectAll('.brush').filter(d2 => d2 !== d).each(function(d2) {
                    d2.brush.move(d3.select(this), null);
                });
            }
            query[feature] = d3.event.selection.map(d.scale.invert);
        } else {
            delete query[feature];
        }

        // x needs to satisfy all querying conditions (AND)
        let brushedIds = [];
        if (_.size(query)) {
            const isBrushed = x => d3.entries(query).every(q => x[q.key] >= q.value[0] && x[q.key] <= q.value[1]);
            brushedIds = threadData.filter(isBrushed).map(threadId);
        }

        featureContainer.selectAll('.thread').classed('brushed', d2 => brushedIds.includes(d2.id));
        featureContainer.selectAll('.thread').filter(d2 => brushedIds.includes(d2.id)).raise();
    }

    function updateFeatures(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            // Label
            container.select('text')
                .attr('x', featureScale.bandwidth() / 2)
                .attr('y', -maxBarHeight - 23);

            // Axis
            d.scale.rangeRound([0, featureScale.bandwidth()]).nice();
            container.select('.axis').call(d3.axisBottom(d.scale).ticks(5));

            // Brush
            d.brush.extent([[0, -maxBarHeight - 4], [featureScale.bandwidth(), 3]]);
            container.select('.brush').call(d.brush);

            // Thread dots
            const data = threadData.map(x => ({ id: threadId(x), feature: featureId(d), value: x[featureId(d)] }));
            layoutThreads(data, d);
            pv.enterUpdate(data, d3.select(this), enterThreads, updateThreads, threadId, 'thread');
        });
    }

    function enterThreads(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');

        // Circle
        container.append('circle')
            .attr('r', 3);

        container.on('mouseover', function(d, i) {
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
            f.x = featureScale(i);
            f.y = maxBarHeight;
        });
    }

    function layoutThreads(data, f) {
        data.forEach(d => {
            d.x = f.scale(d.value);
            d.y = -jitterLookup[d.id + '-' + featureId(f)] * maxBarHeight;
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