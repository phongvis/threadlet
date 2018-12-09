document.addEventListener('DOMContentLoaded', async function() {
    const modelFilePath = '../../data/threadlet-model.json',
        dataFilePath = '../../data/threads-100_revV2.json',
        serverUrl = 'http://127.0.0.1:5000/';

    const classColorScale = d3.scaleOrdinal(['#66c2a5', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494']);
    let modelName = '',
        brushingThreadIds = [],
        globalClassLookup = {}, // The class lookup of the entire dataset
        activeClassLookup = {}, // The result of manual labelling, will be sent to the modelling
        userLabels = []; // All thread IDs that are labelled by users

    // Labelling
    const labellingContainer = d3.select('.threadlet-labelling'),
        labellingVis = pv.vis.labelling()
            .colorScale(classColorScale)
            .on('label', onLabelThreads)
            .on('new', onNewModel)
            .on('update', onUpdateModel)
            .on('save', onSaveModel)
            .on('load', onLoadModel)
            .on('testUpdate', onTestUpdateLabels)
            .on('delete', onDeleteClass);
    let labelData = [];

    // Thread Features
    const featureContainer = d3.select('.threadlet-features'),
        featureVis = pv.vis.threadall()
            .classLookup(globalClassLookup)
            .colorScale(classColorScale);
    let featureData = [];

    // Feature Projection
    const projectionContainer = d3.select('.threadlet-projection'),
        projectionVis = pv.vis.featureProjection()
            .classLookup(globalClassLookup)
            .colorScale(classColorScale);
    let projectionData = [];

    // Thread Overview
    const overviewContainer = d3.select('.threadlet-some'),
        overviewVis = pv.vis.threadsome();
    let overviewData = [];

    // Thread Messages
    const detailContainer = d3.select('.threadlet-detail'),
        detailVis = pv.vis.thread()
            .on('hover', function(d) {
                if (!detailVis.selectedMessage()) {
                    messageData = [d];
                    redrawView(messageContainer, messageVis, messageData);
                }
            }).on('click', function(d) {
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

    const threadLinkedViews = [ featureVis, projectionVis, overviewVis ];
    const timeFormat = d3.timeFormat('%d-%b-%Y');

    registerThreadLinkedViews();

    processDataFile(await d3.json(dataFilePath));

    function processDataFile(data) {
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
            t.startTime = t.messages[0].time;
            t.endTime = _.last(t.messages).time;

            // Tooltip
            t.tooltip = timeFormat(t.startTime) + ' ⟶ ' + timeFormat(t.endTime);
            featureData.features.forEach(feature => {
                t.tooltip += '\n' + feature.label + ': ' + parseFloat(t[feature.name].toFixed(1)).toString();
            });
        });

        projectionData = getProjectionData(featureData.threads);
        overviewData = featureData.threads.slice(0, 3);
        detailData = featureData.threads[0].messages;
        messageData = detailData.slice(0, 1);
        labellingVis.allIds(featureData.threads.map(d => d.threadId));

        // Build the vises
        update();
    }

    /**
     * Updates vises when window changed.
     */
    function update() {
        redrawView(featureContainer, featureVis, featureData);
        redrawView(projectionContainer, projectionVis, projectionData);
        redrawView(overviewContainer, overviewVis, overviewData);
        redrawView(detailContainer, detailVis, detailData);
        redrawView(messageContainer, messageVis, messageData);
        redrawView(labellingContainer, labellingVis, labelData);
    }

    function redrawView(container, vis, data, invalidated) {
        const rect = pv.getContentRect(container.node());
        vis.width(rect[0]).height(rect[1]);
        if (invalidated) vis.invalidate();
        container.datum(data).call(vis);
    }

    function getProjectionData(data) {
        return data.map(d => ({ threadId: d.threadId, dim1: d.tSNEX, dim2: d.tSNEY, tooltip: d.tooltip }));
    }

    function registerThreadLinkedViews() {
        threadLinkedViews.forEach(v => {
            if (v === featureVis || v === projectionVis) {
                v.on('brush', onThreadsBrush)
                .on('brushend', onThreadsBrushend)
            }

            v.on('hover', onThreadHover)
            .on('click', onThreadClick);
        });
    }

    function onThreadsBrush(ids) {
        threadLinkedViews.forEach(v => {
            if (v !== this && v.onBrush) v.onBrush(ids);
        });
    }

    function onThreadsBrushend(ids) {
        brushingThreadIds = ids;
        overviewData = featureData.threads.filter(t => ids.includes(t.threadId));
        redrawView(overviewContainer, overviewVis, overviewData, true);
    }

    function onThreadHover(id) {
        threadLinkedViews.forEach(v => {
            if (v !== this && v.onHover) v.onHover(id);
        });
    }

    function onThreadClick(id) {
        // Visual effect
        threadLinkedViews.forEach(v => {
            if (v !== this && v.onClick) v.onClick(id);
        });

        // Show it on the detail view
        const thread = featureData.threads.find(t => t.threadId === id);
        detailData = thread ? thread.messages : [];
        redrawView(detailContainer, detailVis, detailData, true);

        // Show it on the overview
        if (this !== overviewVis) {
            overviewData = thread ? [thread] : [];
            redrawView(overviewContainer, overviewVis, overviewData, true);
        }

        // Also clear the message view
        messageData = [];
        redrawView(messageContainer, messageVis, messageData);

        // And clear the selecion of thread messages
        detailVis.selectedMessage(null);
    }

    function onLabelThreads(classId) {
        function labelOneThread(id) {
            globalClassLookup[id] = activeClassLookup[id] = classId;

            if (!userLabels.includes(id)) {
                userLabels.push(id);
            }

            // Unhighlight
            const idx = threads.indexOf(id);
            if (idx !== -1) {
                threads.splice(threads.indexOf(id), 1);
            }
        }

        const selectedThread = projectionVis.selectedThread();

        // Just need to change in one view because views share the same array.
        const threads = projectionVis.highlightedThreadIds();

        if (selectedThread) {
            labelOneThread(selectedThread.threadId);
        } else {
            // Assign brushing threads to the given classId
            brushingThreadIds.forEach(labelOneThread);
        }

        // Update views
        redrawView(projectionContainer, projectionVis, projectionData);
        redrawView(featureContainer, featureVis, featureData);
    }

    function onNewModel(t) {
        modelName = t;
    }

    function onUpdateModel(recommend) {
        const labelledThreads = _.map(activeClassLookup, (v, k) => ({
            threadId: k,
            classId: v
        }));

        if (labelledThreads.length) {
            updateModels(labelledThreads, recommend);
        }
    }

    function updateModels(threads, recommend) {
        console.log(threads);


        // Ask the modelling to build or update model
        const url = `${serverUrl}model?data=${JSON.stringify(threads)}&rec=${recommend}&name=${modelName}`;
        $.ajax(url).done(r => {
            r = JSON.parse(r);

            console.log('Here is the response from the server');
            console.log(r);

            // Relabelling with updated classes
            for (let threadId in r.classLookup) {
                globalClassLookup[threadId] = r.classLookup[threadId];
            }

            // Update thread projection view
            projectionVis.highlightedThreadIds(r.samples);
            featureVis.highlightedThreadIds(r.samples);
            redrawView(projectionContainer, projectionVis, projectionData);
            redrawView(featureContainer, featureVis, featureData);
        });

        // Reset the active class lookup as all manual labels are sent to the modelling
        for (let threadId in activeClassLookup) {
            delete activeClassLookup[threadId];
        }
    }

    function onTestUpdateLabels(d) {
        updateModels(d.threads, d.recommend);
    }

    function onDeleteClass(classId) {
        // Clear all threads having this class
        [activeClassLookup, globalClassLookup].forEach(classLookup => {
            for (let threadId in classLookup) {
                if (classLookup[threadId] === classId) {
                    delete classLookup[threadId];
                }
            }
        });

        // Update views
        redrawView(projectionContainer, projectionVis, projectionData);
        redrawView(featureContainer, featureVis, featureData);
    }

    function onSaveModel() {
        const model = {
            classes: labellingContainer.datum(),
            globalClassLookup: globalClassLookup,
            activeClassLookup: activeClassLookup,
            recommendedSamples: projectionVis.highlightedThreadIds(),
            userLabels: userLabels
        };

        const text = JSON.stringify(model, null, 4);
        saveAs(new Blob([text]), `${modelName}.json`);

        // Ask the modelling to save a model as well
        $.ajax(`${serverUrl}save?name=${modelName}`);
    }

    function onLoadModel(data) {
        modelName = data.modelName;
        labelData = data.classes;

        // Reassign class
        for (let threadId in data.globalClassLookup) {
            globalClassLookup[threadId] = data.globalClassLookup[threadId];
        }

        // For active one, it could be mismatched, so clear first then assign
        for (let threadId in activeClassLookup) {
            delete activeClassLookup[threadId];
        }
        for (let threadId in data.activeClassLookup) {
            activeClassLookup[threadId] = data.activeClassLookup[threadId];
        }

        userLabels = data.userLabels;

        console.log(globalClassLookup, activeClassLookup);


        // Update views
        labellingContainer.datum(labelData);
        projectionVis.highlightedThreadIds(data.recommendedSamples);
        featureVis.highlightedThreadIds(data.recommendedSamples);
        update();

        // Ask the modelling to load a model as well
        $.ajax(`${serverUrl}load?name=${modelName}`);
    }
});