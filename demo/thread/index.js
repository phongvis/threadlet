document.addEventListener('DOMContentLoaded', function() {
    // Instantiate vis and its parameters
    const vis = pv.vis.thread();

    // Make the vis responsive to window resize
    window.onresize = _.throttle(update, 100);

    // Data
    const threadIdx = 4;

    let threadData;

    d3.json('../../data/threads-10.json').then(data => {
        data.forEach(t => {
            t.messages.forEach(m => {
                m.time = new Date(m.time);
            });
        });

        buildThreadDropdown(data);

        // Display the selected thread
        threadData = data[threadIdx].messages;

        // Build the vis
        update();
    });

    /**
     * Updates vis when window changed.
     */
    function update() {
        // Update size of the vis
        vis.width(window.innerWidth)
            .height(window.innerHeight - 20);

        // Update size of the vis container and redraw
        d3.select('.pv-vis-demo')
            .attr('width', window.innerWidth)
            .attr('height', window.innerHeight - 20)
            .datum(threadData)
            .call(vis);
    }

    function buildThreadDropdown(data) {
        const select = document.querySelector('#threadSelect');
        data.forEach((d, i) => {
            select.options.add(new Option(d.threadId + ' (' + d.messages.length + ' messages)', i));
        });

        select.value = threadIdx;

        // Display sessions of the selected user
        select.addEventListener('change', function() {
            threadData = data[this.value].messages;
            vis.invalidate();
            update();
        });
    }
});