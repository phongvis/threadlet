document.addEventListener('DOMContentLoaded', function() {
    // Thread Features
    const featureContainer = d3.select('.threadlet-features'),
        featureVis = pv.vis.threadall()
            .on('click', function(d) {
                detailData = d.messages;
                redrawDetail(true);
            });
    let featureData = [];

    // Thread Messages
    const detailContainer = d3.select('.threadlet-detail'),
        detailVis = pv.vis.thread();
    let detailData;

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
        });

        detailData = featureData.threads[0].messages;

        // Build the vis
        update();
    });

    /**
     * Updates vis when window changed.
     */
    function update() {
        redrawFeatures();
        redrawDetail();
    }

    function assignVisDimensions(selector, vis) {
        const rect = pv.getContentRect(selector.node());
        vis.width(rect[0]).height(rect[1]);
    }

    function redrawFeatures() {
        assignVisDimensions(featureContainer, featureVis);
        featureContainer.datum(featureData).call(featureVis);
    }

    function redrawDetail(invalidated) {
        assignVisDimensions(detailContainer, detailVis);
        if (invalidated) detailVis.invalidate();
        detailContainer.datum(detailData).call(detailVis);
    }
});