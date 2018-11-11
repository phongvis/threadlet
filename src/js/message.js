/**
 * Show details of an email message.
 * Data input:
 * - subject, sender, time, recipients
 */
pv.vis.message = function() {
    /**
     * Visual configs.
     */
    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        timeFormat = d3.timeFormat('%b %d, %Y, %X'),
        visTitle = 'Message';

    /**
     * Accessors.
     */
    let subject = d => d.subject,
        sender = d => d.sender,
        time = d => d.time,
        body = d => d.body;

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
                const container = d3.select(this).append('div').attr('class', 'pv-message');
                addSettings(container);

                visContainer = container.append('div').attr('class', 'main-vis');

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
        container = container.append('div').attr('class', 'settings')
            .append('div').attr('class', 'vis-header');

        container.html(`
            <div class='title'>${visTitle}</div>
            `);
    }

    function enterMessages(selection) {
        selection.append('div').attr('class', 'header');
        selection.append('div').attr('class', 'subject');
        selection.append('div').attr('class', 'body');
    }

    function updateMessages(selection) {
        selection.each(function(d) {
            const container = d3.select(this);
            container.select('.header').html(d ? ('from: ' + sender(d) + ' ' + timeFormat(time(d))) : '');
            container.select('.subject').html(d ? subject(d) : '');
            container.select('.body').html(d ? body(d) : '');
        });
    }

    /**
     * Sets/gets the width of the visualization.
     */
    module.width = function(value) {
        return this;
    };

    /**
     * Sets/gets the height of the visualization.
     */
    module.height = function(value) {
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