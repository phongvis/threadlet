/**
 * A visualization of several email threads.
 * Data input:
 * - array of threads, each has:
 *  - threadId
 *  - array of messages, each has:
 *   - messageId, subject, sender, time
 *   - array of recipients, each has email and type
 */
pv.vis.threadsome = function() {
    /**
     * Visual configs.
     */
    const margin = { top: 45, right: 10, bottom: 5, left: 5 },
        personHeight = 16,
        timeIndicatorGap = 40,
        labelWidth = 90; // This value is also defined in css

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
        visTitle = 'Thread Overview';

    /**
     * Accessors.
     */
    let threadId = d => d.threadId,
        messages = d => d.messages,
        messageId = d => d.messageId,
        personId = d => d.id,
        subject = d => d.subject,
        sender = d => d.sender,
        time = d => d.time,
        recipients = d => d.recipients,
        email = d => d.email;

    /**
     * Data binding to DOM elements.
     */
    let data,
        personLookup,
        personData,
        dataChanged = true; // True to redo all data-related computations

    /**
     * DOM.
     */
    let visContainer, // Containing the entire visualization
        personContainer,
        personBackgroundContainer,
        threadContainer,
        axisContainer,
        selectionContainer;

    /**
     * D3.
     */
    const listeners = d3.dispatch('click'),
        xAbsoluteScale = d3.scaleUtc(),
        xRelativeScale = d3.scaleBand().paddingInner(0.1),
        xAxis = d3.axisTop().scale(xAbsoluteScale).ticks(5),
        instanceSendRecvScale = d3.scaleLinear();

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(_data) {
            // Initialize
            if (!this.visInitialized) {
                const container = d3.select(this).append('g').attr('class', 'pv-threadsome');
                visContainer = container.append('g').attr('class', 'main-vis');
                personBackgroundContainer = visContainer.append('g').attr('class', 'person-backgrounds');
                threadContainer = visContainer.append('g').attr('class', 'threads');
                personContainer = visContainer.append('g').attr('class', 'persons');
                axisContainer = visContainer.append('g').attr('class', 'axis');
                selectionContainer = visContainer.append('g').attr('class', 'selection')
                    .attr('transform', 'translate(' + labelWidth + ',' + timeIndicatorGap + ')')
                    .append('rect').attr('class', 'background')
                        .on('mousemove', onSelectionMove)
                        .on('mouseout', onSelectionOut);

                [personBackgroundContainer, personContainer, threadContainer].forEach(c => {
                    c.attr('transform', 'translate(0, ' + timeIndicatorGap + ')');
                });

                addSettings(container);

                this.visInitialized = true;
            }

            // Sort threads and messages by time.
            data = _data.sort((a, b) => d3.ascending(time(a), time(b)) || d3.ascending(threadId(a), threadId(b)));
            data.forEach(d => {
                messages(d).sort((a, b) => d3.ascending(time(a), time(b)) || d3.ascending(messageId(a), messageId(b)));
            });

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
        xAbsoluteScale.rangeRound([labelWidth, width]);
        xRelativeScale.rangeRound([labelWidth, width]);

        /**
         * Computation.
         */
        // Updates that depend only on data change
        if (dataChanged) {
            const persons = buildPersonData(data);
            personData = groupPersons(persons);

            // lineData = buildLineData(personData);

            xAbsoluteScale.domain(d3.extent(_.flatten(data.map(messages)), time));
            xRelativeScale.domain(_.range(data.length));

            const instances = _.flatten(personData.map(p => p.instances));
            instanceSendRecvScale.domain([0, Math.max(d3.max(instances, d => d.senders), d3.max(instances, d => d.receivers))]);
        }

        // Updates that depend on both data and display change
        instanceSendRecvScale.rangeRound([0, xRelativeScale.bandwidth()]);

        updateSelectionHandle();
        layoutPersons(personData);
        layoutThreads(data);

        /**
         * Draw.
         */
        // if (data.length) axisContainer.call(xAxis);

        const personBackgrounds = personBackgroundContainer.selectAll('.person-background').data(personData, personId);
        personBackgrounds.enter().append('rect').attr('class', 'person-background hidden')
            .merge(personBackgrounds).call(updatePersonBackgrounds);
        personBackgrounds.exit().transition().attr('opacity', 0).remove();

        pv.enterUpdate(personData, personContainer, enterPersons, updatePersons, personId, 'person');
        pv.enterUpdate(data, threadContainer, enterThreads, updateThreads, threadId, 'thread');
    }

    function buildPersonData(threads) {
        // Persons include both senders and recipients.
        // Threads and messages are expected to be already sorted by time.
        personLookup = {};

        // Add a person
        function addPerson(email) {
            let p = personLookup[email];
            if (p) return p;

            return personLookup[email] = {
                id: email,
                label: email.substr(0, email.indexOf('@')),
                title: email,
                email: email,
                instances: Array(threads.length) // Instance is an occurrence of a person in a thread
            };
        }

        threads.forEach((t, i) => {
            messages(t).forEach(m => {
                // Add a person, then increase counts for the number of times the person sends and receives messages.
                let p = addPerson(sender(m));
                if (!p.instances[i]) p.instances[i] = { threadIdx: i, senders: 0, receivers: 0 };
                p.instances[i].senders++;

                // recipients can include the sender
                // recipients can be repeated, so get unique emails
                _.uniq(recipients(m).filter(r => email(r) !== sender(m)).map(email)).forEach(r => {
                    p = addPerson(r);
                    if (!p.instances[i]) p.instances[i] = { threadIdx: i, senders: 0, receivers: 0 };
                    p.instances[i].receivers++;
                });
            });
        });

        // Filter out empty instances
        const persons = _.values(personLookup);
        persons.forEach(p => {
            p.instances = p.instances.filter(p => p);
        });

        return persons;
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
            p.instances.forEach((t, i) => {
                if (t.threadIdx !== x.instances[i].threadIdx ||
                    t.senders !== x.instances[i].senders ||
                    t.receivers !== x.instances[i].receivers) {
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
            `);
    }

    function updateSelectionHandle() {
        selectionContainer
            .attr('width', width - labelWidth)
            .attr('height', personHeight * personData.length);
    }

    function onSelectionMove() {
        const x = d3.mouse(this)[0],
            y = d3.mouse(this)[1];

        // Highlight thread
        const threadIdx = Math.floor(x / xRelativeScale.bandwidth() / (1 + xRelativeScale.paddingInner()));
        threadContainer.selectAll('.thread-background').classed('hidden', (d, i) => threadIdx !== i);
        threadContainer.selectAll('.time').classed('hovered', (d, i) => threadIdx === i);

        // Highlight person
        const personIdx = Math.floor(y / personHeight);
        personBackgroundContainer.selectAll('.person-background').classed('hidden', (d, i) => personIdx !== i);
    }

    function onSelectionOut() {
        threadContainer.selectAll('.thread-background').classed('hidden', true);
        threadContainer.selectAll('.time').classed('hovered', false);
        personBackgroundContainer.selectAll('.person-background').classed('hidden', true);
    }

    function enterPersons(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0);

        container.append('g').attr('class', 'instances');

        const fo = container.append('foreignObject')
            .attr('width', labelWidth + 'px')
            .attr('height', personHeight + 'px');
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
            const instances = container.select('.instances').selectAll('.instance').data(d.instances, d => d.threadIdx);
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
                .attr('width', width - 1)
                .attr('height', personHeight);
        });
    }

    function enterInstances(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0);

        container.append('rect').attr('class', 'sender');
        container.append('rect').attr('class', 'receiver');
        container.append('title').text(d => 'send: ' + d.senders + '\nreceive: ' + d.receivers);
    }

    function updateInstances(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            container.select('.sender')
                .attr('width', instanceSendRecvScale(d.senders))
                .attr('height', personHeight / 2 - 2);
            container.select('.receiver')
                .attr('y', personHeight / 2 - 2)
                .attr('width', instanceSendRecvScale(d.receivers))
                .attr('height', personHeight / 2 - 2);
        });
    }

    function enterThreads(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0);

        container.append('circle')
            .attr('r', 6)
            .style('fill', 'steelblue')
            .style('cursor', 'pointer')
            .attr('cx', xRelativeScale.bandwidth() / 2)
            .attr('cy', -10);

        container.on('click', function(d) {
            listeners.call('click', this, d);
        });


        container.append('rect').attr('class', 'thread-background hidden');

        // container.append('path').attr('class', 'head');
        // container.append('path').attr('class', 'main');
        // container.append('path').attr('class', 'connector');
        // container.append('path').attr('class', 'tail');
    }

    function updateThreads(selection) {
        selection.each(function(d, i) {
            const container = d3.select(this);

            container.transition()
                .attr('opacity', 1);

            container.select('.thread-background')
                .attr('width', xRelativeScale.bandwidth())
                .attr('height', personHeight * personData.length - 1);

            // Find the instance closet to the timeline
            // const firstInstanceY = personData.find(p => p.instances.find(m => m.messageIdx === i)).y;
            // const headHeight = 6;

            // container.select('.head')
            //     .attr('d', getLine([[d.tx, d.ty], [d.tx, d.ty + headHeight]]));

            // container.select('.main')
            //     .attr('d', getCurve([[d.tx, d.ty + headHeight], timeGrouping ? [d.cx, d.y - 15] : [d.x, d.y - headHeight]]));

            // container.select('.connector')
            //     .classed('hidden', !timeGrouping)
            //     .attr('d', getCurve([[d.cx, d.y - 15], [d.x, d.y - headHeight]]));

            // container.select('.tail')
            //     .attr('d', getLine([[d.x, d.y - headHeight], [d.x, longConnector ? firstInstanceY + headHeight : d.y]]));
        });
    }

    function getLine(points) {
        return d3.line()(points);
    }

    function getCurve(points) {
        return d3.linkVertical()({ source: points[0], target: points[1] });
    }

    function layoutPersons(persons) {
        persons.forEach((p, i) => {
            p.x = 0;
            p.y = personHeight * i;
        });
    }

    function layoutThreads(threads) {
        threads.forEach((t, i) => {
            t.x = xRelativeScale(i);
            t.y = 0;
        });
    }

    function layoutInstances(instances) {
        instances.forEach(i => {
            i.x = data[i.threadIdx].x;
            i.y = 1;
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