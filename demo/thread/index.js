document.addEventListener('DOMContentLoaded', function() {
    // Instantiate vis and its parameters
    const vis = pv.vis.thread();

    // Make the vis responsive to window resize
    window.onresize = _.throttle(update, 100);

    // Data
    let allSessions,
        allTopics,
        threadData;

    d3.json('../../data/threads-10.json').then(data => {
        threadData = data[4].messages;
        threadData.forEach(m => {
            m.time = new Date(m.time);
        });
        console.log(threadData);

        // allSessions = data.sessions;
        // allTopics = data.topics.map((t, i) => ({
        //     id: i,
        //     // label: '(' + t.map(a => a.action).join(', ') + ')'
        //     label: 'Task ' + (i + 1)
        // }));

        // buildUserDropdown();

        // Display the first user
        // const userId = document.querySelector('#userSelect').options[0].value;
        // userData = buildUserData(userId);

        // Build the vis
        update();
    });

    /**
     * Updates vis when window changed.
     */
    function update() {
        // Update size of the vis
        vis.width(window.innerWidth)
            .height(window.innerHeight);

        // Update size of the vis container and redraw
        d3.select('.pv-vis-demo')
            .attr('width', window.innerWidth)
            .attr('height', window.innerHeight)
            .datum(threadData)
            .call(vis);
    }

    function buildUserData(userId) {
        const columns = allSessions
            .filter(s => s.userId === userId)
            .sort((a, b) => d3.ascending(new Date(a.time), new Date(b.time)))
            .map((s, i) => ({
                id: s.id,
                label: 'S' + (i + 1),
                segments: s.segments.map(seg => seg.topics.map(t => ({ rowId: t.topicId, value: t.prob })))
            }));

        return {
            columns: columns,
            rows: allTopics
        }
    }

    function buildUserDropdown() {
        const select = document.querySelector('#userSelect');
        _.each(_.groupBy(allSessions, d => d.userId), (v, k) => {
            select.options.add(new Option(k + ' (' + v.length + ')', k));
        });

        // Display sessions of the selected user
        select.addEventListener('change', function() {
            userData = buildUserData(this.value);
            vis.invalidate();
            update();
        });
    }
});