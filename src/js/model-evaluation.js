/**
 * An interface to evaluate the model.
 */
pv.vis.modelEvaluation = function () {
    /**
     * Visual configs.
     */
    let width, height, // Size of the main content, excluding margins
        visTitle = 'Model Evaluation',
        threadIdWidth = 125;

    /**
     * Data.
     */
    let labelData,
        threadData,
        completedThreads = new Set(),
        result = {};

    /**
     * DOM.
     */
    let visContainer,
        labelContainer,
        threadContainer,
        settingContainer;

    /**
     * D3.
     */
    const listeners = d3.dispatch('click');

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function (_data) {
            // Initialize
            if (!this.visInitialized) {
                const container = d3.select(this).append('div').attr('class', 'pv-model-evaluation');
                addSettings(container);

                visContainer = container.append('div').attr('class', 'main-vis');
                labelContainer = visContainer.append('div').attr('class', 'labels')
                    .style('margin-left', threadIdWidth + 'px');
                threadContainer = visContainer.append('div').attr('class', 'threads');

                this.visInitialized = true;
            }

            labelData = _data.classes.concat([{ id: 999, label: 'None is appropriate' }]);
            threadData = _data.threads;

            update();
        });
    }

    /**
     * Updates the visualization when data or display attributes changes.
     */
    function update() {
        pv.enterUpdateDiv(labelData, labelContainer, enterLabels, updateLabels, d => d.id, 'class-label');
        pv.enterUpdateDiv(threadData, threadContainer, enterThreads, updateThreads, d => d.threadId, 'thread');
    }

    function enterLabels(container) {
        container.text(d => d.label);
    }

    function updateLabels(selection) {
    }

    function enterThreads(container) {
        container.classed('odd', (d, i) => i % 2);

        container.append('div').attr('class', 'id')
            .text(d => d.threadId)
            .style('width', threadIdWidth + 'px')
            .on('click', function (d) {
                // threadContainer.selectAll('.id').classed('selected', x => x === d);
                threadContainer.selectAll('.thread').classed('selected', x => x === d);
                listeners.call('click', module, d);
            });

        container.each(function (d) {
            labelData.forEach(l => {
                const that = this;
                d3.select(this).append('input')
                    .attr('type', 'radio')
                    .attr('name', d.threadId)
                    .attr('value', l.id)
                    .on('change', function (d) {
                        result[d.threadId] = this.value;
                        d3.select(that).select('.id').classed('completed', true);
                        completedThreads.add(d.threadId);
                        settingContainer.select('.info').text(completedThreads.size + ' / ' + threadData.length + ' completed');
                    });
            });
        });

        settingContainer.select('.info').text(completedThreads.size + ' / ' + threadData.length + ' completed');
    }

    function updateThreads(selection) {
    }

    function addSettings(container) {
        settingContainer = container.append('div').attr('class', 'settings')
            .html(`
                <div class='vis-header'>
                    <div class='title'>${visTitle}</div>
                    <button class='setting submit'>Submit</button>
                    <div class='setting info'></div>
                </div>
            `);

        handleSubmit();
    }

    function handleSubmit() {
        settingContainer.select('.submit').on('click', function () {
            const text = JSON.stringify(result, null, 4);
            saveAs(new Blob([text]), `evaluation-result-${+new Date()}.json`);
        });
    }

    /**
     * Sets/gets the width of the visualization.
     */
    module.width = function (value) {
        if (!arguments.length) return visWidth;
        visWidth = value;
        return this;
    };

    /**
     * Sets/gets the height of the visualization.
     */
    module.height = function (value) {
        if (!arguments.length) return visHeight;
        visHeight = value;
        return this;
    };

    /**
     * Binds custom events.
     */
    module.on = function () {
        const value = listeners.on.apply(listeners, arguments);
        return value === listeners ? module : value;
    };

    return module;
};