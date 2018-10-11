/**
 * A visualization of an email thread.
 * Data input:
 * - array of messages, each has:
 *  - messageId, subject, sender, time
 *  - array of recipients, each has email and type
 */
pv.vis.thread = function() {
    /**
     * Visual configs.
     */
    const margin = { top: 45, right: 10, bottom: 5, left: 5 },
        radius = 4,
        personHeight = 16,
        timeIndicatorGap = 40,
        labelWidth = 90; // This value is also defined in css

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
        visTitle = 'Thread Messages',
        messageWidth,
        sortGroupsMethod = 'time', // time/engagement
        timeGrouping = false,
        longConnector = true;

    /**
     * Accessors.
     */
    let messageId = d => d.messageId,
        personId = d => d.id,
        subject = d => d.subject,
        sender = d => d.sender,
        time = d => d.time,
        recipients = d => d.recipients,
        email = d => d.email,
        type = d => d.type,
        lineId = d => d.id;

    /**
     * Data binding to DOM elements.
     */
    let data,
        personLookup,
        personData,
        lineData,
        dataChanged = true; // True to redo all data-related computations

    /**
     * DOM.
     */
    let visContainer, // Containing the entire visualization
        personContainer,
        personBackgroundContainer,
        lineContainer,
        timeContainer,
        axisContainer,
        selectionContainer;

    /**
     * D3.
     */
    const listeners = d3.dispatch('click', 'hover'),
        xAbsoluteScale = d3.scaleUtc(),
        xRelativeScale = d3.scaleLinear(),
        xAxis = d3.axisTop().scale(xAbsoluteScale);

    const bcc = 'BCC';

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(_data) {
            // Initialize
            if (!this.visInitialized) {
                const container = d3.select(this).append('g').attr('class', 'pv-thread');
                visContainer = container.append('g').attr('class', 'main-vis');
                personBackgroundContainer = visContainer.append('g').attr('class', 'person-backgrounds');
                timeContainer = visContainer.append('g').attr('class', 'times');
                lineContainer = visContainer.append('g').attr('class', 'lines');
                personContainer = visContainer.append('g').attr('class', 'persons');
                axisContainer = visContainer.append('g').attr('class', 'axis');
                selectionContainer = visContainer.append('g').attr('class', 'selection')
                    .attr('transform', 'translate(' + labelWidth + ',' + timeIndicatorGap + ')')
                    .append('rect').attr('class', 'background')
                        .on('mousemove', onSelectionMove)
                        .on('mouseout', onSelectionOut);

                [personBackgroundContainer, lineContainer, personContainer, timeContainer].forEach(c => {
                    c.attr('transform', 'translate(0, ' + timeIndicatorGap + ')');
                });

                addSettings(container);

                this.visInitialized = true;
            }

            data = _data.sort((a, b) => d3.ascending(time(a), time(b)) || d3.ascending(messageId(a), messageId(b)));
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
        messageWidth = (width - labelWidth) / (data.length - 1);

        visContainer.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
        xAbsoluteScale.rangeRound([labelWidth, width]);
        xRelativeScale.rangeRound([labelWidth, width]);

        /**
         * Computation.
         */
        // Updates that depend only on data change
        if (dataChanged) {
            const persons = buildPersonData(data);
            addMessageInstances(data);

            personData = groupPersons(persons);
            sortGroups(personData);

            lineData = buildLineData(personData);

            xAbsoluteScale.domain(d3.extent(data, time));
            xRelativeScale.domain([0, data.length - 1]);
        }

        // Updates that depend on both data and display change
        updateSelectionHandle();
        layoutPersons(personData);
        layoutMessages(data);
        layoutLines(lineData, data);

        /**
         * Draw.
         */
        if (data.length) axisContainer.call(xAxis);

        const personBackgrounds = personBackgroundContainer.selectAll('.person-background').data(personData, personId);
        personBackgrounds.enter().append('rect').attr('class', 'person-background hidden')
            .merge(personBackgrounds).call(updatePersonBackgrounds);
        personBackgrounds.exit().transition().attr('opacity', 0).remove();

        pv.enterUpdate(personData, personContainer, enterPersons, updatePersons, personId, 'person');
        pv.enterUpdate(lineData, lineContainer, enterLines, updateLines, lineId, 'line');
        pv.enterUpdate(data, timeContainer, enterTimes, updateTimes, messageId, 'time');

        // Keep the elements sync. with the data to make the hovering by index work.
        personBackgrounds.order();
    }

    function buildPersonData(messages) {
        // Persons include both senders and recipients.
        // Senders are added first, sorted by time.
        // Then recipients who don't send are added, sort by time as well.
        // Messages are expected to be already sorted by time.
        const persons = [];
        personLookup = {};

        function addPerson(s) {
            if (!personLookup[s]) {
                persons.push({
                    id: s,
                    label: s.substr(0, s.indexOf('@')),
                    title: s,
                    email: s,
                    instances: []
                });
                personLookup[s] = _.last(persons);
            }
        }

        messages.map(sender).forEach(addPerson);

        persons.forEach(p => {
            p.isSender = true;
        });

        messages.map(recipients).forEach(r => {
            r.map(email).forEach(addPerson);
        });

        return persons;
    }

    function addMessageInstances(messages) {
        messages.forEach((m, i) => {
            const reLookup = {};

            // Sender can be in the recipients
            personLookup[sender(m)].instances.push(createNewMessageInstance(i, true));
            reLookup[sender(m)] = 1;

            recipients(m).forEach(r => {
                // There can be duplicate recipients in a message with different types, or even simply identical duplicates?
                const oldInstance = reLookup[email(r)];
                if (!oldInstance) {
                    const instance = createNewMessageInstance(i, false, type(r));
                    personLookup[email(r)].instances.push(instance);
                    reLookup[email(r)] = instance;
                } else if (!oldInstance.isSender) { // Don't update if there was a sender
                    // If the instance exists but the new one is 'bcc', update it
                    if (type(r) === bcc) {
                        oldInstance.type = bcc;
                    }
                }
            });
        });
    }

    function createNewMessageInstance(idx, isSender, type) {
        return {
            messageIdx: idx, // Index of the message in the array of messages
            isSender: isSender,
            type: type
        };
    }

    function groupPersons(persons) {
        // Each group has { isGroup, emails, instances: [] }.
        // A person without any other identical patterns is also considered as a group.
        const groups = [];

        persons.forEach(p => {
            if (p.processed) return;

            const identicalPersons = [p].concat(findIdenticalPersons(persons, p));
            if (identicalPersons.length > 1) {
                const id = personId(identicalPersons[0]),
                    g = {
                        id: id,
                        label: 'Group (' + identicalPersons.length + ')',
                        title: identicalPersons.map(d => d.title).join('\n'),
                        isGroup: true,
                        emails: identicalPersons.map(p => p.email),
                        instances: p.instances
                    }
                groups.push(g);
                personLookup[id] = g;
            } else {
                groups.push(p);
            }
        });

        return groups;
    }

    function findIdenticalPersons(persons, p) {
        p.processed = true;
        const results = [];

        persons.filter(x => !x.processed && x.instances.length === p.instances.length).forEach(x => {
            let same = true;
            p.instances.forEach((m, i) => {
                if (m.messageIdx !== x.instances[i].messageIdx ||
                    m.isSender !== x.instances[i].isSender ||
                    m.type !== x.instances[i].type) {
                    same = false;
                    return;
                }
            });

            if (same) {
                results.push(x);
                x.processed = true;
            }
        });

        return results;
    }

    function sortGroups(groups) {
        const f = sortGroupsMethod === 'time' ? compareGroupsByTime : compareGroupsByEngagement;
        groups.sort((a, b) => f(a, b));
    }

    function compareGroupsById(a, b) {
        return d3.ascending(personId(a), personId(b));
    }

    function compareGroupsByTime(a, b) {
        // Earlier message comes first. If a pair of messages is the same, compare the next one.
        const aTimes = a.instances.map(m => time(data[m.messageIdx])),
            bTimes = b.instances.map(m => time(data[m.messageIdx]));

        for (let i = 0; i < Math.max(aTimes.length, bTimes.length); i++) {
            if (!aTimes[i]) return -1; // a is shorter
            if (!bTimes[i]) return 1; // b is shorter

            const c = d3.ascending(aTimes[i], bTimes[i]);
            if (c) return c;

            // Same time
            if (a.instances[i].isSender) return -1; // sender first
            if (b.instances[i].isSender) return 1; // sender first
            if (a.instances[i].type === bcc) return 1; // bcc last
            if (b.instances[i].type === bcc) return -1; // bcc last
        }

        return compareGroupsById(a, b);
    }

    function compareGroupsByEngagement(a, b) {
        // Number of sent messages, then number of received messages
        const aSentCount = a.instances.filter(d => d.isSender).length,
            bSentCount = b.instances.filter(d => d.isSender).length,
            aTotal = a.instances.length,
            bTotal = b.instances.length;
        return bSentCount - aSentCount || bTotal - aTotal || compareGroupsById(a, b);
    }

    function buildLineData(persons) {
        return _.flatten(persons.map(extractLinesFromPerson));
    }

    function extractLinesFromPerson(p) {
        // For a person, a line connects consecutive message instances (no other messages in-between)
        let lastMessageIdx = p.instances[0].messageIdx,
            firstMessageIdx = lastMessageIdx;
        const lines = [];

        function addLine() {
            lines.push({
                sourceIdx: firstMessageIdx,
                targetIdx: lastMessageIdx,
                personId: personId(p),
                id: personId(p) + '-' + firstMessageIdx + '-' + lastMessageIdx,
                isGroup: p.isGroup
            });
        }

        // Add exclusion line
        if (p.instances.length > 1) {
            const firstIdx = p.instances[0].messageIdx,
                lastIdx = _.last(p.instances).messageIdx;
            lines.push({
                exclusion: true,
                sourceIdx: firstIdx,
                targetIdx: lastIdx,
                personId: personId(p),
                id: personId(p) + '-' + firstIdx + '-' + lastIdx + '-exc',
                isGroup: p.isGroup
            });
        }

        p.instances.slice(1).forEach(m => {
            // The line breaks if the current messageIdx is not equal to the previous one + 1
            if (m.messageIdx !== lastMessageIdx + 1) {
                if (lastMessageIdx !== firstMessageIdx) {
                    addLine();
                }

                firstMessageIdx = m.messageIdx;
            }

            lastMessageIdx = m.messageIdx;
        });

        // Add the last one as it doesn't break yet
        if (lastMessageIdx !== firstMessageIdx) {
            addLine();
        }

        return lines;
    }

    function addSettings(container) {
        container = container.append('foreignObject').attr('class', 'settings')
            .attr('width', '100%').attr('height', '20px')
            .append('xhtml:div').attr('class', 'vis-header');

        container.html(`
            <div class='title'>${visTitle}</div>
            <div class='setting group-sort'>
                Sort Groups
                <label>
                    <input type='radio' value='time' name='group-sort'> Time
                </label>
                <label>
                    <input type='radio' value='engagement' name='group-sort'> Engagement
                </label>
            </div>`);

        container.select('input[value=' + sortGroupsMethod + ']').node().checked = true;
        container.selectAll('input[name=group-sort]').on('change', function () {
            sortGroupsMethod = this.value;
            sortGroups(personData);
            update();
        });

        // Not used
        // <div class='setting long-connector'>
        //     <label>
        //         <input type='checkbox' name='long-connector'> Long Connector
        //     </label>
        // </div>
        // <div class='setting time-grouping'>
        //     <label>
        //         <input type='checkbox' name='time-grouping'> Time Grouping
        //     </label>
        // </div>

        // container.select('input[name=time-grouping]').node().checked = timeGrouping;
        // container.select('input[name=time-grouping]').on('change', function() {
        //     timeGrouping = this.checked;
        //     update();
        // });

        // container.select('input[name=long-connector]').node().checked = longConnector;
        // container.select('input[name=long-connector]').on('change', function() {
        //     longConnector = this.checked;
        //     update();
        // });
    }

    function updateSelectionHandle() {
        selectionContainer
            .attr('x', -messageWidth / 2)
            .attr('width', width - labelWidth + messageWidth)
            .attr('height', personHeight * personData.length);
    }

    function onSelectionMove() {
        const x = d3.mouse(this)[0],
            y = d3.mouse(this)[1];

        // Highlight message
        const messageIdx = Math.floor((x + messageWidth / 2) / messageWidth);
        timeContainer.selectAll('.message-background').classed('hidden', (d, i) => messageIdx !== i);
        timeContainer.selectAll('.time').classed('hovered', (d, i) => messageIdx === i);

        listeners.call('hover', this, data[messageIdx]);

        // Highlight person
        const personIdx = Math.floor(y / personHeight);
        personBackgroundContainer.selectAll('.person-background').classed('hidden', (d, i) => personIdx !== i);
    }

    function onSelectionOut() {
        timeContainer.selectAll('.message-background').classed('hidden', true);
        timeContainer.selectAll('.time').classed('hovered', false);
        personBackgroundContainer.selectAll('.person-background').classed('hidden', true);

        listeners.call('hover', this, null);
    }

    function enterPersons(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0);

        container.append('g').attr('class', 'instances');

        const fo = container.append('foreignObject').attr('width', '100%').attr('height', personHeight + 'px');
        fo.append('xhtml:div').attr('class', 'label');
    }

    function updatePersons(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            container.classed('group', d.isGroup);
            container.classed('sender', d.isSender);

            container.select('.label')
                .text(d.label)
                .attr('title', d.title);

            // Message instances
            layoutInstances(d.instances);
            const instances = container.select('.instances').selectAll('.instance').data(d.instances, d => d.messageIdx);
            instances.enter().append('g').attr('class', 'instance').call(enterInstances)
                .merge(instances).call(updateInstances);
            instances.exit().transition().attr('opacity', 0).remove();
        });
    }

    function updatePersonBackgrounds(selection) {
        selection.each(function(d) {
            d3.select(this)
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('y', -1)
                .attr('width', width + messageWidth / 2)
                .attr('height', personHeight);
        });
    }

    function enterInstances(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0);

        container.append('circle')
            .attr('r', radius);
    }

    function updateInstances(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            container.classed('sender', d.isSender);
            container.classed('bcc', type(d) === bcc);
        });
    }

    function enterTimes(selection) {
        const container = selection
            .attr('opacity', 0);

        container.append('rect').attr('class', 'message-background hidden');

        container.append('path').attr('class', 'head');
        container.append('path').attr('class', 'main');
        container.append('path').attr('class', 'connector');
        container.append('path').attr('class', 'tail');
    }

    function updateTimes(selection) {
        selection.each(function(d, i) {
            const container = d3.select(this);

            container.transition()
                .attr('opacity', 1);

            container.select('.message-background')
                .attr('x', d.x - personHeight / 2)
                .attr('y', 0)
                .attr('width', personHeight)
                .attr('height', personHeight * personData.length - 1);

            // Find the instance closet to the timeline
            const firstInstanceY = personData.find(p => p.instances.find(m => m.messageIdx === i)).y;
            const headHeight = 6;

            container.select('.head')
                .attr('d', getLine([[d.tx, d.ty], [d.tx, d.ty + headHeight]]));

            container.select('.main')
                .attr('d', getCurve([[d.tx, d.ty + headHeight], timeGrouping ? [d.cx, d.y - 15] : [d.x, d.y - headHeight]]));

            container.select('.connector')
                .classed('hidden', !timeGrouping)
                .attr('d', getCurve([[d.cx, d.y - 15], [d.x, d.y - headHeight]]));

            container.select('.tail')
                .attr('d', getLine([[d.x, d.y - headHeight], [d.x, longConnector ? firstInstanceY + headHeight : d.y]]));
        });
    }

    function getLine(points) {
        return d3.line()(points);
    }

    function getCurve(points) {
        return d3.linkVertical()({ source: points[0], target: points[1] });
    }

    function enterLines(selection) {
        const container = selection
            .attr('opacity', 0);

        container.append('line');
    }

    function updateLines(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            container.transition()
                .attr('opacity', 1);

            container.classed('exclusion', d.exclusion);
            container.classed('group', d.isGroup);

            container.select('line')
                .transition()
                .attr('x1', d.x1)
                .attr('y1', d.y)
                .attr('x2', d.x2)
                .attr('y2', d.y);
        });
    }

    function layoutPersons(persons) {
        persons.forEach((p, i) => {
            p.x = 0;
            p.y = personHeight * i;
        });
    }

    function layoutMessages(messages) {
        const minGap = 1;
        let currentGroup = [];

        function assignGroupMean(g) {
            const cx = d3.mean(g, m => m.x);
            g.forEach(m => {
                m.cx = cx;
            });
        }

        messages.forEach((m, i) => {
            m.x = xRelativeScale(i);
            m.y = 4;
            m.tx = xAbsoluteScale(time(m)) + 0.5;
            m.ty = 1 - timeIndicatorGap;

            // If the distance between this timestamp and the previous timestamp is less than a given threshold,
            // add to the current group.
            if (i === 0) {
                currentGroup.push(m);
            } else {
                if (m.tx - messages[i - 1].tx < minGap) {
                    currentGroup.push(m);
                } else {
                    assignGroupMean(currentGroup);
                    currentGroup = [m];
                }
            }
        });

        // Last group
        assignGroupMean(currentGroup);
    }

    function layoutInstances(instances) {
        instances.forEach(i => {
            i.x = data[i.messageIdx].x;
            i.y = (personHeight - radius) / 2 + 1;
        });
    }

    function layoutLines(lines, messages) {
        lines.forEach(l => {
            l.x1 = messages[l.sourceIdx].x;
            l.x2 = messages[l.targetIdx].x;
            l.y = personLookup[l.personId].y + (personHeight - radius) / 2 + 1;
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

    /**
     * Binds custom events.
     */
    module.on = function() {
        const value = listeners.on.apply(listeners, arguments);
        return value === listeners ? module : value;
    };

    return module;
};