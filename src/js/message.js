/**
 * Show details of an email message.
 * Data input:
 * - subject, sender, time, recipients
 */
pv.vis.message = function() {
    /**
     * Visual configs.
     */
    const margin = { top: 23, right: 5, bottom: 5, left: 5 };

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
        timeFormat = d3.timeFormat('%b %d, %Y, %X'),
        visTitle = 'Message';

    /**
     * Accessors.
     */
    let subject = d => d.subject,
        sender = d => d.sender,
        time = d => d.time,
        recipients = d => d.recipients,
        email = d => d.email;

    /**
     * Data binding to DOM elements.
     */
    let data,
        dataChanged = true; // True to redo all data-related computations

    /**
     * DOM.
     */
    let visContainer; // Containing the entire visualization

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(_data) {
            // Initialize
            if (!this.visInitialized) {
                const container = d3.select(this).append('g').attr('class', 'pv-message');
                visContainer = container.append('g').attr('class', 'main-vis');

                addSettings(container);

                this.visInitialized = true;
            }

            data = _data;
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

        /**
         * Computation.
         */
        // Updates that depend only on data change
        if (dataChanged) {
        }

        /**
         * Draw.
         */

        pv.enterUpdate(data, visContainer, enterMessages, updateMessages, null, 'message');
    }

    function addSettings(container) {
        container = container.append('foreignObject').attr('class', 'settings')
            .attr('width', '100%').attr('height', '20px')
            .append('xhtml:div').attr('class', 'vis-header');

        container.html(`
            <div class='title'>${visTitle}</div>
            `);
    }

    function enterMessages(selection) {
        selection.append('text').attr('class', 'header');
        selection.append('text').attr('class', 'subject');
    }

    function updateMessages(selection) {
        selection.each(function(d) {
            const container = d3.select(this);
            container.select('.header').html(d ? ('from: ' + sender(d) + ' ' + timeFormat(time(d))) : '');
            container.select('.subject')
                .attr('dy', '1.5em')
                .html(d ? subject(d) : '');
        });
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

    return module;
};