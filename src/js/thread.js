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
    const margin = { top: 25, right: 10, bottom: 5, left: 5 },
        radius = 4,
        personHeight = 16,
        labelWidth = 90; // this value is also defined in css

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
        sortGroupsMethod = 'time', // time/engagement
        scaleMode = 'absolute'; // absolute/relative

    /**
     * Accessors.
     */
    let messageId = d => d.messageId,
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
        personData,
        personLookup,
        groupData,
        lineData,
        dataChanged = true; // True to redo all data-related computations

    /**
     * DOM.
     */
    let visContainer, // Containing the entire visualization
        personContainer,
        lineContainer,
        axisContainer;

    /**
     * D3.
     */
    const listeners = d3.dispatch('click'),
        xAbsoluteScale = d3.scaleUtc(),
        xRelativeScale = d3.scaleLinear(),
        xAxis = d3.axisBottom().scale(xAbsoluteScale);

    const bcc = 'BCC';

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(_data) {
            // Initialize
            if (!this.visInitialized) {
                visContainer = d3.select(this).append('g').attr('class', 'pv-thread');
                axisContainer = visContainer.append('g').attr('class', 'axis');
                lineContainer = visContainer.append('g').attr('class', 'lines');
                personContainer = visContainer.append('g').attr('class', 'persons');

                addSettings();

                this.visInitialized = true;
            }

            data = _data.sort((a, b) => d3.ascending(time(a), time(b)));
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
        axisContainer.attr('transform', 'translate(0,' + (height - 30) + ')');
        xAbsoluteScale.range([labelWidth, width]);
        xRelativeScale.range([labelWidth, width]);

        /**
         * Computation.
         */
        // Updates that depend only on data change
        if (dataChanged) {
            personData = buildPersonData(data);
            addMessageInstances(data);

            groupData = groupPersons(personData);
            sortGroups(groupData, data);

            lineData = buildLineData(groupData);

            xAbsoluteScale.domain(d3.extent(data, time));
            xRelativeScale.domain([0, data.length - 1]);
        }

        // Updates that depend on both data and display change
        layoutPersons(groupData);
        layoutMessages(data);
        layoutLines(lineData, data);

        /**
         * Draw.
         */
        axisContainer.classed('hidden', scaleMode === 'relative').call(xAxis);

        const persons = personContainer.selectAll('.person').data(groupData, d => d.id);
        persons.enter().append('g').attr('class', 'person').call(enterPersons)
            .merge(persons).call(updatePersons);
        persons.exit().transition().attr('opacity', 0).remove();

        const lines = lineContainer.selectAll('.line').data(lineData, lineId);
        lines.enter().append('g').attr('class', 'line').call(enterLines)
            .merge(lines).call(updateLines);
        lines.exit().transition().attr('opacity', 0).remove();
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
                const id = identicalPersons.map(d => d.id).join('-'),
                    g = {
                        id: id,
                        label: 'Group (' + (identicalPersons.length + 1) + ')',
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

    function sortGroups(groups, messages) {
        const f = sortGroupsMethod === 'time' ? compareGroupsByTime : compareGroupsByEngagement;
        groups.sort((a, b) => f(a, b, messages));
    }

    function compareGroupsByTime(a, b, messages) {
        // Earlier message comes first. If a pair of messages is the same, compare the next one.
        const aTimes = a.instances.map(m => time(messages[m.messageIdx])),
            bTimes = b.instances.map(m => time(messages[m.messageIdx]));

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

        return 0;
    }

    function compareGroupsByEngagement(a, b, messages) {
        // Number of sent messages, then number of received messages
        const aSentCount = a.instances.filter(d => d.isSender).length,
            bSentCount = b.instances.filter(d => d.isSender).length,
            aTotal = a.instances.length,
            bTotal = b.instances.length;
        return bSentCount - aSentCount || bTotal - aTotal;
    }

    function buildLineData(persons) {
        return _.flatten(persons.map(extractLinesFromPerson));
    }

    function extractLinesFromPerson(p) {
        // For a person, a line connects consecutive message instances (no other messages in-between)
        let lastMessageIdx = p.instances[0].messageIdx,
            firstMessageIdx = lastMessageIdx,
            prevLastMessageIdx = 0;
        const lines = [];

        function addLine() {
            lines.push({
                sourceIdx: firstMessageIdx,
                targetIdx: lastMessageIdx,
                personId: p.id,
                id: p.id + '-' + firstMessageIdx + '-' + lastMessageIdx,
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
                personId: p.id,
                id: p.id + '-' + firstIdx + '-' + lastIdx + '-exc',
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

    function addSettings() {
        const container = visContainer.append('foreignObject').attr('class', 'settings')
            .attr('transform', 'translate(0,' + -margin.top + ')')
            .attr('width', '100%').attr('height', '100%');

        container.html(`
            <div class='group-sort'>
                Sort Groups
                <label>
                    <input type='radio' value='time' name='sortGroups'> Time
                </label>
                <label>
                    <input type='radio' value='engagement' name='sortGroups'> Engagement
                </label>
            </div>
            <div class='time-scale'>
                Time Scale
                <label>
                    <input type='radio' value='absolute' name='scaleMode'> Absolute
                </label>
                <label>
                    <input type='radio' value='relative' name='scaleMode'> Relative
                </label>
            </div>`);

        container.select('input[value=' + sortGroupsMethod + ']').node().checked = true;
        container.selectAll('input[name=sortGroups]').on('change', function () {
            sortGroupsMethod = this.value;
            sortGroups(groupData, data);
            update();
        });

        container.select('input[value=' + scaleMode + ']').node().checked = true;
        container.selectAll('input[name=scaleMode]').on('change', function () {
            scaleMode = this.value;
            update();
        });
    }

    function enterPersons(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0);

        const fo = container.append('foreignObject').attr('width', '100%').attr('height', '100%');

        fo.append('xhtml:div').attr('class', 'label')
            .text(d => d.label);
        fo.append('title')
            .text(d => d.title);

        container.append('g').attr('class', 'instances');

        // Hovering person
        // - on a dummy transparent rectangle to make it highlight even when hovering void space
        container.append('rect').attr('class', 'container')
            .on('mouseover', function(d) {
                d3.select(this.parentNode).classed('hovered', true);
                lineContainer.selectAll('.line').filter(l => l.personId === d.id).classed('hovered', true);
            }).on('mouseout', function() {
                d3.select(this.parentNode).classed('hovered', false);
                lineContainer.selectAll('.line').classed('hovered', false);
            });
    }

    function updatePersons(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            container.select('.container')
                .attr('width', width)
                .attr('height', personHeight);

            container.classed('group', d.isGroup);
            container.classed('sender', d.isSender);

            // Message instances
            layoutInstances(d.instances);
            const instances = container.select('.instances').selectAll('.instance').data(d.instances, d => d.messageIdx);
            instances.enter().append('g').attr('class', 'instance').call(enterInstances)
                .merge(instances).call(updateInstances);
            instances.exit().transition().attr('opacity', 0).remove();
        });
    }

    function enterInstances(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0);

        container.append('circle')
            .attr('r', radius);
        // container.append('rect')
        //     .attr('x', -radius)
        //     .attr('y', -radius)
        //     .attr('width', radius * 2)
        //     .attr('height', radius * 2);
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
        messages.forEach((m, i) => {
            m.x = scaleMode === 'absolute' ? xAbsoluteScale(time(m)) : xRelativeScale(i);
            m.y = 0;
        });
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