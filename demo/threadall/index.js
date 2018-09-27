document.addEventListener('DOMContentLoaded', function() {
    // Thread Features
    const featureContainer = d3.select('.threadlet-features'),
        featureVis = pv.vis.threadall()
            .on('brush', function(ids) {
                overviewData = featureData.threads.filter(t => ids.includes(t.threadId));
                redrawView(overviewContainer, overviewVis, overviewData, true);
            }).on('click', function(d) {
                detailData = d.messages;
                redrawView(detailContainer, detailVis, detailData, true);
            });
    let featureData = [];

    // Thread Overview
    const overviewContainer = d3.select('.threadlet-some'),
        overviewVis = pv.vis.threadsome()
            .on('click', function(d) {
                detailData = d.messages;
                redrawView(detailContainer, detailVis, detailData, true);
            });
    let overviewData = [];

    // Thread Messages
    const detailContainer = d3.select('.threadlet-detail'),
        detailVis = pv.vis.thread();
    let detailData = [];

    // Make the vis responsive to window resize
    window.onresize = _.throttle(update, 100);

    d3.json('../../data/threads-50_rev.json').then(data => {
        featureData = {
            features: [
                { name: 'Engagement', label: 'Engagement' },
                { name: 'PaceOfInteractionAvgGap', label: 'Interaction Pace' },
                { name: 'ParticipantGrowth', label: 'Participant Growth' },
                { name: 'ParticipantSizeVariation', label: 'Participant Size Variation' },
                { name: 'SenderDiversity', label: 'Sender Diversity' },
                { name: 'SenderDiversityEntropy', label: 'Sender Diversity Entropy' }
            ],
            threads: data
        };

        // Convert timestamp from String to Date
        data.forEach(t => {
            t.messages.forEach(m => {
                m.time = new Date(m.time);
            });

            // Starting time of the thread
            t.time = t.messages[0].time;

            // Tooltip
            t.tooltip = 'Started: ' + d3.timeFormat('%c')(t.time);
            featureData.features.forEach(feature => {
                t.tooltip += '\n' + feature.label + ': ' + t[feature.name];
            });
        });

        overviewData = featureData.threads.slice(0, 3);
        detailData = featureData.threads[0].messages;

        // Build the vises
        update();
    });

    /**
     * Updates vises when window changed.
     */
    function update() {
        redrawView(featureContainer, featureVis, featureData);
        redrawView(overviewContainer, overviewVis, overviewData);
        redrawView(detailContainer, detailVis, detailData);
    }

    function redrawView(container, vis, data, invalidated) {
        const rect = pv.getContentRect(container.node());
        vis.width(rect[0]).height(rect[1]);
        if (invalidated) vis.invalidate();
        container.datum(data).call(vis);
    }
});