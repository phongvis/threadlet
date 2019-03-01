document.addEventListener('DOMContentLoaded', async function () {
    let test = true;

    const modelFilePath = '../../models/model-1.json',
        dataFilePath = '../../data/threads-100.json';

    // Model Evaluation
    const evalContainer = d3.select('.threadlet-eval'),
        evalVis = pv.vis.modelEvaluation()
            .on('click', function (d) {
                // Show it on the detail view
                detailData = d.messages;
                redrawView(detailContainer, detailVis, detailData, true);

                // Also clear the message view
                messageData = [];
                redrawView(messageContainer, messageVis, messageData);

                // And clear the selecion of thread messages
                detailVis.selectedMessage(null);
            });
    let evalData = {};

    // Thread Messages
    const detailContainer = d3.select('.threadlet-detail'),
        detailVis = pv.vis.thread()
            .on('hover', function (d) {
                if (!detailVis.selectedMessage()) {
                    messageData = [d];
                    redrawView(messageContainer, messageVis, messageData);
                }
            }).on('click', function (d) {
                messageData = [d];
                redrawView(messageContainer, messageVis, messageData);
            });
    let detailData = [];

    // Message
    const messageContainer = d3.select('.threadlet-message'),
        messageVis = pv.vis.message();
    let messageData = [];

    // Make the vis responsive to window resize
    window.onresize = _.throttle(update, 100);

    processDataFile(await d3.json(dataFilePath));
    processModelFile(await d3.json(modelFilePath));

    // Build the vises
    update();

    function processDataFile(data) {
        // Convert timestamp from String to Date
        data.forEach(t => {
            t.messages.forEach(m => {
                m.time = new Date(m.time);
            });
        });

        evalData.threads = data;
        detailData = test ? data[0].messages : [];
        messageData = test ? detailData.slice(0, 1) : [];
    }

    function processModelFile(model) {
        evalData.classes = model.classes;
    }

    /**
     * Updates vises when window changed.
     */
    function update() {
        redrawView(evalContainer, evalVis, evalData);
        redrawView(detailContainer, detailVis, detailData);
        redrawView(messageContainer, messageVis, messageData);
    }

    function redrawView(container, vis, data, invalidated) {
        const rect = pv.getContentRect(container.node());
        vis.width(rect[0]).height(rect[1]);
        if (invalidated) vis.invalidate();
        container.datum(data).call(vis);
    }
});